import json
import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.decompose import decompose
from app.services.embed import embed_text
from app.services.retrieve import retrieve_candidates
from app.services.score import score_claim, compute_exclusivity_score
from app.lib.db import query, execute, fetchrow

router = APIRouter()


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


class ArticleCheckBody(BaseModel):
    question: str
    answer: str
    publisher_id: str


async def run_article_check(question: str, answer: str, publisher_id: str):
    claims = await asyncio.to_thread(decompose, question, answer)
    yield sse("claims_count", {"total": len(claims)})

    scored = []
    for claim in claims:
        try:
            vec = await asyncio.to_thread(embed_text, claim["text"])
            candidates = await retrieve_candidates(vec, 5, publisher_id)
            result = await asyncio.to_thread(
                score_claim, claim["text"],
                candidates["publisher_hits"], candidates["reference_hits"]
            )
            score = compute_exclusivity_score(
                result.get("exclusivity", {}).get("independent_source_count", 0),
                result.get("fingerprint", {}).get("detected", False),
            )
            event = {"claim_id": claim["id"], "claim_text": claim["text"], "mode": "article-check",
                     **result, "exclusivity_score": score}
        except Exception as e:
            event = {"claim_id": claim["id"], "claim_text": claim["text"], "mode": "article-check",
                     "scoring_failed": True, "error": str(e), "exclusivity_score": 0}
        scored.append(event)
        yield sse("claim_scored", event)

    yield sse("done", {})
    try:
        await execute(
            "INSERT INTO traces (question, answer, mode, claims, model_id) VALUES ($1, $2, $3, $4, $5)",
            question, answer, "article-check", json.dumps(scored), publisher_id,
        )
    except Exception:
        pass


@router.post("/api/article-check")
async def article_check(body: ArticleCheckBody):
    row = await fetchrow("SELECT id FROM publishers WHERE id = $1 AND status = 'active'", body.publisher_id)
    if not row:
        raise HTTPException(404, "Publisher not found")

    return StreamingResponse(
        run_article_check(body.question, body.answer, body.publisher_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
