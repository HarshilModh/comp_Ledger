import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

export async function writeEvidenceRecord(record) {
  const bucket = process.env.S3_BUCKET;
  const prefix = process.env.S3_EVIDENCE_PREFIX || 'evidence-records/';

  const jsonWithoutHash = JSON.stringify(record, null, 2);
  const sha256 = createHash('sha256').update(jsonWithoutHash).digest('hex');

  record.integrity = { sha256 };
  const finalJson = JSON.stringify(record, null, 2);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${prefix}${timestamp}-${sha256.slice(0, 8)}.json`;

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: finalJson,
    ContentType: 'application/json',
    Metadata: { 'x-sha256': sha256 },
  }));

  return {
    s3_uri: `s3://${bucket}/${key}`,
    sha256,
    record: JSON.parse(finalJson),
  };
}
