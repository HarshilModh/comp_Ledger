import json
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.decompose import decompose
from app.services.embed import embed_text
from app.services.retrieve import retrieve_candidates
from app.services.score import score_claim, compute_exclusivity_score
from app.services.research.deep_research import deep_research
from app.lib.db import execute, fetchrow

router = APIRouter()


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


class DeepTraceBody(BaseModel):
    question: str
    answer: str
    publisher_id: str


async def local_pipeline(claim_text: str, publisher_id: str) -> dict:
    vec = await asyncio.to_thread(embed_text, claim_text)
    candidates = await retrieve_candidates(vec, 5, publisher_id)
    result = await asyncio.to_thread(
        score_claim, claim_text, candidates["publisher_hits"], candidates["reference_hits"]
    )
    score = compute_exclusivity_score(
        result.get("exclusivity", {}).get("independent_source_count", 0),
        result.get("fingerprint", {}).get("detected", False),
    )
    return {**result, "exclusivity_score": score}


def merge_results(claim: dict, local: dict, research: dict) -> dict:
    judge = research.get("judge", {})
    boost = 0.2 if judge.get("verdict") == "CONFIRMED" else 0.1 if judge.get("verdict") == "LIKELY" else 0
    final_score = round(min(1.0, (local.get("exclusivity_score", 0) + boost)), 2)
    return {
        "claim_id": claim["id"],
        "claim_text": claim["text"],
        "mode": "deep-research",
        **local,
        "exclusivity_score": final_score,
        "research": {
            "verdict": judge.get("verdict", "INSUFFICIENT_DATA"),
            "confidence": judge.get("confidence", 0),
            "reasoning": judge.get("reasoning", ""),
            "temporal_priority": judge.get("temporal_priority", False),
            "earliest_publisher_date": judge.get("earliest_publisher_date"),
            "publisher_url": judge.get("publisher_url"),
            "source_count": research.get("source_count", 0),
            "publisher_source_count": research.get("publisher_source_count", 0),
            "sources": research.get("sources", []),
        },
    }


async def run_deep_trace(question: str, answer: str, publisher: dict):
    publisher_id = str(publisher["id"])
    claims = await asyncio.to_thread(decompose, question, answer)
    yield sse("claims_count", {"total": len(claims)})

    scored = []
    for claim in claims:
        yield sse("research_start", {"claim_id": claim["id"], "claim_text": claim["text"],
                                     "publisher_domain": publisher["domain"]})
        sources_buffer = []

        def on_source(s):
            sources_buffer.append(s)

        try:
            local_result, research_result = await asyncio.gather(
                local_pipeline(claim["text"], publisher_id),
                deep_research(claim["text"], dict(publisher), on_source=on_source),
            )
            for s in sources_buffer:
                yield sse("research_source", {"claim_id": claim["id"], "source": s})

            merged = merge_results(claim, local_result, research_result)
        except Exception as e:
            merged = {"claim_id": claim["id"], "claim_text": claim["text"], "mode": "deep-research",
                      "scoring_failed": True, "error": str(e), "exclusivity_score": 0}

        scored.append(merged)
        yield sse("claim_scored", merged)

    trace_id = None
    try:
        row = await execute(
            "INSERT INTO traces (question, answer, mode, claims, model_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            question, answer, "deep-research", json.dumps(scored), publisher_id,
        )
        trace_id = row
    except Exception:
        pass

    yield sse("done", {"trace_id": trace_id})


@router.post("/api/deep-trace")
async def deep_trace(body: DeepTraceBody):
    row = await fetchrow("SELECT * FROM publishers WHERE id = $1 AND status = 'active'", body.publisher_id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    return StreamingResponse(
        run_deep_trace(body.question, body.answer, dict(row)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
