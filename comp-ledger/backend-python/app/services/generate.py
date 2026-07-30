import json
import os
from app.lib.bedrock import bedrock_client

AVAILABLE_MODELS = [
    {"id": "us.anthropic.claude-haiku-4-5-20251001-v1:0", "label": "Claude Haiku 4.5"},
    {"id": "us.anthropic.claude-sonnet-4-20250514-v1:0",  "label": "Claude Sonnet 4"},
    {"id": "us.amazon.nova-micro-v1:0",                   "label": "Amazon Nova Micro"},
    {"id": "us.amazon.nova-lite-v1:0",                    "label": "Amazon Nova Lite"},
    {"id": "us.meta.llama3-1-8b-instruct-v1:0",           "label": "Llama 3.1 8B"},
]


def _make_prompt(question: str) -> str:
    return (
        "Answer the following question with specific, factual details in 3-6 sentences. "
        f"Include any known figures, dates, names, or amounts.\n\nQuestion: {question}"
    )


def generate_answer(question: str, model_id: str) -> str:
    p = _make_prompt(question)

    if "anthropic." in model_id:
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": p}],
        }
    elif "amazon.nova" in model_id:
        body = {
            "messages": [{"role": "user", "content": [{"text": p}]}],
            "inferenceConfig": {"maxTokens": 1024},
        }
    elif "meta.llama" in model_id:
        body = {
            "prompt": f"<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n{p}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n",
            "max_gen_len": 512,
            "temperature": 0.5,
        }
    elif "mistral." in model_id:
        body = {"prompt": f"<s>[INST] {p} [/INST]", "max_tokens": 512, "temperature": 0.5}
    else:
        raise ValueError(f"Unsupported model: {model_id}")

    response = bedrock_client.invoke_model(
        modelId=model_id,
        contentType="application/json",
        accept="application/json",
        body=json.dumps(body),
    )
    result = json.loads(response["body"].read())

    if "anthropic." in model_id:
        return result["content"][0]["text"].strip()
    if "amazon.nova" in model_id:
        return (result.get("output", {}).get("message", {}).get("content", [{}])[0].get("text", "")).strip()
    if "meta.llama" in model_id:
        return result.get("generation", "").strip()
    if "mistral." in model_id:
        return (result.get("outputs", [{}])[0].get("text", "")).strip()
    return ""
