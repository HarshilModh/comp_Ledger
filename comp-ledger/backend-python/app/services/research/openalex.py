import re
from urllib.parse import quote
from app.services.research.http import curl_get_json

API_URL = "https://api.openalex.org/works"


async def search(claim: str) -> list[dict]:
    try:
        words = [w for w in re.sub(r"[^a-zA-Z0-9\s]", "", claim).split() if len(w) > 3][:6]
        if not words:
            return []
        q = quote(" ".join(words))
        data = await curl_get_json(f"{API_URL}?search={q}&per_page=4&mailto=comp-ledger@example.com", 10)
        if not data or not data.get("results"):
            return []
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("doi") or r.get("id", ""),
                "domain": "openalex.org",
                "publishedAt": r.get("publication_date", ""),
                "snippet": r.get("title", ""),
                "sourceType": "OPENALEX",
                "isPublisherDomain": False,
            }
            for r in data["results"]
        ]
    except Exception:
        return []
