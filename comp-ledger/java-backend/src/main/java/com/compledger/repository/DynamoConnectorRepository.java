package com.compledger.repository;

import com.compledger.model.SourceConnector;
import com.compledger.model.SyncJob;
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
 * DynamoDB implementation of ConnectorRepository.
 *
 * Uses two tables:
 *   - Connectors table (comp-ledger-connectors):
 *       PK = publisherId, SK = connectorId
 *       Stores the full connector configuration as a flat item.
 *       Field mappings are stored as a JSON string attribute.
 *
 *   - SyncJobs table (comp-ledger-sync-jobs):
 *       PK = connectorId, SK = jobId
 *       Stores each sync execution's metadata and results.
 *
 * Both tables are auto-created on first access with PAY_PER_REQUEST billing.
 * In production, pre-create tables with proper provisioned capacity.
 */
@Repository
public class DynamoConnectorRepository implements ConnectorRepository {

    private static final Logger logger = LoggerFactory.getLogger(DynamoConnectorRepository.class);

    private final DynamoDbClient dynamoDbClient;
    private final ObjectMapper objectMapper;
    private final String connectorsTable;
    private final String syncJobsTable;

    // Flags to avoid repeated DescribeTable calls after first successful check
    private boolean connectorsTableEnsured = false;
    private boolean syncJobsTableEnsured = false;

    public DynamoConnectorRepository(
            DynamoDbClient dynamoDbClient,
            ObjectMapper objectMapper,
            @Value("${dynamodb.connectors-table:comp-ledger-connectors}") String connectorsTable,
            @Value("${dynamodb.sync-jobs-table:comp-ledger-sync-jobs}") String syncJobsTable) {
        this.dynamoDbClient = dynamoDbClient;
        this.objectMapper = objectMapper;
        this.connectorsTable = connectorsTable;
        this.syncJobsTable = syncJobsTable;
    }

    // ===================== Connector CRUD =====================

    @Override
    public SourceConnector saveConnector(SourceConnector connector) {
        ensureConnectorsTable();

        // Build the DynamoDB item from connector fields
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("publisherId", attr(connector.getPublisherId()));
        item.put("connectorId", attr(connector.getId()));
        item.put("name", attr(connector.getName()));
        item.put("baseUrl", attr(connector.getBaseUrl()));
        item.put("authType", attr(connector.getAuthType()));

        // Only store auth fields if present (avoid null attributes)
        if (connector.getAuthHeader() != null) item.put("authHeader", attr(connector.getAuthHeader()));
        if (connector.getAuthValue() != null) item.put("authValue", attr(connector.getAuthValue()));
        if (connector.getListEndpoint() != null) item.put("listEndpoint", attr(connector.getListEndpoint()));
        if (connector.getDetailEndpoint() != null) item.put("detailEndpoint", attr(connector.getDetailEndpoint()));
        if (connector.getArticlesJsonPath() != null) item.put("articlesJsonPath", attr(connector.getArticlesJsonPath()));
        if (connector.getPaginationType() != null) item.put("paginationType", attr(connector.getPaginationType()));
        if (connector.getCursorJsonPath() != null) item.put("cursorJsonPath", attr(connector.getCursorJsonPath()));
        if (connector.getCursorParam() != null) item.put("cursorParam", attr(connector.getCursorParam()));

        // Store numeric fields
        item.put("pageSize", numAttr(connector.getPageSize()));
        item.put("maxArticles", numAttr(connector.getMaxArticles()));

        // Store field mappings as a JSON string (flexible schema)
        if (connector.getFieldMappings() != null) {
            try {
                item.put("fieldMappings", attr(objectMapper.writeValueAsString(connector.getFieldMappings())));
            } catch (Exception e) {
                logger.warn("Failed to serialize field mappings for connector {}", connector.getId());
            }
        }

        // Status and timestamps
        item.put("status", attr(connector.getStatus() != null ? connector.getStatus() : "ACTIVE"));
        if (connector.getLastSyncAt() != null) item.put("lastSyncAt", attr(connector.getLastSyncAt().toString()));
        item.put("lastSyncCount", numAttr(connector.getLastSyncCount()));
        if (connector.getLastError() != null) item.put("lastError", attr(connector.getLastError()));
        if (connector.getCreatedAt() != null) item.put("createdAt", attr(connector.getCreatedAt().toString()));
        if (connector.getUpdatedAt() != null) item.put("updatedAt", attr(connector.getUpdatedAt().toString()));

        dynamoDbClient.putItem(PutItemRequest.builder().tableName(connectorsTable).item(item).build());
        return connector;
    }

