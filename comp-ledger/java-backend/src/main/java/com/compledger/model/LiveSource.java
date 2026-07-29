package com.compledger.model;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "A real-time source result from GDELT or Wikipedia used for live fact verification")
public class LiveSource {

    @Schema(description = "Article or page title", example = "Prime Minister X dies in helicopter crash")
    private String title;

    @Schema(description = "URL of the source article or Wikipedia page", example = "https://bbc.com/news/...")
    private String url;

    @Schema(description = "Domain of the source", example = "bbc.com")
    private String domain;

    @Schema(description = "ISO-8601 publish date, or empty if unavailable", example = "20240115T120000Z")
    private String publishedAt;

    @Schema(description = "Short text snippet — article title for GDELT, first 300 chars of extract for Wikipedia")
    private String snippet;

    @Schema(description = "Source type: GDELT (global news index) or WIKIPEDIA", example = "GDELT")
    private String sourceType;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    public String getPublishedAt() { return publishedAt; }
    public void setPublishedAt(String publishedAt) { this.publishedAt = publishedAt; }

    public String getSnippet() { return snippet; }
    public void setSnippet(String snippet) { this.snippet = snippet; }

    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
}
