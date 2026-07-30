from app.services.research.http import curl_get_json

CDX_URL = "https://web.archive.org/cdx/search/cdx"


async def verify_urls(urls: list[str]) -> list[dict]:
    results = []
    for url in urls[:5]:
        try:
            params = f"url={url}&output=json&fl=timestamp,original,statuscode&limit=1&sort=asc"
            data = await curl_get_json(f"{CDX_URL}?{params}", 8)
            if not data or len(data) < 2:
                continue
            row = data[1]
            timestamp, original, statuscode = row[0], row[1], row[2]
            if statuscode != "200":
                continue
            archived_at = f"{timestamp[:4]}-{timestamp[4:6]}-{timestamp[6:8]}"
            results.append({
                "url": original,
                "archivedAt": archived_at,
                "waybackUrl": f"https://web.archive.org/web/{timestamp}/{original}",
                "sourceType": "WAYBACK",
            })
        except Exception:
            continue
    return results
