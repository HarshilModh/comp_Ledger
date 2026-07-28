export const DECOMPOSE_PROMPT = `You are a claim extraction engine. Given an AI-generated answer to a reader question, extract every discrete factual claim as a JSON array.

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
  {"id": 1, "text": "Tesla announced a $25,000 compact vehicle at its March 2024 investor day"},
  {"id": 2, "text": "The vehicle will use a new manufacturing process called unboxed assembly"}
]`;

export const SCORE_PROMPT = `You are an exclusivity scoring engine for content licensing analysis. Given a claim extracted from an AI answer, plus candidate passages from a publisher's archive and from a reference corpus of other sources, produce a structured assessment.

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
{
  "match": {
    "found": true,
    "publisher_passage": "exact quote from publisher archive",
    "doc_id": "filename",
    "paragraph_idx": 0
  },
  "exclusivity": {
    "independent_source_count": 2,
    "sources": ["source1.txt", "source2.txt"],
    "reasoning": "One sentence explaining why you counted this many independent sources"
  },
  "fingerprint": {
    "detected": true,
    "type": "distinctive_phrasing",
    "publisher_version": "the original phrasing from the publisher",
    "ai_version": "how the AI reproduced it",
    "explanation": "Why this is idiosyncratic rather than standard reporting language"
  }
}

If match is not found, set match.found to false and omit other match fields.
If no fingerprint detected, set fingerprint.detected to false and omit other fingerprint fields.`;
