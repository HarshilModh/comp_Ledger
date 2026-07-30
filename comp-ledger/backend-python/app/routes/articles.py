import json
import re
import asyncio
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.lib.db import query, execute, fetchrow, fetchval
from app.lib.sanitize import slugify, sanitize_text, sanitize_title, sanitize_url
from app.services.article_ingest import ingest_article, remove_article_embeddings
from app.services.rss_poller import poll_publisher_rss
from app.services.publisher_pull import pull_from_publisher_api
from app.services.research.http import curl_get

router = APIRouter()


class ArticleBody(BaseModel):
    title: str
    body_text: str
    url: str | None = None
    byline: str | None = None
    published_at: str | None = None


class BulkBody(BaseModel):
    articles: list[ArticleBody]


class UrlBody(BaseModel):
    url: str


class BulkUrlBody(BaseModel):
    urls: list[str]


class PullConfigBody(BaseModel):
    url: str
    method: str = "GET"
    headers: dict = {}
    response_path: str = ""
    mapping: dict = {}
    pagination: dict = {"type": "none", "param": "page", "limit_param": "per_page", "limit": 20}


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/api/publishers/{id}/articles", status_code=201)
async def add_article(id: str, body: ArticleBody):
    row = await fetchrow("SELECT id FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    slug = slugify(body.title)
    art = await fetchrow(
        """INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (publisher_id, slug) DO UPDATE
           SET title = EXCLUDED.title, body_text = EXCLUDED.body_text,
               url = EXCLUDED.url, byline = EXCLUDED.byline, published_at = EXCLUDED.published_at
           RETURNING *""",
        id, body.title, body.url, slug, body.body_text, body.byline, body.published_at,
    )
    result = await ingest_article({"slug": slug, "body_text": body.body_text}, id)
    await execute(
        "INSERT INTO ingest_log (publisher_id, method, articles_imported, details) VALUES ($1, 'manual', 1, $2)",
        id, json.dumps({"title": body.title}),
    )
    return {**dict(art), "chunks_count": result["chunks_count"]}


@router.post("/api/publishers/{id}/articles/bulk")
async def bulk_articles(id: str, body: BulkBody):
    row = await fetchrow("SELECT id FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    results = {"imported": 0, "failed": 0, "errors": []}
    for i, art in enumerate(body.articles):
        slug = slugify(art.title, i)
        try:
            await execute(
                """INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   ON CONFLICT (publisher_id, slug) DO UPDATE SET title = EXCLUDED.title, body_text = EXCLUDED.body_text""",
                id, art.title, art.url, slug, art.body_text, art.byline, art.published_at,
            )
            await ingest_article({"slug": slug, "body_text": art.body_text}, id)
            results["imported"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"title": art.title, "error": str(e)})
    await execute(
        "INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_failed, details) VALUES ($1, 'bulk-json', $2, $3, $4)",
        id, results["imported"], results["failed"], json.dumps({"total": len(body.articles)}),
    )
    return results


@router.post("/api/publishers/{id}/articles/url", status_code=201)
async def url_article(id: str, body: UrlBody):
    row = await fetchrow("SELECT id FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0 (compatible; CoMP-Ledger/1.0)"}) as client:
            resp = await client.get(body.url)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch URL: {e}")

    from readability import Document
    doc = Document(html)
    title = sanitize_title(doc.title() or body.url)
    body_text = sanitize_text(re.sub(r"<[^>]+>", " ", doc.summary()))
    if len(body_text) < 50:
        raise HTTPException(400, "Could not extract article content from URL")

    slug = slugify(title)
    art = await fetchrow(
        """INSERT INTO articles (publisher_id, title, url, slug, body_text)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (publisher_id, slug) DO UPDATE SET title = EXCLUDED.title, body_text = EXCLUDED.body_text
           RETURNING *""",
        id, title, sanitize_url(body.url), slug, body_text,
    )
    result = await ingest_article({"slug": slug, "body_text": body_text}, id)
    await execute(
        "INSERT INTO ingest_log (publisher_id, method, articles_imported, details) VALUES ($1, 'url', 1, $2)",
        id, json.dumps({"url": body.url, "title": title}),
    )
    return {**dict(art), "chunks_count": result["chunks_count"]}


