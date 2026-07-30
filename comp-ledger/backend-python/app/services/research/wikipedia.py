import httpx

BASE_URL = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "CoMP-Ledger/1.0 (fact-checking tool)"


async def search(claim: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            search_resp = await client.get(BASE_URL, params={
                "action": "query", "list": "search",
                "srsearch": claim[:300], "srlimit": "3", "format": "json",
            }, headers={"User-Agent": USER_AGENT})
            if not search_resp.is_success:
                return []
            pages = search_resp.json().get("query", {}).get("search", [])
            if not pages:
                return []

            titles = "|".join(p["title"] for p in pages)
            extract_resp = await client.get(BASE_URL, params={
                "action": "query", "titles": titles, "prop": "extracts|info",
                "exintro": "true", "explaintext": "true", "exsentences": "3",
                "inprop": "url", "format": "json",
            }, headers={"User-Agent": USER_AGENT})
            if not extract_resp.is_success:
                return []

            page_results = extract_resp.json().get("query", {}).get("pages", {}).values()
            return [
                {
                    "title": p["title"],
                    "url": p.get("fullurl", f"https://en.wikipedia.org/wiki/{p['title'].replace(' ', '_')}"),
                    "domain": "en.wikipedia.org",
                    "publishedAt": "",
                    "snippet": p.get("extract", "")[:400],
                    "sourceType": "WIKIPEDIA",
                }
                for p in page_results if p.get("pageid") and p.get("extract")
            ]
    except Exception:
        return []
