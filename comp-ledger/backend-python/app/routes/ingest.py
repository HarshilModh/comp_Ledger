import os
import secrets
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.lib.db import query, execute, fetchrow
from app.services.article_ingest import ingest_article
from app.lib.sanitize import slugify

router = APIRouter()


class ArticleBody(BaseModel):
    title: str
    body_text: str
    url: str | None = None
    byline: str | None = None
    published_at: str | None = None


class BatchBody(BaseModel):
    articles: list[ArticleBody]


async def authenticate_api_key(request: Request):
    auth = request.headers.get("authorization", "")
    key = auth[7:].strip() if auth.startswith("Bearer ") else request.headers.get("x-api-key", "").strip()
    if not key:
        raise HTTPException(401, "Missing API key")
    row = await fetchrow("SELECT * FROM publishers WHERE api_key = $1 AND status = 'active'", key)
    if not row:
        raise HTTPException(403, "Invalid or inactive API key")
    return dict(row)


@router.post("/api/ingest", status_code=201)
async def ingest_single(body: ArticleBody, request: Request):
    publisher = await authenticate_api_key(request)
    slug = slugify(body.title)
    row = await fetchrow(
        """INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (publisher_id, slug) DO UPDATE
           SET title = EXCLUDED.title, body_text = EXCLUDED.body_text,
               url = EXCLUDED.url, byline = EXCLUDED.byline, published_at = EXCLUDED.published_at
           RETURNING id, title, slug, ingested_at""",
        publisher["id"], body.title, body.url, slug, body.body_text, body.byline, body.published_at,
    )
    article = dict(row)
    result = await ingest_article({"slug": slug, "body_text": body.body_text}, publisher["id"])
    await execute(
        "INSERT INTO ingest_log (publisher_id, method, articles_imported, details) VALUES ($1, 'push-api', 1, $2)",
        publisher["id"], '{"title": "' + body.title + '"}',
    )
    return {"success": True, "article_id": article["id"], "title": article["title"],
            "slug": article["slug"], "chunks_indexed": result["chunks_count"]}


@router.post("/api/ingest/batch")
async def ingest_batch(body: BatchBody, request: Request):
    publisher = await authenticate_api_key(request)
    results = {"imported": 0, "failed": 0, "articles": []}
    for i, art in enumerate(body.articles):
        slug = slugify(art.title, i)
        try:
            row = await fetchrow(
                """INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (publisher_id, slug) DO UPDATE
                   SET title = EXCLUDED.title, body_text = EXCLUDED.body_text
                   RETURNING id, title, slug""",
                publisher["id"], art.title, art.url, slug, art.body_text, art.byline, art.published_at,
            )
            r = await ingest_article({"slug": slug, "body_text": art.body_text}, publisher["id"])
            results["imported"] += 1
            results["articles"].append({"id": str(row["id"]), "title": art.title, "chunks": r["chunks_count"]})
        except Exception as e:
            results["failed"] += 1
            results["articles"].append({"title": art.title, "error": str(e)})
    return results


@router.post("/api/webhook/{publisher_id}", status_code=201)
async def webhook_ingest(publisher_id: str, body: ArticleBody, request: Request):
    row = await fetchrow("SELECT * FROM publishers WHERE id = $1 AND status = 'active'", publisher_id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    publisher = dict(row)
    token = request.headers.get("x-webhook-secret", "") or request.headers.get("x-api-key", "")
    if publisher.get("api_key") and token != publisher["api_key"]:
        raise HTTPException(403, "Invalid webhook secret")

    slug = slugify(body.title)
    art_row = await fetchrow(
        """INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (publisher_id, slug) DO UPDATE
           SET title = EXCLUDED.title, body_text = EXCLUDED.body_text
           RETURNING id, title, slug, ingested_at""",
        publisher["id"], body.title, body.url, slug, body.body_text, body.byline, body.published_at,
    )
    result = await ingest_article({"slug": slug, "body_text": body.body_text}, publisher["id"])
    return {"success": True, "article_id": str(art_row["id"]), "title": art_row["title"],
            "chunks_indexed": result["chunks_count"]}


@router.post("/api/publishers/{id}/api-key")
async def generate_api_key(id: str):
    row = await fetchrow("SELECT id FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    key = f"cl_{secrets.token_hex(24)}"
    await execute("UPDATE publishers SET api_key = $1, updated_at = now() WHERE id = $2", key, id)
    return {"api_key": key}


@router.delete("/api/publishers/{id}/api-key")
async def revoke_api_key(id: str):
    await execute("UPDATE publishers SET api_key = NULL, updated_at = now() WHERE id = $1", id)
    return {"success": True}
