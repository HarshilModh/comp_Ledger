package com.compledger.repository;

import com.compledger.model.Article;
import com.compledger.model.ArticleChunk;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * DynamoDB implementation of CorpusRepository.
 *
 * Two tables:
 *   - Articles table: PK=publisherId, SK=articleId
 *   - Chunks table: PK=publisherId, SK=articleId#chunkIdx
 *
 * Vectors are stored as JSON strings (DynamoDB has no native vector type).
 * For production, migrate to pgvector for ANN search instead of full scan.
 */
@Repository
public class DynamoCorpusRepository implements CorpusRepository {

    private static final Logger logger = LoggerFactory.getLogger(DynamoCorpusRepository.class);

    private final DynamoDbClient dynamoDbClient;
    private final ObjectMapper objectMapper;
    private final String articlesTable;
    private final String chunksTable;
    private boolean articlesTableEnsured = false;
    private boolean chunksTableEnsured = false;

    public DynamoCorpusRepository(DynamoDbClient dynamoDbClient,
                                  ObjectMapper objectMapper,
                                  @Value("${dynamodb.articles-table:comp-ledger-articles}") String articlesTable,
                                  @Value("${dynamodb.chunks-table:comp-ledger-chunks}") String chunksTable) {
        this.dynamoDbClient = dynamoDbClient;
        this.objectMapper = objectMapper;
        this.articlesTable = articlesTable;
        this.chunksTable = chunksTable;
    }

    @Override
    public Article saveArticle(Article article) {
        ensureArticlesTable();
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("publisherId", AttributeValue.builder().s(article.getPublisherId()).build());
        item.put("articleId", AttributeValue.builder().s(article.getId()).build());
        item.put("title", AttributeValue.builder().s(article.getTitle()).build());
        if (article.getSourceUrl() != null) {
            item.put("sourceUrl", AttributeValue.builder().s(article.getSourceUrl()).build());
        }
        item.put("chunkCount", AttributeValue.builder().n(String.valueOf(article.getChunkCount())).build());
        item.put("ingestedAt", AttributeValue.builder().s(article.getIngestedAt().toString()).build());

        dynamoDbClient.putItem(PutItemRequest.builder().tableName(articlesTable).item(item).build());
        return article;
    }

