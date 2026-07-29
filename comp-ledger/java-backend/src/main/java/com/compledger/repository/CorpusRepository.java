package com.compledger.repository;

import com.compledger.model.Article;
import com.compledger.model.ArticleChunk;

import java.util.List;
import java.util.Optional;

/**
 * Persistence abstraction for publisher corpus (articles and their embedded chunks).
 *
 * To switch from DynamoDB to PostgreSQL/pgvector:
 *   1. Create a JpaCorpusRepository implementing this interface
 *   2. Store vectors in a pgvector column for native ANN search
 *   3. Replace getAllChunksForPublisher + in-memory cosine with a SQL query using <=> operator
 */
public interface CorpusRepository {

    Article saveArticle(Article article);

    Optional<Article> findArticleById(String publisherId, String articleId);

    List<Article> listArticles(String publisherId);

    void saveChunks(List<ArticleChunk> chunks);

    List<ArticleChunk> getAllChunksForPublisher(String publisherId);

    void deleteArticle(String publisherId, String articleId);
}
