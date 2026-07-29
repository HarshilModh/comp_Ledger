package com.compledger.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Top-level structure of the index.json file produced by the build-index script.
 *
 * The file contains pre-computed embeddings for both corpora so the server can
 * perform vector similarity search at runtime without re-embedding anything.
 *
 * Example structure:
 * {
 *   "model": "amazon.titan-embed-text-v2:0",
 *   "dimensions": 512,
 *   "created_at": "2024-01-01T00:00:00.000Z",
 *   "publisher": { "chunks": [...] },
 *   "reference": { "chunks": [...] }
 * }
 */
public class IndexData {

    /** Bedrock model ID used to produce the embeddings (e.g. "amazon.titan-embed-text-v2:0") */
    private String model;

    /** Number of dimensions in each embedding vector (512 for Titan v2) */
    private int dimensions;

    /** ISO-8601 timestamp of when the index was built */
    @JsonProperty("created_at")
    private String createdAt;

    /** Chunks from the single publisher whose content is being protected */
    private CorpusIndex publisher;

    /** Chunks from the broader reference corpus of other public sources */
    private CorpusIndex reference;

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public int getDimensions() { return dimensions; }
    public void setDimensions(int dimensions) { this.dimensions = dimensions; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public CorpusIndex getPublisher() { return publisher; }
    public void setPublisher(CorpusIndex publisher) { this.publisher = publisher; }

    public CorpusIndex getReference() { return reference; }
    public void setReference(CorpusIndex reference) { this.reference = reference; }
}
