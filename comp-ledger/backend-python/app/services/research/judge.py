import json
import os
import re
from app.lib.bedrock import bedrock_client
from app.lib.prompts import RESEARCH_JUDGE_PROMPT

MODEL_ID = os.getenv("RESEARCH_JUDGE_MODEL_ID",
                     os.getenv("SCORE_MODEL_ID", "anthropic.claude-sonnet-4-20250514-v1:0"))


def judge_evidence(claim: str, publisher: dict, sources: list[dict], wayback_results: list[dict]) -> dict:
    formatted_sources = "\n\n".join(
        f"[{i+1}] {s['sourceType']} | {s['domain']} | {s.get('publishedAt', 'date unknown')}\n"
        f"    Title: {s['title']}\n    URL: {s['url']}\n    Snippet: {s['snippet']}"
        for i, s in enumerate(sources)
    ) or "No sources found."

    wayback_evidence = "\n".join(
        f"URL: {w['url']}\n  First archived: {w['archivedAt']}\n  Wayback: {w['waybackUrl']}"
        for w in wayback_results
    ) or "No Wayback results."

    prompt = (
        RESEARCH_JUDGE_PROMPT
        .replace("{claim_text}", claim)
        .replace("{publication}", publisher["publication"])
        .replace("{domain}", publisher["domain"])
        .replace("{formatted_sources}", formatted_sources)
        .replace("{wayback_evidence}", wayback_evidence)
    )

    response = bedrock_client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        }),
    )
    text = json.loads(response["body"].read())["content"][0]["text"]

    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            return json.loads(m.group())
        return {
            "verdict": "INSUFFICIENT_DATA", "confidence": 0,
            "reasoning": "Failed to parse judge response",
            "temporal_priority": False, "earliest_publisher_date": None,
            "publisher_url": None, "alternative_sources_count": 0,
        }
