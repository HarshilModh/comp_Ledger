import json
import os
import re
from app.lib.bedrock import bedrock_client
from app.lib.prompts import SCORE_PROMPT

MODEL_ID = os.getenv("SCORE_MODEL_ID", "anthropic.claude-sonnet-4-20250514-v1:0")


def compute_exclusivity_score(independent_source_count: int, fingerprint_detected: bool) -> float:
    base = max(0.05, 1.0 / (1 + independent_source_count * 0.8))
    bonus = 0.15 if fingerprint_detected else 0
    return round(min(1.0, base + bonus), 2)


def score_claim(claim_text: str, publisher_hits: list, reference_hits: list) -> dict:
    pub_candidates = "\n".join(
        f'[{i+1}] ({h["doc_id"]}, paragraph {h["chunk_idx"]}): "{h["text"]}"'
        for i, h in enumerate(publisher_hits)
    ) or "No candidates found."

    ref_candidates = "\n".join(
        f'[{i+1}] ({h["doc_id"]}): "{h["text"]}"'
        for i, h in enumerate(reference_hits)
    ) or "No candidates found."

    prompt = (
        SCORE_PROMPT
        .replace("{claim_text}", claim_text)
        .replace("{publisher_candidates}", pub_candidates)
        .replace("{reference_candidates}", ref_candidates)
    )

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    })
    response = bedrock_client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )
    result = json.loads(response["body"].read())
    text = result["content"][0]["text"]

    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            return json.loads(m.group())
        return {
            "match": {"found": False},
            "exclusivity": {"independent_source_count": 0, "sources": [], "reasoning": "Scoring failed"},
            "fingerprint": {"detected": False},
        }
