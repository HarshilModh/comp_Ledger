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
 * Queries the Wikipedia Search API and the Wikidata SPARQL endpoint for
 * structured facts about entities mentioned in a claim.
 *
 * Wikipedia is best for claims about people, organisations, places, and events.
 * Both APIs are free and require no key.
 *
 * Wikipedia Search API: https://en.wikipedia.org/w/api.php
 * Wikidata SPARQL:      https://query.wikidata.org/sparql
 */
@Service
public class WikidataService {

    private static final Logger logger = LoggerFactory.getLogger(WikidataService.class);
    private static final String WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
    private static final String WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
    private static final int TIMEOUT_SECONDS = 8;
    private static final int SNIPPET_LENGTH = 400;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
            .build();

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Searches Wikipedia for pages related to the claim and returns the top results
     * with their introductory text as a snippet.
     * Returns an empty list (never throws) so the pipeline degrades gracefully.
     *
     * @param claimText the atomic claim to search for
     * @return list of Wikipedia page results as LiveSource objects
     */
    public List<LiveSource> search(String claimText) {
        List<LiveSource> results = new ArrayList<>();
        try {
            results.addAll(searchWikipedia(claimText));
        } catch (Exception e) {
            logger.warn("Wikipedia search failed for '{}': {}", truncate(claimText), e.getMessage());
        }
        return results;
    }

    /**
     * Runs a full-text Wikipedia search and fetches the introductory extract
     * for each matching page. Uses the opensearch action for title matching
     * plus extracts for the first paragraph content.
     */
    private List<LiveSource> searchWikipedia(String claimText) throws Exception {
        List<LiveSource> results = new ArrayList<>();

        // Step 1: search for matching page titles
        String searchQuery = URLEncoder.encode(claimText, StandardCharsets.UTF_8);
        String searchUrl = WIKIPEDIA_API
                + "?action=query"
                + "&list=search"
                + "&srsearch=" + searchQuery
                + "&srlimit=3"
                + "&format=json"
                + "&utf8=1";

        HttpRequest searchRequest = HttpRequest.newBuilder()
                .uri(URI.create(searchUrl))
                .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .header("User-Agent", "CoMP-Ledger/0.1.0 (fact-checking tool)")
                .GET()
                .build();

        HttpResponse<String> searchResponse = httpClient.send(searchRequest, HttpResponse.BodyHandlers.ofString());
        if (searchResponse.statusCode() != 200) return results;

        JsonNode searchRoot = objectMapper.readTree(searchResponse.body());
        JsonNode searchResults = searchRoot.path("query").path("search");
        if (!searchResults.isArray() || searchResults.isEmpty()) return results;

        // Collect page titles to fetch extracts for
        List<String> titles = new ArrayList<>();
        for (JsonNode r : searchResults) {
            String title = r.path("title").asText("");
            if (!title.isEmpty()) titles.add(title);
        }

        // Step 2: fetch the introductory extract for each matching page
        // Titles are joined with %7C (encoded |) — URI.create() rejects bare pipe characters
        String titlesParam = titles.stream()
                .map(t -> URLEncoder.encode(t, StandardCharsets.UTF_8))
                .collect(java.util.stream.Collectors.joining("%7C"));
        String extractUrl = WIKIPEDIA_API
                + "?action=query"
                + "&titles=" + titlesParam
                + "&prop=extracts%7Cinfo"
                + "&exintro=true"
                + "&explaintext=true"
                + "&exsentences=3"
                + "&inprop=url"
                + "&format=json"
                + "&utf8=1";

        HttpRequest extractRequest = HttpRequest.newBuilder()
                .uri(URI.create(extractUrl))
                .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .header("User-Agent", "CoMP-Ledger/0.1.0 (fact-checking tool)")
                .GET()
                .build();

        HttpResponse<String> extractResponse = httpClient.send(extractRequest, HttpResponse.BodyHandlers.ofString());
        if (extractResponse.statusCode() != 200) return results;

        JsonNode extractRoot = objectMapper.readTree(extractResponse.body());
        JsonNode pages = extractRoot.path("query").path("pages");

        pages.fields().forEachRemaining(entry -> {
            JsonNode page = entry.getValue();
            String title = page.path("title").asText("");
            String fullUrl = page.path("fullurl").asText("");
            if (fullUrl.isEmpty()) {
                // Construct URL from title if the API doesn't return it
                fullUrl = "https://en.wikipedia.org/wiki/"
                        + URLEncoder.encode(title, StandardCharsets.UTF_8).replace("+", "_");
            }
            String extract = page.path("extract").asText("");
            String snippet = extract.length() > SNIPPET_LENGTH
                    ? extract.substring(0, SNIPPET_LENGTH) + "..."
                    : extract;

            if (!title.isEmpty() && !snippet.isEmpty()) {
                LiveSource source = new LiveSource();
                source.setTitle(title);
                source.setUrl(fullUrl);
                source.setDomain("en.wikipedia.org");
                source.setPublishedAt("");
                source.setSnippet(snippet);
                source.setSourceType("WIKIPEDIA");
                results.add(source);
            }
        });

        return results;
    }

    private String truncate(String s) {
        return s != null && s.length() > 80 ? s.substring(0, 80) + "..." : s;
    }
}
