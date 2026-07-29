package com.compledger.model;

import java.util.List;

/**
 * Holds all the chunks for one side of the corpus — either the publisher archive
 * or the reference corpus.
 *
 * Maps to the "publisher" and "reference" objects inside index.json, each of which
 * contains a flat list of Chunk objects:
 *
 *   { "chunks": [ { "doc_id": "...", "chunk_idx": 0, "text": "...", "vector": [...] }, ... ] }
 */
public class CorpusIndex {

    /** All embedded text chunks belonging to this corpus side */
    private List<Chunk> chunks;

    public List<Chunk> getChunks() { return chunks; }
    public void setChunks(List<Chunk> chunks) { this.chunks = chunks; }
}
