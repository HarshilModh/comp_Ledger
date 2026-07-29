package com.compledger.model;

/**
 * A Chunk with an attached similarity score, produced by CosineUtil.searchIndex().
 *
 * Used as the input to ScoreService — the scorer receives the top-K most similar
 * chunks from both corpora and decides how well each claim matches the publisher archive.
 */
public class ScoredChunk {

    /** Filename of the source document (e.g. "nyt-2023-04-09.txt") */
    private String docId;

    /** Zero-based position of this chunk within its source document */
    private int chunkIdx;

    /** The raw text content of this chunk */
    private String text;

    /** Cosine similarity between this chunk's vector and the query vector (range -1 to 1) */
    private double similarity;

    public String getDocId() { return docId; }
    public void setDocId(String docId) { this.docId = docId; }

    public int getChunkIdx() { return chunkIdx; }
    public void setChunkIdx(int chunkIdx) { this.chunkIdx = chunkIdx; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public double getSimilarity() { return similarity; }
    public void setSimilarity(double similarity) { this.similarity = similarity; }
}
