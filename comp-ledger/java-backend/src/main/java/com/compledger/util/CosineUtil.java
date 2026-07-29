package com.compledger.util;

import com.compledger.model.Chunk;
import com.compledger.model.ScoredChunk;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Utility class for vector similarity search over the in-memory embedding index.
 *
 * Vectors produced by Amazon Titan (with normalize=true) are unit-length, so
 * cosine similarity reduces to a simple dot product — no magnitude division needed.
 */
public class CosineUtil {

    /**
     * Computes the dot product of two equal-length vectors.
     * Because Titan embeddings are normalised to unit length, the dot product
     * equals the cosine similarity directly (range -1 to 1, higher = more similar).
     *
     * @param vecA first embedding vector
     * @param vecB second embedding vector
     * @return dot product (cosine similarity for unit vectors)
     */
    public static double cosineSimilarity(List<Double> vecA, List<Double> vecB) {
        double dot = 0.0;
        for (int i = 0; i < vecA.size(); i++) {
            dot += vecA.get(i) * vecB.get(i);
        }
        return dot;
    }

    /**
     * Scores every chunk in the list against the query vector, then returns the
     * top-K most similar chunks sorted by descending similarity.
     *
     * @param queryVec the embedding of the claim text being looked up
     * @param chunks   all chunks in one corpus (publisher or reference)
     * @param topK     how many top results to return
     * @return list of at most topK ScoredChunk objects, highest similarity first
     */
    public static List<ScoredChunk> searchIndex(List<Double> queryVec, List<Chunk> chunks, int topK) {
        List<ScoredChunk> scored = new ArrayList<>();

        // Score every chunk against the query
        for (Chunk chunk : chunks) {
            double similarity = cosineSimilarity(queryVec, chunk.getVector());

            // Copy the chunk fields into a ScoredChunk that also holds the similarity value
            ScoredChunk sc = new ScoredChunk();
            sc.setDocId(chunk.getDocId());
            sc.setChunkIdx(chunk.getChunkIdx());
            sc.setText(chunk.getText());
            sc.setSimilarity(similarity);
            scored.add(sc);
        }

        // Sort descending so index 0 is the best match
        scored.sort(Comparator.comparingDouble(ScoredChunk::getSimilarity).reversed());

        // Return only the top K results (or all if fewer than K chunks exist)
        return scored.subList(0, Math.min(topK, scored.size()));
    }
}
