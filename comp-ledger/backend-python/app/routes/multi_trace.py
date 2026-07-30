import json
import asyncio
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.generate import generate_answer, AVAILABLE_MODELS
from app.services.decompose import decompose
from app.services.embed import embed_text
from app.services.retrieve import retrieve_candidates
from app.services.score import score_claim, compute_exclusivity_score
from app.lib.db import execute

router = APIRouter()


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def trace_answer(question: str, answer: str) -> list[dict]:
    claims = await asyncio.to_thread(decompose, question, answer)
    results = []
    for claim in claims:
        try:
            vec = await asyncio.to_thread(embed_text, claim["text"])
            candidates = await retrieve_candidates(vec)
            result = await asyncio.to_thread(
                score_claim, claim["text"],
                candidates["publisher_hits"], candidates["reference_hits"]
            )
            score = compute_exclusivity_score(
                result.get("exclusivity", {}).get("independent_source_count", 0),
                result.get("fingerprint", {}).get("detected", False),
            )
            results.append({"claim_id": claim["id"], "claim_text": claim["text"], **result, "exclusivity_score": score})
        except Exception:
            results.append({"claim_id": claim["id"], "claim_text": claim["text"],
                            "scoring_failed": True, "exclusivity_score": 0})
    return results


class MultiTraceBody(BaseModel):
    question: str
    modelIds: list[str] | None = None


async def run_multi_trace(question: str, model_ids: list[str] | None):
    models = (
        [m for m in AVAILABLE_MODELS if m["id"] in model_ids] if model_ids
        else AVAILABLE_MODELS
    )
    yield sse("models", {"models": [{"id": m["id"], "label": m["label"]} for m in models]})

    async def process_model(model):
        events = []
        try:
            events.append(sse("model_start", {"modelId": model["id"]}))
            answer = await asyncio.to_thread(generate_answer, question, model["id"])
            events.append(sse("model_answer", {"modelId": model["id"], "answer": answer}))
            claims = await trace_answer(question, answer)
            events.append(sse("model_done", {"modelId": model["id"], "claims": claims}))
            try:
                await execute(
                    "INSERT INTO traces (question, answer, mode, claims, model_id) VALUES ($1, $2, $3, $4, $5)",
                    question, answer, "multi", json.dumps(claims), model["id"],
                )
            except Exception:
                pass
        except Exception as e:
            events.append(sse("model_error", {"modelId": model["id"], "error": str(e)}))
        return events

    tasks = [process_model(m) for m in models]
    for result in await asyncio.gather(*tasks):
        for event in result:
            yield event

    yield sse("done", {})


@router.post("/api/multi-trace")
async def multi_trace(body: MultiTraceBody):
    return StreamingResponse(
        run_multi_trace(body.question, body.modelIds),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/api/models")
async def get_models():
    return {"models": AVAILABLE_MODELS}
