import json
import re
from app.lib.db import query, execute
from app.services.article_ingest import ingest_article
from app.services.research.http import curl_get


def slugify(title: str, idx: int = 0) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    return f"{base}-{idx}" if idx > 0 else base


def get_nested(obj, path: str):
    if not path:
        return obj
    for key in path.split("."):
        if obj is None:
            return None
        obj = obj.get(key) if isinstance(obj, dict) else None
    return obj


def map_article(raw: dict, mapping: dict) -> dict:
    return {
        "title": raw.get(mapping.get("title", "title"), ""),
        "body_text": raw.get(mapping.get("body_text", "body_text"), raw.get(mapping.get("body_text", "content"), "")),
        "url": raw.get(mapping.get("url", "url")),
        "byline": raw.get(mapping.get("byline", "byline"), raw.get("author")),
        "published_at": raw.get(mapping.get("published_at", "published_at")),
    }


async def pull_from_publisher_api(publisher: dict) -> dict:
    config = publisher.get("pull_config")
    if not config or not config.get("url"):
        return {"success": False, "reason": "No pull config or URL set"}

    url = config["url"]
    headers = config.get("headers", {})
    mapping = config.get("mapping", {})
    pagination = config.get("pagination", {})
    response_path = config.get("response_path", "")

    all_articles = []
    page = 1
    max_pages = 5

    curl_headers = []
    for k, v in headers.items():
        curl_headers += ["-H", f"{k}: {v}"]

    while page <= max_pages:
        fetch_url = url
        if pagination.get("type") == "offset":
            sep = "&" if "?" in fetch_url else "?"
            fetch_url += f"{sep}{pagination.get('param', 'page')}={page}"
            if pagination.get("limit_param"):
                fetch_url += f"&{pagination['limit_param']}={pagination.get('limit', 20)}"
        elif pagination.get("type") == "cursor" and page > 1:
            break

        raw = await curl_get(fetch_url, 30, extra_args=curl_headers)
        if not raw:
            if page == 1:
                return {"success": False, "reason": "Failed to fetch: no response"}
            break

        try:
            parsed = json.loads(raw)
        except Exception as e:
            if page == 1:
                return {"success": False, "reason": f"Failed to parse JSON: {e}"}
            break

        articles = get_nested(parsed, response_path) if response_path else parsed
        if not isinstance(articles, list) or len(articles) == 0:
            break

        all_articles.extend(articles)
        if not pagination or pagination.get("type") == "none":
            break
        if len(articles) < pagination.get("limit", 20):
            break
        page += 1

    if not all_articles:
        return {"success": True, "imported": 0, "reason": "No articles returned from API"}

    imported = skipped = failed = 0
    for i, raw_article in enumerate(all_articles):
        mapped = map_article(raw_article, mapping)
        if not mapped["title"] or not mapped["body_text"] or len(mapped["body_text"]) < 50:
            skipped += 1
            continue

        slug = slugify(mapped["title"], i)
        try:
            existing = await query("SELECT id FROM articles WHERE publisher_id = $1 AND slug = $2",
                                   publisher["id"], slug)
            if existing:
                skipped += 1
                continue
            await execute(
                """INSERT INTO articles (publisher_id, title, url, slug, body_text, byline, published_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                publisher["id"], mapped["title"], mapped["url"], slug,
                mapped["body_text"], mapped["byline"], mapped["published_at"],
            )
            await ingest_article({"slug": slug, "body_text": mapped["body_text"]}, publisher["id"])
            imported += 1
        except Exception:
            failed += 1

    return {"success": True, "imported": imported, "skipped": skipped, "failed": failed,
            "total_fetched": len(all_articles)}
