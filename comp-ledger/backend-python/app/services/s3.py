import hashlib
import json
import os
from datetime import datetime, timezone
import boto3

s3_client = boto3.client("s3", region_name=os.getenv("AWS_REGION", "us-east-1"))


def write_evidence_record(record: dict) -> dict:
    bucket = os.getenv("S3_BUCKET")
    prefix = os.getenv("S3_EVIDENCE_PREFIX", "evidence-records/")

    json_without_hash = json.dumps(record, indent=2)
    sha256 = hashlib.sha256(json_without_hash.encode()).hexdigest()

    record["integrity"] = {"sha256": sha256}
    final_json = json.dumps(record, indent=2)

    timestamp = datetime.now(timezone.utc).isoformat().replace(":", "-").replace(".", "-")
    key = f"{prefix}{timestamp}-{sha256[:8]}.json"

    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=final_json.encode(),
        ContentType="application/json",
        Metadata={"x-sha256": sha256},
    )

    return {"s3_uri": f"s3://{bucket}/{key}", "sha256": sha256, "record": json.loads(final_json)}
