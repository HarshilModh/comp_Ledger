package com.compledger.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Request body for POST /api/article-trace")
public class ArticleTraceRequest {

    @Schema(description = "Plain text of the article to fact-check",
            example = "Prime Minister John Doe died in a helicopter crash on Monday near the capital...",
            requiredMode = Schema.RequiredMode.REQUIRED)
    @JsonProperty("article_text")
    private String articleText;

    @Schema(description = "Name of the publisher submitting the article",
            example = "Silicon Insider", defaultValue = "Silicon Insider")
    @JsonProperty("publisher_name")
    private String publisherName = "Silicon Insider";

    public String getArticleText() { return articleText; }
    public void setArticleText(String articleText) { this.articleText = articleText; }

    public String getPublisherName() { return publisherName; }
    public void setPublisherName(String publisherName) {
        this.publisherName = publisherName != null ? publisherName : "Silicon Insider";
    }
}
