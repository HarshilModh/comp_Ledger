DECOMPOSE_PROMPT = """You are a claim extraction engine. Given an AI-generated answer to a reader question, extract every discrete factual claim as a JSON array.

Rules:
- Each claim is ONE atomic fact (who/what/when/where/how much)
- Strip opinion, hedging, and meta-commentary
- Preserve specifics: numbers, names, dates, technical terms
- Return 5-15 claims for a typical paragraph answer
- Output ONLY valid JSON, no markdown fencing

Input question: {question}
Input answer: {answer}

Output format:
[
  {{"id": 1, "text": "Tesla announced a $25,000 compact vehicle at its March 2024 investor day"}},
  {{"id": 2, "text": "The vehicle will use a new manufacturing process called unboxed assembly"}}
]"""

SCORE_PROMPT = """You are an exclusivity scoring engine for content licensing analysis. Given a claim extracted from an AI answer, plus candidate passages from a publisher's archive and from a reference corpus of other sources, produce a structured assessment.

Claim: {claim_text}

Publisher archive candidates (from one specific publisher):
{publisher_candidates}

Reference corpus candidates (from other public sources):
{reference_candidates}

Score this claim on three axes:

1. MATCH: Does the claim appear in the publisher's archive? If yes, quote the specific sentence.
2. EXCLUSIVITY: How many genuinely independent sources in the reference corpus also carry this exact claim? Count only sources that independently report the same specific fact, not sources covering the same general topic.
3. FINGERPRINT: Does the AI answer's version of this claim reproduce something idiosyncratic to the publisher's version? Look for: distinctive phrasing, unusual framing, specific ordering of sub-claims, a factual error unique to this source, or a distinctive metaphor/analogy.

Output ONLY valid JSON:
{{
  "match": {{
    "found": true,
    "publisher_passage": "exact quote from publisher archive",
    "doc_id": "filename",
    "paragraph_idx": 0
  }},
  "exclusivity": {{
    "independent_source_count": 2,
    "sources": ["source1.txt", "source2.txt"],
    "reasoning": "One sentence explaining why you counted this many independent sources"
  }},
  "fingerprint": {{
    "detected": true,
    "type": "distinctive_phrasing",
    "publisher_version": "the original phrasing from the publisher",
    "ai_version": "how the AI reproduced it",
    "explanation": "Why this is idiosyncratic rather than standard reporting language"
  }}
}}

If match is not found, set match.found to false and omit other match fields.
If no fingerprint detected, set fingerprint.detected to false and omit other fingerprint fields."""

RESEARCH_JUDGE_PROMPT = """You are an evidence judge for content attribution analysis. Given a factual claim and evidence gathered from multiple external sources, determine whether the claim can be attributed to a specific publisher's original reporting.

Claim: {claim_text}
Publisher: {publication} ({domain})

External sources found:
{formatted_sources}

Wayback Machine temporal evidence:
{wayback_evidence}

Your task:
1. Determine if any sources from the publisher's domain ({domain}) contain this claim
2. Check if the publisher appears to have reported this FIRST (temporal priority)
3. Assess whether other sources are citing/referencing the publisher's work
4. Evaluate overall confidence in attribution

Output ONLY valid JSON:
{{
  "verdict": "CONFIRMED|LIKELY|UNCONFIRMED|INSUFFICIENT_DATA",
  "confidence": 0.85,
  "reasoning": "One paragraph explaining your verdict based on the evidence",
  "temporal_priority": true,
  "earliest_publisher_date": "2024-01-15",
  "publisher_url": "https://domain.com/article-url",
  "alternative_sources_count": 3
}}

Verdict guidelines:
- CONFIRMED: Publisher source found with matching content AND temporal priority or clear attribution chain
- LIKELY: Publisher source found but temporal priority unclear, OR strong indirect evidence
- UNCONFIRMED: No publisher sources found but claim exists in other sources
- INSUFFICIENT_DATA: Too few sources to make a determination"""
