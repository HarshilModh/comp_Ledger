import asyncio
import re
from app.lib.db import query, execute
from app.services.article_ingest import ingest_article
from app.services.research.http import curl_get

POLL_INTERVAL = 30 * 60  # seconds


def parse_rss_items(xml: str) -> list[dict]:
    items = []
    for block in re.findall(r"<item>([\s\S]*?)</item>", xml):
        title = (re.search(r"<title><!\[CDATA\[(.*?)\]\]>", block) or
                 re.search(r"<title>(.*?)</title>", block))
        link = re.search(r"<link>(.*?)</link>", block)
        pub_date = re.search(r"<pubDate>(.*?)</pubDate>", block)
        content = re.search(r"<content:encoded><!\[CDATA\[([\s\S]*?)\]\]>", block)
        description = (re.search(r"<description><!\[CDATA\[([\s\S]*?)\]\]>", block) or
                       re.search(r"<description>(.*?)</description>", block))

        title_text = title.group(1).strip() if title else ""
        link_text = link.group(1).strip() if link else ""
        body_html = (content.group(1) if content else "") or (description.group(1) if description else "")
        body_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body_html)).strip()

        if title_text and len(body_text) >= 50:
            items.append({
                "title": title_text,
                "link": link_text,
                "pub_date": pub_date.group(1) if pub_date else "",
                "body_text": body_text,
            })
    return items


def slugify(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]


async def poll_publisher_rss(publisher: dict) -> dict:
    publisher_id = publisher["id"]
    rss_url = publisher.get("rss_url")
    if not rss_url:
        return {"polled": False, "reason": "No RSS URL"}

    xml = await curl_get(rss_url, 20, extra_args=["-H", "User-Agent: CoMP-Ledger/1.0"])
    if not xml:
        return {"polled": False, "reason": "No response from RSS feed"}

    items = parse_rss_items(xml)
    if not items:
        return {"polled": True, "new_articles": 0}

    new_count = 0
    for item in items:
        slug = slugify(item["title"])
        existing = await query("SELECT id FROM articles WHERE publisher_id = $1 AND slug = $2", publisher_id, slug)
        if existing:
            continue
        try:
            from datetime import datetime
            pub_at = None
            if item["pub_date"]:
                try:
                    pub_at = datetime.strptime(item["pub_date"][:25], "%a, %d %b %Y %H:%M:%S")
                except Exception:
                    pass
            await execute(
                """INSERT INTO articles (publisher_id, title, url, slug, body_text, published_at)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                publisher_id, item["title"], item["link"] or None, slug, item["body_text"], pub_at,
            )
            await ingest_article({"slug": slug, "body_text": item["body_text"]}, publisher_id)
            new_count += 1
        except Exception:
            pass

    return {"polled": True, "new_articles": new_count, "total_items": len(items)}


_poll_task: asyncio.Task | None = None


async def _poll_loop():
    while True:
        try:
            rows = await query("SELECT * FROM publishers WHERE rss_url IS NOT NULL AND status = 'active'")
            for row in rows:
                await poll_publisher_rss(dict(row))
        except Exception as e:
            print(f"RSS poll error: {e}")
        await asyncio.sleep(POLL_INTERVAL)


def start_rss_poller():
    global _poll_task
    if _poll_task is None or _poll_task.done():
        _poll_task = asyncio.create_task(_poll_loop())


def stop_rss_poller():
    global _poll_task
    if _poll_task:
        _poll_task.cancel()
        _poll_task = None
