import json
import os
from app.lib.bedrock import bedrock_client

MODEL_ID = os.getenv("EMBED_MODEL_ID", "amazon.titan-embed-text-v2:0")


def embed_text(text: str) -> list[float]:
    body = json.dumps({"inputText": text[:8000], "dimensions": 512, "normalize": True})
    response = bedrock_client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )
    result = json.loads(response["body"].read())
    return result["embedding"]


def embed_batch(texts: list[str]) -> list[list[float]]:
    results = []
    batch_size = 10
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        results.extend([embed_text(t) for t in batch])
    return results
