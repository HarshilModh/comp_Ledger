package com.compledger.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Represents a single text chunk stored in the embedding index (index.json).
 *
 * Each source article is split into fixed-size word windows ("chunks") during the
 * build-index step. Every chunk stores the original text alongside its 512-dimensional
 * embedding vector produced by Amazon Titan.
 *
 * @JsonIgnoreProperties(ignoreUnknown = true) means extra fields in index.json
 * (e.g. future metadata) are silently ignored instead of causing a parse error.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Chunk {

    /** Filename of the source document this chunk came from (e.g. "nyt-2023-04-09.txt") */
    @JsonProperty("doc_id")
    private String docId;

    /** Zero-based position of this chunk within its source document */
    @JsonProperty("chunk_idx")
    private int chunkIdx;

    /** The raw text content of this chunk (approximately 300 words) */
    private String text;

    /** 512-dimensional unit-length embedding vector produced by Amazon Titan */
    private List<Double> vector;

    public String getDocId() { return docId; }
    public void setDocId(String docId) { this.docId = docId; }

    public int getChunkIdx() { return chunkIdx; }
    public void setChunkIdx(int chunkIdx) { this.chunkIdx = chunkIdx; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public List<Double> getVector() { return vector; }
    public void setVector(List<Double> vector) { this.vector = vector; }
}