    @Override
    public Optional<Article> findArticleById(String publisherId, String articleId) {
        ensureArticlesTable();
        GetItemResponse response = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(articlesTable)
                .key(Map.of(
                        "publisherId", AttributeValue.builder().s(publisherId).build(),
                        "articleId", AttributeValue.builder().s(articleId).build()
                ))
                .build());
        if (!response.hasItem() || response.item().isEmpty()) return Optional.empty();
        return Optional.of(articleFromItem(response.item()));
    }

    @Override
    public List<Article> listArticles(String publisherId) {
        ensureArticlesTable();
        QueryResponse response = dynamoDbClient.query(QueryRequest.builder()
                .tableName(articlesTable)
                .keyConditionExpression("publisherId = :pid")
                .expressionAttributeValues(Map.of(":pid", AttributeValue.builder().s(publisherId).build()))
                .build());
        return response.items().stream().map(this::articleFromItem).collect(Collectors.toList());
    }

    @Override
    public void saveChunks(List<ArticleChunk> chunks) {
        ensureChunksTable();
        // DynamoDB BatchWriteItem supports max 25 items per call
        List<List<ArticleChunk>> batches = partition(chunks, 25);
        for (List<ArticleChunk> batch : batches) {
            List<WriteRequest> writeRequests = batch.stream()
                    .map(chunk -> {
                        Map<String, AttributeValue> item = new HashMap<>();
                        item.put("publisherId", AttributeValue.builder().s(chunk.getPublisherId()).build());
                        item.put("chunkKey", AttributeValue.builder().s(chunk.getArticleId() + "#" + chunk.getChunkIdx()).build());
                        item.put("articleId", AttributeValue.builder().s(chunk.getArticleId()).build());
                        item.put("chunkIdx", AttributeValue.builder().n(String.valueOf(chunk.getChunkIdx())).build());
                        item.put("text", AttributeValue.builder().s(chunk.getText()).build());
                        try {
                            item.put("vector", AttributeValue.builder().s(objectMapper.writeValueAsString(chunk.getVector())).build());
                        } catch (Exception e) {
                            throw new RuntimeException("Failed to serialize vector", e);
                        }
                        return WriteRequest.builder().putRequest(PutRequest.builder().item(item).build()).build();
                    })
                    .collect(Collectors.toList());

            dynamoDbClient.batchWriteItem(BatchWriteItemRequest.builder()
                    .requestItems(Map.of(chunksTable, writeRequests))
                    .build());
        }
    }

    @Override
    public List<ArticleChunk> getAllChunksForPublisher(String publisherId) {
        ensureChunksTable();
        List<ArticleChunk> allChunks = new ArrayList<>();
        Map<String, AttributeValue> lastKey = null;

        do {
            QueryRequest.Builder queryBuilder = QueryRequest.builder()
                    .tableName(chunksTable)
                    .keyConditionExpression("publisherId = :pid")
                    .expressionAttributeValues(Map.of(":pid", AttributeValue.builder().s(publisherId).build()));

            if (lastKey != null) {
                queryBuilder.exclusiveStartKey(lastKey);
            }

            QueryResponse response = dynamoDbClient.query(queryBuilder.build());
            for (Map<String, AttributeValue> item : response.items()) {
                allChunks.add(chunkFromItem(item));
            }
            lastKey = response.lastEvaluatedKey().isEmpty() ? null : response.lastEvaluatedKey();
        } while (lastKey != null);

        return allChunks;
    }

    @Override
    public void deleteArticle(String publisherId, String articleId) {
        ensureArticlesTable();
        ensureChunksTable();

        // Delete the article record
        dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                .tableName(articlesTable)
                .key(Map.of(
                        "publisherId", AttributeValue.builder().s(publisherId).build(),
                        "articleId", AttributeValue.builder().s(articleId).build()
                ))
                .build());

        // Delete all chunks for this article
        QueryResponse chunks = dynamoDbClient.query(QueryRequest.builder()
                .tableName(chunksTable)
                .keyConditionExpression("publisherId = :pid AND begins_with(chunkKey, :prefix)")
                .expressionAttributeValues(Map.of(
                        ":pid", AttributeValue.builder().s(publisherId).build(),
                        ":prefix", AttributeValue.builder().s(articleId + "#").build()
                ))
                .projectionExpression("publisherId, chunkKey")
                .build());

        for (Map<String, AttributeValue> item : chunks.items()) {
            dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                    .tableName(chunksTable)
                    .key(Map.of(
                            "publisherId", item.get("publisherId"),
                            "chunkKey", item.get("chunkKey")
                    ))
                    .build());
        }
    }

    private Article articleFromItem(Map<String, AttributeValue> item) {
        Article a = new Article();
        a.setId(item.get("articleId").s());
        a.setPublisherId(item.get("publisherId").s());
        a.setTitle(item.get("title").s());
        if (item.containsKey("sourceUrl")) a.setSourceUrl(item.get("sourceUrl").s());
        if (item.containsKey("chunkCount")) a.setChunkCount(Integer.parseInt(item.get("chunkCount").n()));
        if (item.containsKey("ingestedAt")) a.setIngestedAt(Instant.parse(item.get("ingestedAt").s()));
        return a;
    }

    private ArticleChunk chunkFromItem(Map<String, AttributeValue> item) {
        ArticleChunk c = new ArticleChunk();
        c.setPublisherId(item.get("publisherId").s());
        c.setArticleId(item.get("articleId").s());
        if (item.containsKey("chunkIdx")) c.setChunkIdx(Integer.parseInt(item.get("chunkIdx").n()));
        c.setText(item.get("text").s());
        try {
            List<Double> vector = objectMapper.readValue(item.get("vector").s(), new TypeReference<List<Double>>() {});
            c.setVector(vector);
        } catch (Exception e) {
            logger.warn("Failed to deserialize vector for chunk {}", item.get("chunkKey").s());
            c.setVector(List.of());
        }
        return c;
    }

    private <T> List<List<T>> partition(List<T> list, int size) {
        List<List<T>> partitions = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) {
            partitions.add(list.subList(i, Math.min(i + size, list.size())));
        }
        return partitions;
    }

    private synchronized void ensureArticlesTable() {
        if (articlesTableEnsured) return;
        articlesTableEnsured = ensureTableExists(articlesTable,
                "publisherId", ScalarAttributeType.S,
                "articleId", ScalarAttributeType.S);
    }

    private synchronized void ensureChunksTable() {
        if (chunksTableEnsured) return;
        chunksTableEnsured = ensureTableExists(chunksTable,
                "publisherId", ScalarAttributeType.S,
                "chunkKey", ScalarAttributeType.S);
    }

    private boolean ensureTableExists(String tableName, String pk, ScalarAttributeType pkType,
                                       String sk, ScalarAttributeType skType) {
        try {
            DescribeTableResponse desc = dynamoDbClient.describeTable(
                    DescribeTableRequest.builder().tableName(tableName).build());
            if (desc.table().tableStatus() == TableStatus.ACTIVE) return true;
            waitForTable(tableName);
            return true;
        } catch (ResourceNotFoundException e) {
            logger.info("Creating DynamoDB table '{}'...", tableName);
            dynamoDbClient.createTable(CreateTableRequest.builder()
                    .tableName(tableName)
                    .keySchema(
                            KeySchemaElement.builder().attributeName(pk).keyType(KeyType.HASH).build(),
                            KeySchemaElement.builder().attributeName(sk).keyType(KeyType.RANGE).build()
                    )
                    .attributeDefinitions(
                            AttributeDefinition.builder().attributeName(pk).attributeType(pkType).build(),
                            AttributeDefinition.builder().attributeName(sk).attributeType(skType).build()
                    )
                    .billingMode(BillingMode.PAY_PER_REQUEST)
                    .build());
            waitForTable(tableName);
            logger.info("DynamoDB table '{}' created and active", tableName);
            return true;
        }
    }

    private void waitForTable(String tableName) {
        for (int i = 0; i < 30; i++) {
            try {
                DescribeTableResponse desc = dynamoDbClient.describeTable(
                        DescribeTableRequest.builder().tableName(tableName).build());
                if (desc.table().tableStatus() == TableStatus.ACTIVE) return;
                Thread.sleep(1000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Interrupted waiting for DynamoDB table", ie);
            }
        }
        throw new RuntimeException("DynamoDB table " + tableName + " did not become ACTIVE within 30 seconds");
    }
}
