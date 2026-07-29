package com.compledger.service;

import com.compledger.model.Article;
import com.compledger.model.ArticleChunk;
import com.compledger.repository.CorpusRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class IngestService {

    private static final Logger logger = LoggerFactory.getLogger(IngestService.class);
    private static final int CHUNK_SIZE_WORDS = 200;
    private static final int CHUNK_OVERLAP_WORDS = 30;

    private final EmbedService embedService;
    private final CorpusRepository corpusRepository;

    public IngestService(EmbedService embedService, CorpusRepository corpusRepository) {
        this.embedService = embedService;
        this.corpusRepository = corpusRepository;
    }

    /**
     * Ingests an article: chunks the text, embeds each chunk, and stores everything
     * in the publisher's isolated corpus.
     *
     * @param publisherId the authenticated publisher's ID
     * @param title       article title
     * @param text        full article text
     * @param sourceUrl   optional source URL
     * @return the created Article with metadata
     */
    public Article ingest(String publisherId, String title, String text, String sourceUrl) throws Exception {
        List<String> chunkTexts = chunkText(text);
        logger.info("Ingesting article '{}' for publisher {}: {} chunks", title, publisherId, chunkTexts.size());

        // Embed all chunks
        List<List<Double>> vectors = embedService.embedBatch(chunkTexts);

        // Create article record
        Article article = new Article();
        article.setId(UUID.randomUUID().toString());
        article.setPublisherId(publisherId);
        article.setTitle(title);
        article.setSourceUrl(sourceUrl);
        article.setChunkCount(chunkTexts.size());
        article.setIngestedAt(Instant.now());

        // Create chunk records
        List<ArticleChunk> chunks = new ArrayList<>();
        for (int i = 0; i < chunkTexts.size(); i++) {
            ArticleChunk chunk = new ArticleChunk();
            chunk.setPublisherId(publisherId);
            chunk.setArticleId(article.getId());
            chunk.setChunkIdx(i);
            chunk.setText(chunkTexts.get(i));
            chunk.setVector(vectors.get(i));
            chunks.add(chunk);
        }

        // Persist
        corpusRepository.saveArticle(article);
        corpusRepository.saveChunks(chunks);

        logger.info("Article '{}' ingested successfully: {} chunks stored", title, chunks.size());
        return article;
    }

    /**
     * Splits text into overlapping windows of approximately CHUNK_SIZE_WORDS words.
     * Overlap ensures context isn't lost at chunk boundaries.
     */
    private List<String> chunkText(String text) {
        // First split by paragraphs, then reassemble into word-count windows
        String[] paragraphs = text.split("\\n\\s*\\n");
        List<String> allWords = new ArrayList<>();
        List<Integer> paragraphBoundaries = new ArrayList<>();

        for (String para : paragraphs) {
            String trimmed = para.trim();
            if (trimmed.isEmpty()) continue;
            String[] words = trimmed.split("\\s+");
            paragraphBoundaries.add(allWords.size());
            for (String w : words) {
                allWords.add(w);
            }
        }

        if (allWords.isEmpty()) return List.of();

        // If entire text fits in one chunk, return as-is
        if (allWords.size() <= CHUNK_SIZE_WORDS) {
            return List.of(String.join(" ", allWords));
        }

        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < allWords.size()) {
            int end = Math.min(start + CHUNK_SIZE_WORDS, allWords.size());
            chunks.add(String.join(" ", allWords.subList(start, end)));
            start += CHUNK_SIZE_WORDS - CHUNK_OVERLAP_WORDS;
        }

        return chunks;
    }
}
