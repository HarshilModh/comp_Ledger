package com.compledger.service;

import com.compledger.model.LiveSource;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Queries the GDELT 2.0 Doc API to find real-world news coverage for a claim.
 *
 * GDELT monitors news in 100+ languages and updates every 15 minutes — making it
 * ideal for breaking news where the internal corpus has no coverage yet.
 * No API key required.
 *
 * API: https://api.gdeltproject.org/api/v2/doc/doc
 *   ?query=<terms>&mode=artlist&maxrecords=10&format=json&timespan=1d
 */
@Service
public class GdeltService {

    private static final Logger logger = LoggerFactory.getLogger(GdeltService.class);
    private static final String GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc";
    private static final int MAX_RECORDS = 10;
    private static final int TIMEOUT_SECONDS = 3;

    private static final String[] STOP_WORDS = {
        "a","an","the","and","or","but","in","on","at","to","for","of","with",
        "is","was","were","are","be","been","has","had","have","by","from",
        "that","this","it","its","he","she","they","his","her","their","who",
        "which","as","not","no","so","also","both","all","more","most","than",
        "after","before","during","since","while","about","into","through",
        "over","under","between","would","could","should","did","do","does"
    };

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
            .build();

    // Enforce GDELT's 1-request-per-5-seconds rate limit across all concurrent claims
    private static final java.util.concurrent.Semaphore RATE_LIMIT = new java.util.concurrent.Semaphore(1);
    private static volatile long lastRequestMs = 0;
    private static final long MIN_INTERVAL_MS = 5500; // 5.5s to be safe

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Searches GDELT for news articles matching the given claim text.
     * Returns up to MAX_RECORDS results from the past 24 hours.
     * Returns an empty list (never throws) so the pipeline degrades gracefully.
     *
     * @param claimText the atomic claim to search for
     * @return list of matching LiveSource results, may be empty
     */
    public List<LiveSource> search(String claimText) {
        List<LiveSource> results = new ArrayList<>();
        try {
            // Enforce rate limit: GDELT allows one request per 5 seconds
            RATE_LIMIT.acquire();
            try {
                long now = System.currentTimeMillis();
                long elapsed = now - lastRequestMs;
                if (elapsed < MIN_INTERVAL_MS) {
                    Thread.sleep(MIN_INTERVAL_MS - elapsed);
                }
                lastRequestMs = System.currentTimeMillis();
            } finally {
                RATE_LIMIT.release();
            }

            String query = buildQuery(claimText);
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = GDELT_API + "?query=" + encoded
                    + "&mode=artlist"
                    + "&maxrecords=" + MAX_RECORDS
                    + "&format=json"
                    + "&timespan=365d"; // last 365 days — covers recent history, not just breaking news

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                logger.warn("GDELT returned HTTP {}", response.statusCode());
                return results;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode articles = root.path("articles");
            if (!articles.isArray()) return results;

            for (JsonNode article : articles) {
                LiveSource source = new LiveSource();
                source.setTitle(article.path("title").asText(""));
                source.setUrl(article.path("url").asText(""));
                source.setDomain(article.path("domain").asText(""));
                source.setPublishedAt(article.path("seendate").asText(""));
                String snippet = article.path("socialimage").asText("");
                if (snippet.isEmpty()) {
                    snippet = article.path("excerpt").asText("");
                }
                if (snippet.isEmpty()) {
                    snippet = article.path("title").asText("");
                }
                source.setSnippet(snippet);
                source.setSourceType("GDELT");
                results.add(source);
            }

        } catch (Exception e) {
            logger.warn("GDELT search failed for claim '{}': {}", truncate(claimText), e.getMessage());
        }
        return results;
    }

    /**
     * Extracts meaningful keywords from the claim for the GDELT query.
     *
     * GDELT matches against article full-text — quoting a whole sentence finds nothing
     * because no article will reproduce the exact phrasing. Instead we extract the
     * 4-6 most significant words (nouns, proper names, numbers) after stripping stop words.
     * Capitalised words (likely proper nouns) are prioritised by being placed first.
     */
    private String buildQuery(String claimText) {
        String[] words = claimText.split("\\s+");
        java.util.Set<String> stopSet = new java.util.HashSet<>(java.util.Arrays.asList(STOP_WORDS));

        java.util.List<String> proper = new java.util.ArrayList<>();
        java.util.List<String> other  = new java.util.ArrayList<>();

        for (String raw : words) {
            String word = raw.replaceAll("[^a-zA-Z0-9]", "");
            if (word.length() < 2) continue;
            if (stopSet.contains(word.toLowerCase())) continue;

            // Keep numbers (years, percentages, dollar amounts) and words 3+ chars
            if (word.length() >= 3 || word.matches("\\d+")) {
                if (Character.isUpperCase(word.charAt(0)) && word.length() > 2) {
                    proper.add(word);
                } else {
                    other.add(word);
                }
            }
        }

        java.util.List<String> keywords = new java.util.ArrayList<>();
        keywords.addAll(proper);
        keywords.addAll(other);

        // 6 keywords is the sweet spot for GDELT precision without over-constraining
        if (keywords.size() > 6) keywords = keywords.subList(0, 6);

        return String.join(" ", keywords);
    }

    private String truncate(String s) {
        return s != null && s.length() > 80 ? s.substring(0, 80) + "..." : s;
    }
}
