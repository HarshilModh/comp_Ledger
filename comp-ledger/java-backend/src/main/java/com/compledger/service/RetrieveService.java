package com.compledger.service;

import com.compledger.model.ArticleChunk;
import com.compledger.model.Chunk;
import com.compledger.model.IndexData;
import com.compledger.model.ScoredChunk;
import com.compledger.repository.CorpusRepository;
import com.compledger.util.CosineUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Performs vector similarity search against both the static index and
 * the publisher's ingested corpus in DynamoDB.
 */
@Service
public class RetrieveService {

    @Autowired
    private IndexService indexService;

    @Autowired
    private CorpusRepository corpusRepository;

    /**
     * Searches static index only (legacy behavior for when no publisherId is available).
     */
    public Map<String, List<ScoredChunk>> retrieveCandidates(List<Double> queryVec) {
        return retrieveCandidates(queryVec, 5);
    }

    /**
     * Searches static index only with custom topK.
     */
    public Map<String, List<ScoredChunk>> retrieveCandidates(List<Double> queryVec, int topK) {
        IndexData index = indexService.getIndex();
        if (index == null) {
            throw new IllegalStateException("Index not loaded — run build-index first");
        }

        List<ScoredChunk> publisherHits = CosineUtil.searchIndex(
                queryVec, index.getPublisher().getChunks(), topK);

        List<ScoredChunk> referenceHits = CosineUtil.searchIndex(
                queryVec, index.getReference().getChunks(), topK);

        Map<String, List<ScoredChunk>> result = new HashMap<>();
        result.put("publisherHits", publisherHits);
        result.put("referenceHits", referenceHits);
        return result;
    }

    /**
     * Searches the publisher's ingested corpus (DynamoDB) combined with the static index.
     * Publisher hits come from both the static index AND the publisher's DynamoDB chunks.
     * Reference hits come from the static reference corpus only.
     *
     * @param queryVec    the embedding of the claim being looked up
     * @param publisherId the authenticated publisher's ID
     * @param topK        how many candidate chunks to return per corpus side
     * @return map with "publisherHits" and "referenceHits" keys
     */
    public Map<String, List<ScoredChunk>> retrieveCandidates(List<Double> queryVec, String publisherId, int topK) {
        // Get publisher's ingested chunks from DynamoDB
        List<ArticleChunk> dynamoChunks = corpusRepository.getAllChunksForPublisher(publisherId);

        // Score DynamoDB chunks against query
        List<ScoredChunk> publisherHits = new ArrayList<>();
        for (ArticleChunk chunk : dynamoChunks) {
            if (chunk.getVector() == null || chunk.getVector().isEmpty()) continue;
            double similarity = CosineUtil.cosineSimilarity(queryVec, chunk.getVector());
            ScoredChunk sc = new ScoredChunk();
            sc.setDocId(chunk.getArticleId());
            sc.setChunkIdx(chunk.getChunkIdx());
            sc.setText(chunk.getText());
            sc.setSimilarity(similarity);
            publisherHits.add(sc);
        }

        // Also include static index publisher hits if available
        IndexData index = indexService.getIndex();
        if (index != null && index.getPublisher() != null) {
            List<ScoredChunk> staticHits = CosineUtil.searchIndex(
                    queryVec, index.getPublisher().getChunks(), topK);
            publisherHits.addAll(staticHits);
        }

        // Sort combined and take top K
        publisherHits.sort(Comparator.comparingDouble(ScoredChunk::getSimilarity).reversed());
        if (publisherHits.size() > topK) {
            publisherHits = publisherHits.subList(0, topK);
        }

        // Reference hits from static index only
        List<ScoredChunk> referenceHits = new ArrayList<>();
        if (index != null && index.getReference() != null) {
            referenceHits = CosineUtil.searchIndex(
                    queryVec, index.getReference().getChunks(), topK);
        }

        Map<String, List<ScoredChunk>> result = new HashMap<>();
        result.put("publisherHits", publisherHits);
        result.put("referenceHits", referenceHits);
        return result;
    }
}
