import json
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.decompose import decompose
from app.services.embed import embed_text
from app.services.retrieve import retrieve_candidates
from app.services.score import score_claim, compute_exclusivity_score
from app.services.generate import generate_answer, AVAILABLE_MODELS
from app.lib.db import execute

router = APIRouter()


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def run_trace(question: str, answer: str, mode: str, auto: bool, model_id: str):
    if auto:
        yield sse("generating", {"modelId": model_id})
        chosen = model_id or AVAILABLE_MODELS[0]["id"]
        answer = await asyncio.to_thread(generate_answer, question, chosen)
        yield sse("answer", {"answer": answer, "modelId": chosen})

    if not answer or not answer.strip():
        yield sse("error", {"error": "No answer to trace"})
        return

    claims = await asyncio.to_thread(decompose, question, answer)
    yield sse("claims_count", {"total": len(claims)})

    scored = []
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
            event = {"claim_id": claim["id"], "claim_text": claim["text"], "mode": mode,
                     **result, "exclusivity_score": score}
        except Exception as e:
            event = {"claim_id": claim["id"], "claim_text": claim["text"], "mode": mode,
                     "scoring_failed": True, "error": str(e), "exclusivity_score": 0}
        scored.append(event)
        yield sse("claim_scored", event)

    yield sse("done", {})

    try:
        await execute(
            "INSERT INTO traces (question, answer, mode, claims) VALUES ($1, $2, $3, $4)",
            question, answer, mode, json.dumps(scored),
        )
    except Exception:
        pass


class TraceBody(BaseModel):
    question: str
    answer: str | None = None
    mode: str = "audit"
    auto: bool = False
    modelId: str | None = None


@router.post("/api/trace")
async def trace(body: TraceBody, request: Request):
    model_id = body.modelId or AVAILABLE_MODELS[0]["id"]

    return StreamingResponse(
        run_trace(body.question, body.answer or "", body.mode, body.auto, model_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
