from fastapi import APIRouter, Request, HTTPException
from app.lib.db import query, fetchrow

router = APIRouter()


@router.get("/api/traces")
async def list_traces(limit: int = 50, offset: int = 0):
    limit = min(limit, 200)
    rows = await query(
        "SELECT id, question, answer, mode, claims, model_id, created_at FROM traces ORDER BY created_at DESC LIMIT $1 OFFSET $2",
        limit, offset,
    )
    return {"traces": [dict(r) for r in rows]}


@router.get("/api/traces/{id}")
async def get_trace(id: str):
    row = await fetchrow(
        "SELECT id, question, answer, mode, claims, model_id, created_at FROM traces WHERE id = $1", id
    )
    if not row:
        raise HTTPException(404, "Trace not found")
    return dict(row)
