import json
import os
import re
from app.lib.bedrock import bedrock_client
from app.lib.prompts import DECOMPOSE_PROMPT

MODEL_ID = os.getenv("DECOMPOSE_MODEL_ID", "anthropic.claude-haiku-4-5-20251001-v1:0")


def decompose(question: str, answer: str) -> list[dict]:
    prompt = DECOMPOSE_PROMPT.replace("{question}", question).replace("{answer}", answer)
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 4096,
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
        claims = json.loads(text)
    except Exception:
        m = re.search(r"\[[\s\S]*\]", text)
        if not m:
            raise ValueError(f"Failed to parse claims from response: {text[:200]}")
        claims = json.loads(m.group())

    if not isinstance(claims, list):
        raise ValueError("Claims response is not a list")

    return [{"id": c.get("id", i + 1), "text": c["text"]} for i, c in enumerate(claims)]
