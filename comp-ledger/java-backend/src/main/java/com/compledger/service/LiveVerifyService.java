package com.compledger.service;

import com.compledger.model.LiveSource;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Orchestrates live fact verification for a single claim by:
 *   1. Querying GDELT (global news index, updated every 15 min) in parallel with
 *      querying Wikipedia (structured facts about entities)
 *   2. Feeding the combined results as context to an LLM judge
 *   3. Returning a structured verdict: VERIFIED / UNVERIFIED / CONFLICTING / INSUFFICIENT_DATA
 *
 * This is the fallback path when the internal corpus has no matching chunks — enabling
 * breaking-news fact-checking without pre-indexed data.
 */
@Service
public class LiveVerifyService {

    private static final Logger logger = LoggerFactory.getLogger(LiveVerifyService.class);

    @Value("${bedrock.score-model-id}")
    private String scoreModelId;

    private final ChatClient chatClient;

    @Autowired private GdeltService gdeltService;
    @Autowired private WikidataService wikidataService;
    @Autowired private ObjectMapper objectMapper;

    public LiveVerifyService(ChatModel chatModel) {
        this.chatClient = ChatClient.builder(chatModel).build();
    }

    /**
     * Verifies a single claim against live external sources.
     *
     * Wikipedia is queried for every claim (no rate limit).
     * GDELT is queried only when Wikipedia returns zero results — this avoids
     * hitting GDELT's 1-request-per-5-seconds rate limit on multi-claim articles
     * while still using it for claims where Wikipedia has no coverage.
     *
     * @param claimText the atomic claim to verify
     * @return map with keys: verdict, confidence, sources, reasoning, live_source_count
     */
    public Map<String, Object> verify(String claimText) {
        // Wikipedia: no rate limit, reliable entity and event coverage
        List<LiveSource> wikiSources = wikidataService.search(claimText);

        // GDELT: only query if Wikipedia found nothing AND it is reachable in this environment
        List<LiveSource> gdeltSources = new ArrayList<>();
        if (wikiSources.isEmpty()) {
            gdeltSources = gdeltService.search(claimText);
        }

        List<LiveSource> allSources = new ArrayList<>();
        allSources.addAll(gdeltSources);
        allSources.addAll(wikiSources);

        if (allSources.isEmpty()) {
            return buildResult("INSUFFICIENT_DATA", 0.0,
                    "No live sources found from GDELT or Wikipedia for this claim.", List.of());
        }

        // Format sources as context for the LLM judge
        String sourcesContext = formatSources(allSources);
        String prompt = buildVerifyPrompt(claimText, sourcesContext);

        try {
            String response = chatClient.prompt()
                    .user(prompt)
                    .options(ChatOptions.builder()
                            .model(scoreModelId)
                            .maxTokens(1024)
                            .build())
                    .call()
                    .content();

            Map<String, Object> parsed = parseVerifyResponse(response);
            // Always include the raw sources so the caller can show URLs
            parsed.put("live_source_count", allSources.size());
            parsed.put("sources", serializeSources(allSources));
            return parsed;

        } catch (Exception e) {
            logger.warn("LLM verification failed for claim '{}': {}", truncate(claimText), e.getMessage());
            return buildResult("INSUFFICIENT_DATA", 0.0,
                    "LLM judge unavailable: " + e.getMessage(), allSources);
        }
    }

    private String formatSources(List<LiveSource> sources) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < sources.size(); i++) {
            LiveSource s = sources.get(i);
            sb.append(String.format("[%d] (%s | %s)%n", i + 1, s.getDomain(), s.getSourceType()));
            sb.append(String.format("    Title: %s%n", s.getTitle()));
            if (s.getSnippet() != null && !s.getSnippet().isEmpty()
                    && !s.getSnippet().equals(s.getTitle())) {
                sb.append(String.format("    Excerpt: %s%n", s.getSnippet()));
            }
            sb.append("\n");
        }
        return sb.toString().trim();
    }

    private String buildVerifyPrompt(String claimText, String sourcesContext) {
        return "You are a fact-checking engine for a news organisation. " +
                "A journalist has written this claim in an article they are about to publish:\n\n" +
                "CLAIM: " + claimText + "\n\n" +
                "The following real-time sources have been retrieved from GDELT (global news index) " +
                "and Wikipedia:\n\n" +
                sourcesContext + "\n\n" +
                "Based ONLY on the sources above, assess the claim. Do not use your own training knowledge.\n\n" +
                "Verdict options:\n" +
                "- VERIFIED: Multiple credible sources clearly confirm the claim\n" +
                "- UNVERIFIED: No sources confirm the claim, or claim contradicts sources\n" +
                "- CONFLICTING: Sources disagree with each other about the claim\n" +
                "- INSUFFICIENT_DATA: Sources exist but do not provide enough detail to judge\n\n" +
                "Output ONLY valid JSON:\n" +
                "{\n" +
                "  \"verdict\": \"VERIFIED\",\n" +
                "  \"confidence\": 0.85,\n" +
                "  \"reasoning\": \"One sentence explaining the verdict based on the sources\"\n" +
                "}";
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseVerifyResponse(String text) {
        try {
            return objectMapper.readValue(text, Map.class);
        } catch (Exception e) {
            Pattern pattern = Pattern.compile("\\{[\\s\\S]*\\}");
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                try {
                    return objectMapper.readValue(matcher.group(), Map.class);
                } catch (Exception ex) {
                    // fall through
                }
            }
            return buildResult("INSUFFICIENT_DATA", 0.0, "Could not parse LLM response", List.of());
        }
    }

    private Map<String, Object> buildResult(String verdict, double confidence,
                                             String reasoning, List<LiveSource> sources) {
        Map<String, Object> result = new HashMap<>();
        result.put("verdict", verdict);
        result.put("confidence", confidence);
        result.put("reasoning", reasoning);
        result.put("live_source_count", sources.size());
        result.put("sources", serializeSources(sources));
        return result;
    }

    private List<Map<String, Object>> serializeSources(List<LiveSource> sources) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (LiveSource s : sources) {
            Map<String, Object> m = new HashMap<>();
            m.put("title", s.getTitle());
            m.put("url", s.getUrl());
            m.put("domain", s.getDomain());
            m.put("published_at", s.getPublishedAt());
            m.put("source_type", s.getSourceType());
            list.add(m);
        }
        return list;
    }

    private String truncate(String s) {
        return s != null && s.length() > 80 ? s.substring(0, 80) + "..." : s;
    }
}