@router.post("/api/publishers/{id}/rss/poll")
async def poll_rss(id: str):
    row = await fetchrow("SELECT * FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    publisher = dict(row)
    if not publisher.get("rss_url"):
        raise HTTPException(400, "No RSS URL configured")
    result = await poll_publisher_rss(publisher)
    await execute(
        "INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_skipped, articles_failed) VALUES ($1, 'rss', $2, $3, $4)",
        id, result.get("new_articles", 0), result.get("skipped", 0), result.get("failed", 0),
    )
    return result


@router.get("/api/publishers/{id}/articles")
async def list_articles(id: str, limit: int = 50, offset: int = 0, search: str = ""):
    if search.strip():
        pat = f"%{search.strip()}%"
        total = await fetchval(
            "SELECT count(*) FROM articles WHERE publisher_id = $1 AND status = 'active' AND (title ILIKE $2 OR url ILIKE $2 OR byline ILIKE $2)",
            id, pat,
        )
        rows = await query(
            "SELECT id, title, url, slug, byline, published_at, ingested_at, status FROM articles WHERE publisher_id = $1 AND status = 'active' AND (title ILIKE $4 OR url ILIKE $4 OR byline ILIKE $4) ORDER BY ingested_at DESC LIMIT $2 OFFSET $3",
            id, limit, offset, pat,
        )
    else:
        total = await fetchval("SELECT count(*) FROM articles WHERE publisher_id = $1 AND status = 'active'", id)
        rows = await query(
            "SELECT id, title, url, slug, byline, published_at, ingested_at, status FROM articles WHERE publisher_id = $1 AND status = 'active' ORDER BY ingested_at DESC LIMIT $2 OFFSET $3",
            id, limit, offset,
        )
    return {"articles": [dict(r) for r in rows], "total": total, "limit": limit, "offset": offset}


@router.delete("/api/publishers/{id}/articles/{article_id}")
async def delete_article(id: str, article_id: str):
    row = await fetchrow(
        "UPDATE articles SET status = 'archived' WHERE id = $1 AND publisher_id = $2 RETURNING slug", article_id, id
    )
    if not row:
        raise HTTPException(404, "Article not found")
    await remove_article_embeddings(row["slug"], id)
    return {"success": True}


@router.get("/api/publishers/{id}/stats")
async def publisher_stats(id: str):
    articles_total = await fetchval("SELECT count(*) FROM articles WHERE publisher_id = $1 AND status = 'active'", id)
    embeddings_total = await fetchval("SELECT count(*) FROM embeddings WHERE publisher_id = $1", id)
    traces = await query("SELECT id, claims, created_at FROM traces ORDER BY created_at DESC LIMIT 200")
    slugs = {r["slug"] for r in await query("SELECT slug FROM articles WHERE publisher_id = $1 AND status = 'active'", id)}

    total_citations = traces_with_citations = 0
    cited: dict = {}
    for trace in traces:
        hit = False
        for claim in (trace["claims"] or []):
            slug = claim.get("match", {}).get("source_slug") or claim.get("match", {}).get("slug", "")
            if slug and slug in slugs:
                total_citations += 1
                hit = True
                cited[slug] = cited.get(slug, 0) + 1
        if hit:
            traces_with_citations += 1

    top_cited = sorted(cited.items(), key=lambda x: -x[1])[:10]
    activity = await query(
        "SELECT method, articles_imported, created_at FROM ingest_log WHERE publisher_id = $1 ORDER BY created_at DESC LIMIT 5", id
    )
    return {
        "articles": articles_total, "embeddings": embeddings_total,
        "total_citations": total_citations, "traces_with_citations": traces_with_citations,
        "top_cited": [{"slug": s, "citations": c} for s, c in top_cited],
        "recent_activity": [dict(r) for r in activity],
    }


@router.get("/api/publishers/{id}/activity")
async def publisher_activity(id: str, limit: int = 20):
    rows = await query(
        "SELECT * FROM ingest_log WHERE publisher_id = $1 ORDER BY created_at DESC LIMIT $2", id, limit
    )
    return {"entries": [dict(r) for r in rows]}


@router.post("/api/publishers/{id}/articles/bulk-url")
async def bulk_url(id: str, body: BulkUrlBody):
    row = await fetchrow("SELECT id FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    results = {"imported": 0, "failed": 0, "errors": []}
    for url in body.urls[:20]:
        try:
            import httpx
            from readability import Document
            async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                         headers={"User-Agent": "Mozilla/5.0 (compatible; CoMP-Ledger/1.0)"}) as client:
                resp = await client.get(url)
                resp.raise_for_status()
            doc = Document(resp.text)
            title = sanitize_title(doc.title() or url)
            body_text = sanitize_text(re.sub(r"<[^>]+>", " ", doc.summary()))
            if len(body_text) < 50:
                results["failed"] += 1
                results["errors"].append({"url": url, "error": "Content too short"})
                continue
            slug = slugify(title)
            await execute(
                """INSERT INTO articles (publisher_id, title, url, slug, body_text)
                   VALUES ($1, $2, $3, $4, $5) ON CONFLICT (publisher_id, slug) DO UPDATE SET title = EXCLUDED.title, body_text = EXCLUDED.body_text""",
                id, title, sanitize_url(url), slug, body_text,
            )
            await ingest_article({"slug": slug, "body_text": body_text}, id)
            results["imported"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append({"url": url, "error": str(e)})
    await execute(
        "INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_failed, details) VALUES ($1, 'bulk-url', $2, $3, $4)",
        id, results["imported"], results["failed"], json.dumps({"urls": len(body.urls)}),
    )
    return results


@router.put("/api/publishers/{id}/pull-config")
async def save_pull_config(id: str, body: PullConfigBody):
    await execute(
        "UPDATE publishers SET pull_config = $1, updated_at = now() WHERE id = $2",
        json.dumps(body.model_dump()), id,
    )
    return {"success": True, "config": body.model_dump()}


@router.delete("/api/publishers/{id}/pull-config")
async def delete_pull_config(id: str):
    await execute("UPDATE publishers SET pull_config = NULL, updated_at = now() WHERE id = $1", id)
    return {"success": True}


@router.put("/api/publishers/{id}/pull-schedule")
async def update_pull_schedule(id: str, request: Request):
    data = await request.json()
    schedule = data.get("schedule")
    if schedule not in (None, "hourly", "daily", "weekly"):
        raise HTTPException(400, "Invalid schedule")
    await execute("UPDATE publishers SET pull_schedule = $1, updated_at = now() WHERE id = $2", schedule, id)
    return {"success": True, "schedule": schedule}


@router.post("/api/publishers/{id}/pull")
async def trigger_pull(id: str):
    row = await fetchrow("SELECT * FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    publisher = dict(row)
    if not publisher.get("pull_config"):
        raise HTTPException(400, "No pull configuration set")
    result = await pull_from_publisher_api(publisher)
    if result.get("success"):
        await execute(
            "INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_skipped, articles_failed, details) VALUES ($1, 'pull-api', $2, $3, $4, $5)",
            id, result.get("imported", 0), result.get("skipped", 0), result.get("failed", 0),
            json.dumps({"total_fetched": result.get("total_fetched", 0)}),
        )
    return result


@router.post("/api/publishers/{id}/pull-test")
async def pull_test(id: str):
    row = await fetchrow("SELECT * FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    publisher = dict(row)
    config = publisher.get("pull_config")
    if not config:
        return {"success": False, "message": "No pull configuration set."}

    url = config["url"]
    headers = config.get("headers", {})
    response_path = config.get("response_path", "")
    mapping = config.get("mapping", {})

    curl_headers = []
    for k, v in headers.items():
        curl_headers += ["-H", f"{k}: {v}"]

    raw = await curl_get(url, 15, extra_args=curl_headers)
    if not raw:
        return {"success": False, "message": "No response from API"}
    try:
        parsed = json.loads(raw)
    except Exception:
        return {"success": False, "message": "Response is not valid JSON"}

    articles = parsed
    if response_path:
        for key in response_path.split("."):
            articles = articles.get(key) if isinstance(articles, dict) else None

    if not isinstance(articles, list):
        return {"success": False, "message": f"Expected array at path '{response_path or '(root)'}'. Got: {type(articles).__name__}",
                "keys": list(parsed.keys())[:10] if isinstance(parsed, dict) else []}

    preview = [{"title": a.get(mapping.get("title", "title"), "(missing)"),
                "body_length": len(a.get(mapping.get("body_text", "content"), "")),
                "url": a.get(mapping.get("url", "url"))} for a in articles[:3]]
    return {"success": True, "message": f"Connected! Found {len(articles)} articles.", "preview": preview}


async def crawl_generator(publisher_id: str, publisher: dict):
    domain = publisher["domain"]
    bare = re.sub(r"^www\.", "", domain)

    probe_targets = []
    if publisher.get("rss_url"):
        probe_targets.append(publisher["rss_url"])
    probe_targets += [
        f"https://{domain}/sitemap.xml", f"https://www.{bare}/sitemap.xml",
        f"https://{domain}/sitemap_index.xml", f"https://{domain}/news-sitemap.xml",
        f"https://{domain}/feed", f"https://www.{bare}/feed",
        f"https://{domain}/rss", f"https://{domain}/feed.xml", f"https://{domain}/rss.xml",
        f"https://rss.{bare}/services/xml/rss/nyt/HomePage.xml",
        f"https://feeds.{bare}/~r/{bare}/~3/all",
    ]

    yield sse("status", {"message": f"Probing {domain} for sitemaps and feeds…"})

    article_urls = []
    seen: set[str] = set()

    def add_url(url):
        if not url or url in seen or not url.startswith("http"):
            return
        seen.add(url)
        article_urls.append(url)

    ua = ["-A", "Mozilla/5.0 (compatible; CoMP-Ledger/1.0)", "-L", "--max-redirs", "3"]
    found = False

    for target in probe_targets:
        content = await curl_get(target, 12, extra_args=ua)
        if not content or len(content) < 100:
            continue

        is_sitemap = "<urlset" in content or "<sitemapindex" in content
        is_rss = "<rss" in content or "<feed" in content or "<channel" in content

        if is_sitemap:
            sub_sitemaps = [m.group(1) for m in re.finditer(r"<loc>(https?://[^<]+)</loc>", content)
                            if "sitemap" in m.group(1)]
            for sub in sub_sitemaps[:5]:
                sub_content = await curl_get(sub, 10)
                if sub_content:
                    for m in re.finditer(r"<loc>(https?://[^<]+)</loc>", sub_content):
                        u = m.group(1)
                        if "sitemap" not in u:
                            add_url(u)
            for m in re.finditer(r"<loc>(https?://[^<]+)</loc>", content):
                u = m.group(1)
                if "sitemap" not in u and ".xml" not in u:
                    add_url(u)
            if article_urls:
                found = True
                yield sse("status", {"message": f"Found {len(article_urls)} URLs in sitemap"})
                break

        if is_rss:
            for m in re.finditer(r"<link>(https?://[^<]+)</link>", content):
                u = m.group(1).strip()
                if bare in u:
                    add_url(u)
            for m in re.finditer(r'<link[^>]+href="(https?://[^"]+)"', content):
                u = m.group(1)
                if ".xml" not in u and "feed" not in u and "rss" not in u:
                    add_url(u)
            if article_urls:
                found = True
                yield sse("status", {"message": f"Found {len(article_urls)} URLs in RSS/Atom feed"})
                break

    if not found or not article_urls:
        yield sse("error", {"message": f"Could not discover any article URLs on {domain}. Try adding an RSS feed URL in Settings."})
        return

    to_process = article_urls[:100]
    yield sse("discovered", {"total": len(to_process)})

    imported = skipped = failed = 0
    from readability import Document
    for i, url in enumerate(to_process):
        yield sse("progress", {"current": i + 1, "total": len(to_process), "url": url,
                               "imported": imported, "skipped": skipped, "failed": failed})
        try:
            html = await curl_get(url, 12, extra_args=[
                "-H", "User-Agent: Mozilla/5.0 (compatible; CoMP-Ledger/1.0)",
                "-L", "--max-redirs", "3",
            ])
            if not html or len(html) < 500:
                failed += 1
                continue
            doc = Document(html)
            title = sanitize_title(doc.title() or url)
            body_text = sanitize_text(re.sub(r"<[^>]+>", " ", doc.summary()))
            if len(body_text) < 100:
                skipped += 1
                continue
            slug = slugify(title)
            row = await fetchrow(
                """INSERT INTO articles (publisher_id, title, url, slug, body_text)
                   VALUES ($1, $2, $3, $4, $5) ON CONFLICT (publisher_id, slug) DO NOTHING RETURNING id""",
                publisher_id, title, sanitize_url(url), slug, body_text,
            )
            if not row:
                skipped += 1
                continue
            await ingest_article({"slug": slug, "body_text": body_text}, publisher_id)
            imported += 1
        except Exception:
            failed += 1

    await execute(
        "INSERT INTO ingest_log (publisher_id, method, articles_imported, articles_skipped, articles_failed, details) VALUES ($1, 'crawl', $2, $3, $4, $5)",
        publisher_id, imported, skipped, failed, json.dumps({"domain": domain, "total": len(to_process)}),
    )
    yield sse("done", {"imported": imported, "skipped": skipped, "failed": failed, "total": len(to_process)})


@router.post("/api/publishers/{id}/crawl")
async def crawl(id: str):
    row = await fetchrow("SELECT * FROM publishers WHERE id = $1 AND status = 'active'", id)
    if not row:
        raise HTTPException(404, "Publisher not found")
    return StreamingResponse(
        crawl_generator(id, dict(row)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )
