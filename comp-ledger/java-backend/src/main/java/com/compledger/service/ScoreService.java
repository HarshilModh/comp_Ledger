package com.compledger.service;

import com.compledger.model.ScoredChunk;
import com.compledger.util.Prompts;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scores an individual claim for exclusivity and publisher fingerprint using an LLM.
 *
 * For each claim it:
 *   1. Formats the top-K publisher and reference chunks into readable candidate lists
 *   2. Sends them to Claude (Sonnet by default) with the SCORE_PROMPT
 *   3. Parses the JSON response containing match, exclusivity, and fingerprint assessments
 *   4. Computes a numeric exclusivity_score from the structured response
 */
@Service
public class ScoreService {

    /** Bedrock model ID for scoring (e.g. Claude Sonnet) — more capable than Haiku */
    @Value("${bedrock.score-model-id}")
    private String scoreModelId;

    /** Spring AI ChatClient backed by BedrockProxyChatModel */
    private final ChatClient chatClient;

    @Autowired
    private ObjectMapper objectMapper;

    public ScoreService(ChatModel chatModel) {
        this.chatClient = ChatClient.builder(chatModel).build();
    }

    /**
     * Computes a 0–1 exclusivity score from structured scoring data.
     *
     * Formula: baseScore = max(0.05, 1 / (1 + independentSourceCount * 0.8))
     *          score = min(1.0, round((baseScore + fingerprintBonus) * 100) / 100)
     *
     * - More independent sources → lower score (fact is widely reported, not exclusive)
     * - Fingerprint detected → +0.15 bonus (AI likely copied from this publisher specifically)
     * - Floor of 0.05 ensures even widely-reported facts get a non-zero score
     *
     * @param independentSourceCount number of other sources carrying the same fact
     * @param fingerprintDetected    true if the AI reproduced phrasing unique to the publisher
     * @return exclusivity score rounded to 2 decimal places
     */
    public double computeExclusivityScore(int independentSourceCount, boolean fingerprintDetected) {
        double baseScore = Math.max(0.05, 1.0 / (1 + independentSourceCount * 0.8));
        double bonus = fingerprintDetected ? 0.15 : 0;
        return Math.min(1.0, Math.round((baseScore + bonus) * 100.0) / 100.0);
    }

    /**
     * Asks the LLM to score a claim against the retrieved candidate passages.
     *
     * Publisher candidates are formatted as: [1] (doc_id, paragraph N): "text"
     * Reference candidates are formatted as: [1] (doc_id): "text"
     *
     * Returns a map with three keys — match, exclusivity, fingerprint — matching
     * the JSON schema defined in Prompts.SCORE_PROMPT. Falls back to safe defaults
     * if the model returns unparseable output.
     *
     * @param claimText      the atomic claim being scored
     * @param publisherHits  top-K chunks from the publisher archive
     * @param referenceHits  top-K chunks from the reference corpus
     * @return map with match/exclusivity/fingerprint keys
     */
    public Map<String, Object> scoreClaim(String claimText,
                                          List<ScoredChunk> publisherHits,
                                          List<ScoredChunk> referenceHits) {
        // Format publisher candidates as numbered list with document and paragraph references
        StringBuilder publisherCandidates = new StringBuilder();
        for (int i = 0; i < publisherHits.size(); i++) {
            ScoredChunk h = publisherHits.get(i);
            publisherCandidates.append(String.format("[%d] (%s, paragraph %d): \"%s\"%n",
                    i + 1, h.getDocId(), h.getChunkIdx(), h.getText()));
        }

        // Format reference candidates as numbered list with just the document name
        StringBuilder referenceCandidates = new StringBuilder();
        for (int i = 0; i < referenceHits.size(); i++) {
            ScoredChunk h = referenceHits.get(i);
            referenceCandidates.append(String.format("[%d] (%s): \"%s\"%n",
                    i + 1, h.getDocId(), h.getText()));
        }

        // Use placeholder text if no candidates were found for a corpus side
        String pubStr = publisherCandidates.length() > 0
                ? publisherCandidates.toString().trim() : "No candidates found.";
        String refStr = referenceCandidates.length() > 0
                ? referenceCandidates.toString().trim() : "No candidates found.";

        // Fill the SCORE_PROMPT template with actual claim and candidate text
        String prompt = Prompts.SCORE_PROMPT
                .replace("{claim_text}", claimText)
                .replace("{publisher_candidates}", pubStr)
                .replace("{reference_candidates}", refStr);

        try {
            // Call the score model with a higher token budget than decompose (2048 vs 4096)
            String text = chatClient.prompt()
                    .user(prompt)
                    .options(ChatOptions.builder()
                            .model(scoreModelId)
                            .maxTokens(2048)
                            .build())
                    .call()
                    .content();

            return parseScoreResponse(text);
        } catch (Exception e) {
            // If the call itself fails, return safe defaults so the trace can continue
            return defaultScoreResult();
        }
    }

    /**
     * Attempts to parse the model response as a JSON object.
     * Falls back to a regex scan for the first {...} block in case the model
     * adds preamble or wraps the JSON in markdown code fences.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> parseScoreResponse(String text) {
        try {
            return objectMapper.readValue(text, Map.class);
        } catch (Exception e) {
            // Regex fallback: extract the first {...} block from the response
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                try {
                    return objectMapper.readValue(matcher.group(), Map.class);
                } catch (Exception ex) {
                    // fall through to defaults
                }
            }
            return defaultScoreResult();
        }
    }

    /**
     * Returns a safe default result used when scoring fails or the response
     * cannot be parsed. Signals no match, zero independent sources, and no fingerprint
     * so the claim gets a neutral score rather than crashing the trace.
     */
    private Map<String, Object> defaultScoreResult() {
        Map<String, Object> result = new HashMap<>();
        result.put("match", Map.of("found", false));
        result.put("exclusivity", Map.of(
                "independent_source_count", 0,
                "sources", List.of(),
                "reasoning", "Scoring failed"));
        result.put("fingerprint", Map.of("detected", false));
        return result;
    }
}
