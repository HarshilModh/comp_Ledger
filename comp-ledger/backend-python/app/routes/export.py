import hashlib
import json
from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.s3 import write_evidence_record

router = APIRouter()


class ExportBody(BaseModel):
    claims: list[dict]
    question: str
    answer: str
    publisher_name: str = "Silicon Insider"


@router.post("/api/export")
async def export_record(body: ExportBody):
    exclusive = [c for c in body.claims if c.get("exclusivity_score", 0) >= 0.5]
    fingerprinted = [c for c in body.claims if c.get("fingerprint", {}).get("detected")]

    record = {
        "version": "1.0",
        "type": "comp_evidence_record",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generator": "comp-ledger/0.1.0",
        "publisher": {"name": body.publisher_name, "archive_id": "silicon-insider-2024-q1"},
        "query": {"question": body.question, "answer": body.answer},
        "claims": [
            {
                "id": c.get("claim_id"),
                "text": c.get("claim_text"),
                "exclusivity_score": c.get("exclusivity_score"),
                "independent_source_count": c.get("exclusivity", {}).get("independent_source_count", 0),
                "match": c.get("match", {"found": False}),
                "fingerprint": c.get("fingerprint", {"detected": False}),
                "agreement_status": "covered" if c.get("agreement_active") else "unlicensed",
            }
            for c in body.claims
        ],
        "summary": {
            "total_claims": len(body.claims),
            "exclusive_claims": len(exclusive),
            "fingerprinted_claims": len(fingerprinted),
            "average_exclusivity": round(
                sum(c.get("exclusivity_score", 0) for c in body.claims) / len(body.claims), 2
            ) if body.claims else 0,
        },
    }

    try:
        return write_evidence_record(record)
    except Exception as e:
        j = json.dumps(record, indent=2)
        sha = hashlib.sha256(j.encode()).hexdigest()
        record["integrity"] = {"sha256": sha}
        return {"s3_uri": None, "s3_error": str(e), "sha256": sha, "record": record}
