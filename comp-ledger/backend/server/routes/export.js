import { createHash } from 'crypto';
import { writeEvidenceRecord } from '../services/s3.js';

export default async function exportRoutes(fastify) {
  fastify.post('/api/export', async (request, reply) => {
    const { claims, question, answer, publisher_name = 'Silicon Insider' } = request.body;

    const exclusiveClaims = claims.filter(c => c.exclusivity_score >= 0.5);
    const fingerprintedClaims = claims.filter(c => c.fingerprint?.detected);

    const record = {
      version: '1.0',
      type: 'comp_evidence_record',
      generated_at: new Date().toISOString(),
      generator: 'comp-ledger/0.1.0',
      publisher: {
        name: publisher_name,
        archive_id: 'silicon-insider-2024-q1',
      },
      query: { question, answer },
      claims: claims.map(c => ({
        id: c.claim_id,
        text: c.claim_text,
        exclusivity_score: c.exclusivity_score,
        independent_source_count: c.exclusivity?.independent_source_count || 0,
        match: c.match || { found: false },
        fingerprint: c.fingerprint || { detected: false },
        agreement_status: c.agreement_active ? 'covered' : 'unlicensed',
      })),
      summary: {
        total_claims: claims.length,
        exclusive_claims: exclusiveClaims.length,
        fingerprinted_claims: fingerprintedClaims.length,
        average_exclusivity: claims.length > 0
          ? Math.round(claims.reduce((s, c) => s + c.exclusivity_score, 0) / claims.length * 100) / 100
          : 0,
      },
    };

    try {
      const result = await writeEvidenceRecord(record);
      return reply.send(result);
    } catch (err) {
      // Fallback: return the record without S3 write
      const json = JSON.stringify(record, null, 2);
      const sha256 = createHash('sha256').update(json).digest('hex');
      record.integrity = { sha256 };
      return reply.send({
        s3_uri: null,
        s3_error: err.message,
        sha256,
        record,
      });
    }
  });
}
