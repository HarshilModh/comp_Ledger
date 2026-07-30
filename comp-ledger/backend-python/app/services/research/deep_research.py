import asyncio
from app.services.research import wikipedia, google_cse, openalex, wayback
from app.services.research.judge import judge_evidence


async def deep_research(claim: str, publisher: dict, on_source=None) -> dict:
    domain = publisher["domain"]
    alt_domains = publisher.get("alt_domains") or []
    all_domains = {d.lower() for d in [domain] + list(alt_domains)}

    wiki, google, alex = await asyncio.gather(
        wikipedia.search(claim),
        google_cse.search(claim, domain=domain),
        openalex.search(claim),
    )

    all_sources = wiki + google + alex

    if on_source:
        for s in all_sources:
            on_source(s)

    publisher_hits = [
        s for s in all_sources
        if s.get("domain", "").lower() in all_domains or s.get("isPublisherDomain")
    ]

    urls_to_verify = [s["url"] for s in all_sources if s.get("url")][:5]
    wayback_results = await wayback.verify_urls(urls_to_verify) if urls_to_verify else []

    if on_source:
        for w in wayback_results:
            on_source({**w, "title": "Wayback Machine confirmation", "snippet": f"First archived: {w['archivedAt']}"})

    judge = judge_evidence(claim, publisher, all_sources, wayback_results)

    return {
        "claim_text": claim,
        "publisher_domain": domain,
        "sources": all_sources,
        "publisher_sources": publisher_hits,
        "temporal_evidence": wayback_results,
        "judge": judge,
        "source_count": len(all_sources),
        "publisher_source_count": len(publisher_hits),
    }
