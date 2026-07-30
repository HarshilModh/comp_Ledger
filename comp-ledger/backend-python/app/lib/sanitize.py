import re

MAX_BODY_LENGTH = 100_000


def sanitize_text(text: str) -> str:
    if not text or not isinstance(text, str):
        return ""
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_BODY_LENGTH]


def sanitize_url(url: str) -> str | None:
    if not url or not isinstance(url, str):
        return None
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        return None
    if re.search(r"javascript:|data:|vbscript:", url, re.IGNORECASE):
        return None
    return url[:2048]


def sanitize_title(title: str) -> str:
    if not title or not isinstance(title, str):
        return ""
    title = re.sub(r"[\x00-\x1F\x7F]", "", title)
    title = re.sub(r"<[^>]*>", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title[:500]


def slugify(title: str, idx: int = 0) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    return f"{base}-{idx}" if idx > 0 else base
