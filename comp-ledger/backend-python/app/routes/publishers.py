from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from app.lib.db import query, execute, fetchrow
from app.routes.auth import get_current_user

router = APIRouter()


class PublisherCreate(BaseModel):
    name: str
    email: str
    publication: str
    domain: str
    alt_domains: list[str] = []
    rss_url: str | None = None


class PublisherUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    publication: str | None = None
    domain: str | None = None
    alt_domains: list[str] | None = None
    rss_url: str | None = None


@router.post("/api/publishers", status_code=201)
async def create_publisher(body: PublisherCreate):
    row = await fetchrow(
        """INSERT INTO publishers (name, email, publication, domain, alt_domains, rss_url)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *""",
        body.name, body.email, body.publication, body.domain.lower(), body.alt_domains, body.rss_url,
    )
    return dict(row)


@router.get("/api/publishers")
async def list_publishers(request: Request):
    user = get_current_user(request)
    if user and user.get("role") == "admin":
        rows = await query("SELECT * FROM publishers WHERE status = 'active' ORDER BY created_at DESC")
    elif user:
        rows = await query("SELECT * FROM publishers WHERE id = $1 AND status = 'active'", user["id"])
    else:
        rows = await query("SELECT * FROM publishers WHERE status = 'active' ORDER BY created_at DESC")
    return [{k: v for k, v in dict(r).items() if k != "password_hash"} for r in rows]


@router.get("/api/publishers/{id}")
async def get_publisher(id: str, request: Request):
    user = get_current_user(request)
    if user and user.get("role") != "admin" and user.get("id") != id:
        raise HTTPException(403, "Access denied")
    row = await fetchrow("SELECT * FROM publishers WHERE id = $1", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    pub = dict(row)
    pub.pop("password_hash", None)
    return pub


@router.put("/api/publishers/{id}")
async def update_publisher(id: str, body: PublisherUpdate):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields to update")

    set_clauses = []
    values = []
    for i, (k, v) in enumerate(fields.items(), 1):
        set_clauses.append(f"{k} = ${i}")
        values.append(v.lower() if k == "domain" else v)
    set_clauses.append("updated_at = now()")
    values.append(id)

    row = await fetchrow(
        f"UPDATE publishers SET {', '.join(set_clauses)} WHERE id = ${len(values)} AND status != 'suspended' RETURNING *",
        *values,
    )
    if not row:
        raise HTTPException(404, "Publisher not found")
    return dict(row)


@router.delete("/api/publishers/{id}")
async def delete_publisher(id: str):
    row = await fetchrow(
        "UPDATE publishers SET status = 'suspended', updated_at = now() WHERE id = $1 RETURNING id", id
    )
    if not row:
        raise HTTPException(404, "Publisher not found")
    return {"success": True}
