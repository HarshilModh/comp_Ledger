package com.compledger.model;

import java.time.Instant;

public class Article {

    private String id;
    private String publisherId;
    private String title;
    private String sourceUrl;
    private int chunkCount;
    private Instant ingestedAt;

    public Article() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getPublisherId() { return publisherId; }
    public void setPublisherId(String publisherId) { this.publisherId = publisherId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }

    public int getChunkCount() { return chunkCount; }
    public void setChunkCount(int chunkCount) { this.chunkCount = chunkCount; }

    public Instant getIngestedAt() { return ingestedAt; }
    public void setIngestedAt(Instant ingestedAt) { this.ingestedAt = ingestedAt; }
}