    @Override
    public Optional<SourceConnector> findConnectorById(String publisherId, String connectorId) {
        ensureConnectorsTable();

        GetItemResponse response = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(connectorsTable)
                .key(Map.of(
                        "publisherId", attr(publisherId),
                        "connectorId", attr(connectorId)
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) return Optional.empty();
        return Optional.of(connectorFromItem(response.item()));
    }

    @Override
    public List<SourceConnector> listConnectors(String publisherId) {
        ensureConnectorsTable();

        // Query all connectors for this publisher (PK = publisherId)
        QueryResponse response = dynamoDbClient.query(QueryRequest.builder()
                .tableName(connectorsTable)
                .keyConditionExpression("publisherId = :pid")
                .expressionAttributeValues(Map.of(":pid", attr(publisherId)))
                .scanIndexForward(false) // newest first by sort key
                .build());

        return response.items().stream()
                .map(this::connectorFromItem)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteConnector(String publisherId, String connectorId) {
        ensureConnectorsTable();

        // Delete the connector record
        dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                .tableName(connectorsTable)
                .key(Map.of(
                        "publisherId", attr(publisherId),
                        "connectorId", attr(connectorId)
                ))
                .build());

        // Cascade: delete all sync jobs for this connector
        ensureSyncJobsTable();
        QueryResponse jobs = dynamoDbClient.query(QueryRequest.builder()
                .tableName(syncJobsTable)
                .keyConditionExpression("connectorId = :cid")
                .expressionAttributeValues(Map.of(":cid", attr(connectorId)))
                .projectionExpression("connectorId, jobId")
                .build());

        // Delete each job record (batch would be more efficient for large counts)
        for (Map<String, AttributeValue> item : jobs.items()) {
            dynamoDbClient.deleteItem(DeleteItemRequest.builder()
                    .tableName(syncJobsTable)
                    .key(Map.of(
                            "connectorId", item.get("connectorId"),
                            "jobId", item.get("jobId")
                    ))
                    .build());
        }
    }

    // ===================== SyncJob Tracking =====================

    @Override
    public SyncJob saveSyncJob(SyncJob job) {
        ensureSyncJobsTable();

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("connectorId", attr(job.getConnectorId()));
        item.put("jobId", attr(job.getId()));
        item.put("publisherId", attr(job.getPublisherId()));
        item.put("status", attr(job.getStatus()));
        item.put("articlesFound", numAttr(job.getArticlesFound()));
        item.put("articlesIngested", numAttr(job.getArticlesIngested()));
        item.put("articlesFailed", numAttr(job.getArticlesFailed()));
        item.put("articlesSkipped", numAttr(job.getArticlesSkipped()));
        if (job.getStartedAt() != null) item.put("startedAt", attr(job.getStartedAt().toString()));
        if (job.getCompletedAt() != null) item.put("completedAt", attr(job.getCompletedAt().toString()));
        if (job.getErrorMessage() != null) item.put("errorMessage", attr(job.getErrorMessage()));
        if (job.getProgressMessage() != null) item.put("progressMessage", attr(job.getProgressMessage()));

        dynamoDbClient.putItem(PutItemRequest.builder().tableName(syncJobsTable).item(item).build());
        return job;
    }

    @Override
    public List<SyncJob> listSyncJobs(String connectorId, int limit) {
        ensureSyncJobsTable();

        QueryResponse response = dynamoDbClient.query(QueryRequest.builder()
                .tableName(syncJobsTable)
                .keyConditionExpression("connectorId = :cid")
                .expressionAttributeValues(Map.of(":cid", attr(connectorId)))
                .scanIndexForward(false) // newest first
                .limit(limit)
                .build());

        return response.items().stream()
                .map(this::syncJobFromItem)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<SyncJob> findSyncJobById(String connectorId, String jobId) {
        ensureSyncJobsTable();

        GetItemResponse response = dynamoDbClient.getItem(GetItemRequest.builder()
                .tableName(syncJobsTable)
                .key(Map.of(
                        "connectorId", attr(connectorId),
                        "jobId", attr(jobId)
                ))
                .build());

        if (!response.hasItem() || response.item().isEmpty()) return Optional.empty();
        return Optional.of(syncJobFromItem(response.item()));
    }

    // ===================== Item Mappers =====================

    /**
     * Reconstructs a SourceConnector from a DynamoDB item map.
     * Handles missing/optional fields gracefully with null checks.
     */
    private SourceConnector connectorFromItem(Map<String, AttributeValue> item) {
        SourceConnector c = new SourceConnector();
        c.setId(getStr(item, "connectorId"));
        c.setPublisherId(getStr(item, "publisherId"));
        c.setName(getStr(item, "name"));
        c.setBaseUrl(getStr(item, "baseUrl"));
        c.setAuthType(getStr(item, "authType"));
        c.setAuthHeader(getStr(item, "authHeader"));
        c.setAuthValue(getStr(item, "authValue"));
        c.setListEndpoint(getStr(item, "listEndpoint"));
        c.setDetailEndpoint(getStr(item, "detailEndpoint"));
        c.setArticlesJsonPath(getStr(item, "articlesJsonPath"));
        c.setPaginationType(getStr(item, "paginationType"));
        c.setCursorJsonPath(getStr(item, "cursorJsonPath"));
        c.setCursorParam(getStr(item, "cursorParam"));
        c.setPageSize(getInt(item, "pageSize", 50));
        c.setMaxArticles(getInt(item, "maxArticles", 0));
        c.setStatus(getStr(item, "status"));
        c.setLastSyncCount(getInt(item, "lastSyncCount", 0));
        c.setLastError(getStr(item, "lastError"));

        // Parse field mappings from JSON string
        String mappingsJson = getStr(item, "fieldMappings");
        if (mappingsJson != null) {
            try {
                c.setFieldMappings(objectMapper.readValue(mappingsJson, new TypeReference<Map<String, String>>() {}));
            } catch (Exception e) {
                logger.warn("Failed to parse field mappings for connector {}", c.getId());
                c.setFieldMappings(Map.of());
            }
        }

        // Parse timestamps
        String lastSync = getStr(item, "lastSyncAt");
        if (lastSync != null) c.setLastSyncAt(Instant.parse(lastSync));
        String created = getStr(item, "createdAt");
        if (created != null) c.setCreatedAt(Instant.parse(created));
        String updated = getStr(item, "updatedAt");
        if (updated != null) c.setUpdatedAt(Instant.parse(updated));

        return c;
    }

    /**
     * Reconstructs a SyncJob from a DynamoDB item map.
     */
    private SyncJob syncJobFromItem(Map<String, AttributeValue> item) {
        SyncJob j = new SyncJob();
        j.setId(getStr(item, "jobId"));
        j.setConnectorId(getStr(item, "connectorId"));
        j.setPublisherId(getStr(item, "publisherId"));
        j.setStatus(getStr(item, "status"));
        j.setArticlesFound(getInt(item, "articlesFound", 0));
        j.setArticlesIngested(getInt(item, "articlesIngested", 0));
        j.setArticlesFailed(getInt(item, "articlesFailed", 0));
        j.setArticlesSkipped(getInt(item, "articlesSkipped", 0));
        j.setErrorMessage(getStr(item, "errorMessage"));
        j.setProgressMessage(getStr(item, "progressMessage"));

        String started = getStr(item, "startedAt");
        if (started != null) j.setStartedAt(Instant.parse(started));
        String completed = getStr(item, "completedAt");
        if (completed != null) j.setCompletedAt(Instant.parse(completed));

        return j;
    }

    // ===================== Table Management =====================

    /** Ensures the connectors table exists, creating it if needed */
    private synchronized void ensureConnectorsTable() {
        if (connectorsTableEnsured) return;
        connectorsTableEnsured = ensureTableExists(connectorsTable,
                "publisherId", ScalarAttributeType.S,
                "connectorId", ScalarAttributeType.S);
    }

    /** Ensures the sync jobs table exists, creating it if needed */
    private synchronized void ensureSyncJobsTable() {
        if (syncJobsTableEnsured) return;
        syncJobsTableEnsured = ensureTableExists(syncJobsTable,
                "connectorId", ScalarAttributeType.S,
                "jobId", ScalarAttributeType.S);
    }

    /**
     * Checks if a table exists and creates it if not.
     * Waits for the table to become ACTIVE before returning.
     */
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

    /** Polls until the table reaches ACTIVE status or times out after 30 seconds */
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

    // ===================== Utility Helpers =====================

    /** Creates a string AttributeValue */
    private AttributeValue attr(String value) {
        return AttributeValue.builder().s(value).build();
    }

    /** Creates a numeric AttributeValue from an int */
    private AttributeValue numAttr(int value) {
        return AttributeValue.builder().n(String.valueOf(value)).build();
    }

    /** Safely extracts a string from a DynamoDB item, returns null if missing */
    private String getStr(Map<String, AttributeValue> item, String key) {
        AttributeValue av = item.get(key);
        return (av != null && av.s() != null) ? av.s() : null;
    }

    /** Safely extracts an int from a DynamoDB item, returns defaultVal if missing */
    private int getInt(Map<String, AttributeValue> item, String key, int defaultVal) {
        AttributeValue av = item.get(key);
        return (av != null && av.n() != null) ? Integer.parseInt(av.n()) : defaultVal;
    }
}
