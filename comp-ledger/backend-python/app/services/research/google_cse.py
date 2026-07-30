import os
from app.services.research.http import curl_get_json

API_URL = "https://www.googleapis.com/customsearch/v1"


async def search(claim: str, domain: str = "") -> list[dict]:
    api_key = os.getenv("GOOGLE_CSE_KEY")
    cx = os.getenv("GOOGLE_CSE_CX")
    if not api_key or not cx:
        return []

    try:
        params = f"key={api_key}&cx={cx}&q={claim[:200].replace(' ', '+')}&num=5"
        data = await curl_get_json(f"{API_URL}?{params}", 10)
        if not data:
            return []
        if "error" in data:
            return []

        results = []
        for item in data.get("items", []):
            try:
                from urllib.parse import urlparse
                item_domain = urlparse(item["link"]).hostname.replace("www.", "")
            except Exception:
                item_domain = ""

            pub_at = (
                (item.get("pagemap", {}).get("metatags", [{}])[0].get("article:published_time") or
                 item.get("pagemap", {}).get("metatags", [{}])[0].get("og:updated_time") or "")
            )
            results.append({
                "title": item.get("title", ""),
                "url": item.get("link", ""),
                "domain": item_domain,
                "publishedAt": pub_at,
                "snippet": item.get("snippet", ""),
                "sourceType": "GOOGLE_CSE",
                "isPublisherDomain": domain in item_domain if domain else False,
            })
        return results
    except Exception:
        return []
