package com.compledger.repository;

import com.compledger.model.Publisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.*;
import software.amazon.awssdk.services.dynamodb.model.DescribeTableResponse;
import software.amazon.awssdk.services.dynamodb.model.TableStatus;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * DynamoDB implementation of PublisherRepository.
 *
 * Table schema:
 *   - Partition key: "id" (String)
 *   - GSI "apiKey-index": partition key "apiKey" (String)
 *   - GSI "email-index": partition key "email" (String)
 *
 * The table and GSIs are auto-created on first use if they don't exist.
 */
@Repository
public class DynamoPublisherRepository implements PublisherRepository {

    private static final Logger logger = LoggerFactory.getLogger(DynamoPublisherRepository.class);

    private final DynamoDbClient dynamoDbClient;
    private final String tableName;
    private boolean tableEnsured = false;

    public DynamoPublisherRepository(DynamoDbClient dynamoDbClient,
                                     @Value("${dynamodb.publishers-table:comp-ledger-publishers}") String tableName) {
        this.dynamoDbClient = dynamoDbClient;
        this.tableName = tableName;
    }

    @Override
    public Publisher save(Publisher publisher) {
        ensureTable();
        Map<String, AttributeValue> item = toItem(publisher);
        dynamoDbClient.putItem(PutItemRequest.builder()
                .tableName(tableName)
                .item(item)
                .build());
        return publisher;
    }

    @Override
    public Optional<Publisher> findById(String id) {
        ensureTable();
        GetItemResponse response = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("id", AttributeValue.builder().s(id).build()))
                .build());
        if (!response.hasItem() || response.item().isEmpty()) return Optional.empty();
        return Optional.of(fromItem(response.item()));
    }

    @Override
    public Optional<Publisher> findByApiKey(String apiKey) {
        ensureTable();
        QueryResponse response = dynamoDbClient.query(QueryRequest.builder()
                .tableName(tableName)
                .indexName("apiKey-index")
                .keyConditionExpression("apiKey = :key")
                .expressionAttributeValues(Map.of(":key", AttributeValue.builder().s(apiKey).build()))
                .limit(1)
                .build());
        if (response.items().isEmpty()) return Optional.empty();
        return Optional.of(fromItem(response.items().get(0)));
    }

    @Override
    public Optional<Publisher> findByEmail(String email) {
        ensureTable();
        QueryResponse response = dynamoDbClient.query(QueryRequest.builder()
                .tableName(tableName)
                .indexName("email-index")
                .keyConditionExpression("email = :email")
                .expressionAttributeValues(Map.of(":email", AttributeValue.builder().s(email).build()))
                .limit(1)
                .build());
        if (response.items().isEmpty()) return Optional.empty();
        return Optional.of(fromItem(response.items().get(0)));
    }

    @Override
    public void deleteById(String id) {
        ensureTable();
        dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                .tableName(tableName)
                .key(Map.of("id", AttributeValue.builder().s(id).build()))
                .build());
    }

    private Map<String, AttributeValue> toItem(Publisher p) {
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("id", AttributeValue.builder().s(p.getId()).build());
        item.put("name", AttributeValue.builder().s(p.getName()).build());
        item.put("email", AttributeValue.builder().s(p.getEmail()).build());
        item.put("apiKey", AttributeValue.builder().s(p.getApiKey()).build());
        item.put("createdAt", AttributeValue.builder().s(p.getCreatedAt().toString()).build());
        return item;
    }

    private Publisher fromItem(Map<String, AttributeValue> item) {
        Publisher p = new Publisher();
        p.setId(item.get("id").s());
        p.setName(item.get("name").s());
        p.setEmail(item.get("email").s());
        p.setApiKey(item.get("apiKey").s());
        if (item.containsKey("createdAt")) {
            p.setCreatedAt(Instant.parse(item.get("createdAt").s()));
        }
        return p;
    }

    private synchronized void ensureTable() {
        if (tableEnsured) return;
        try {
            DescribeTableResponse desc = dynamoDbClient.describeTable(
                    DescribeTableRequest.builder().tableName(tableName).build());
            if (desc.table().tableStatus() == TableStatus.ACTIVE) {
                tableEnsured = true;
            } else {
                waitForTableActive();
            }
        } catch (ResourceNotFoundException e) {
            logger.info("Creating DynamoDB table '{}'...", tableName);
            dynamoDbClient.createTable(CreateTableRequest.builder()
                    .tableName(tableName)
                    .keySchema(KeySchemaElement.builder().attributeName("id").keyType(KeyType.HASH).build())
                    .attributeDefinitions(
                            AttributeDefinition.builder().attributeName("id").attributeType(ScalarAttributeType.S).build(),
                            AttributeDefinition.builder().attributeName("apiKey").attributeType(ScalarAttributeType.S).build(),
                            AttributeDefinition.builder().attributeName("email").attributeType(ScalarAttributeType.S).build()
                    )
                    .globalSecondaryIndexes(
                            GlobalSecondaryIndex.builder()
                                    .indexName("apiKey-index")
                                    .keySchema(KeySchemaElement.builder().attributeName("apiKey").keyType(KeyType.HASH).build())
                                    .projection(Projection.builder().projectionType(ProjectionType.ALL).build())
                                    .build(),
                            GlobalSecondaryIndex.builder()
                                    .indexName("email-index")
                                    .keySchema(KeySchemaElement.builder().attributeName("email").keyType(KeyType.HASH).build())
                                    .projection(Projection.builder().projectionType(ProjectionType.ALL).build())
                                    .build()
                    )
                    .billingMode(BillingMode.PAY_PER_REQUEST)
                    .build());
            waitForTableActive();
            logger.info("DynamoDB table '{}' created and active", tableName);
        }
    }

    private void waitForTableActive() {
        for (int i = 0; i < 30; i++) {
            try {
                DescribeTableResponse desc = dynamoDbClient.describeTable(
                        DescribeTableRequest.builder().tableName(tableName).build());
                if (desc.table().tableStatus() == TableStatus.ACTIVE) {
                    tableEnsured = true;
                    return;
                }
                Thread.sleep(1000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new RuntimeException("Interrupted waiting for DynamoDB table", ie);
            }
        }
        throw new RuntimeException("DynamoDB table did not become ACTIVE within 30 seconds");
    }
}
