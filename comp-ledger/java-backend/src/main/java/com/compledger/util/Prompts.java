package com.compledger.util;

/**
 * Holds the two LLM prompt templates used across the scoring pipeline.
 * Placeholders in curly braces (e.g. {question}) are replaced at call time
 * via simple String.replace() before the prompt is sent to the model.
 */
public class Prompts {

    /**
     * Sent to the decompose model (Claude Haiku by default).
     * Takes a question and an AI-generated answer, and asks the model to
     * extract every discrete factual claim as a JSON array of {id, text} objects.
     *
     * Placeholders:
     *   {question} - the original reader question
     *   {answer}   - the AI-generated answer to decompose
     */
    public static final String DECOMPOSE_PROMPT =
        "You are a claim extraction engine. Given an AI-generated answer to a reader question, extract every discrete factual claim as a JSON array.\n" +
        "\n" +
        "Rules:\n" +
        "- Each claim is ONE atomic fact (who/what/when/where/how much)\n" +
        "- Strip opinion, hedging, and meta-commentary\n" +
        "- Preserve specifics: numbers, names, dates, technical terms\n" +
        "- Return 5-15 claims for a typical paragraph answer\n" +
        "- Output ONLY valid JSON, no markdown fencing\n" +
        "\n" +
        "Input question: {question}\n" +
        "Input answer: {answer}\n" +
        "\n" +
        "Output format:\n" +
        "[\n" +
        "  {\"id\": 1, \"text\": \"Tesla announced a $25,000 compact vehicle at its March 2024 investor day\"},\n" +
        "  {\"id\": 2, \"text\": \"The vehicle will use a new manufacturing process called unboxed assembly\"}\n" +
        "]";

    /**
     * Sent to the score model (Claude Sonnet by default).
     * Given a single claim plus the top-K candidate passages retrieved from the
     * publisher archive and the reference corpus, asks the model to assess three axes:
     *
     *   MATCH       - does the exact claim appear in the publisher archive?
     *   EXCLUSIVITY - how many independent sources in the reference corpus carry the same fact?
     *   FINGERPRINT - does the AI answer reproduce phrasing or details unique to the publisher?
     *
     * The model is expected to return a structured JSON object with match, exclusivity,
     * and fingerprint keys. The score model's response is then used by ScoreService
     * to compute the final numeric exclusivity_score.
     *
     * Placeholders:
     *   {claim_text}            - the atomic claim being scored
     *   {publisher_candidates}  - top-K chunks from the publisher corpus
     *   {reference_candidates}  - top-K chunks from the reference corpus
     */
    public static final String SCORE_PROMPT =
        "You are an exclusivity scoring engine for content licensing analysis. Given a claim extracted from an AI answer, plus candidate passages from a publisher's archive and from a reference corpus of other sources, produce a structured assessment.\n" +
        "\n" +
        "Claim: {claim_text}\n" +
        "\n" +
        "Publisher archive candidates (from one specific publisher):\n" +
        "{publisher_candidates}\n" +
        "\n" +
        "Reference corpus candidates (from other public sources):\n" +
        "{reference_candidates}\n" +
        "\n" +
        "Score this claim on three axes:\n" +
        "\n" +
        "1. MATCH: Does the claim appear in the publisher's archive? If yes, quote the specific sentence.\n" +
        "2. EXCLUSIVITY: How many genuinely independent sources in the reference corpus also carry this exact claim? Count only sources that independently report the same specific fact, not sources covering the same general topic.\n" +
        "3. FINGERPRINT: Does the AI answer's version of this claim reproduce something idiosyncratic to the publisher's version? Look for: distinctive phrasing, unusual framing, specific ordering of sub-claims, a factual error unique to this source, or a distinctive metaphor/analogy.\n" +
        "\n" +
        "Output ONLY valid JSON:\n" +
        "{\n" +
        "  \"match\": {\n" +
        "    \"found\": true,\n" +
        "    \"publisher_passage\": \"exact quote from publisher archive\",\n" +
        "    \"doc_id\": \"filename\",\n" +
        "    \"paragraph_idx\": 0\n" +
        "  },\n" +
        "  \"exclusivity\": {\n" +
        "    \"independent_source_count\": 2,\n" +
        "    \"sources\": [\"source1.txt\", \"source2.txt\"],\n" +
        "    \"reasoning\": \"One sentence explaining why you counted this many independent sources\"\n" +
        "  },\n" +
        "  \"fingerprint\": {\n" +
        "    \"detected\": true,\n" +
        "    \"type\": \"distinctive_phrasing\",\n" +
        "    \"publisher_version\": \"the original phrasing from the publisher\",\n" +
        "    \"ai_version\": \"how the AI reproduced it\",\n" +
        "    \"explanation\": \"Why this is idiosyncratic rather than standard reporting language\"\n" +
        "  }\n" +
        "}\n" +
        "\n" +
        "If match is not found, set match.found to false and omit other match fields.\n" +
        "If no fingerprint detected, set fingerprint.detected to false and omit other fingerprint fields.";
}
