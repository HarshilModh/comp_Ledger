package com.compledger.repository;

import com.compledger.model.SourceConnector;
import com.compledger.model.SyncJob;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for managing SourceConnector configurations and SyncJob records.
 *
 * This interface abstracts the storage layer so we can swap DynamoDB for
 * PostgreSQL later without changing business logic. See changes-to-do.md
 * for migration steps.
 *
 * Two DynamoDB tables back this interface:
 *   - Connectors table: PK=publisherId, SK=connectorId
 *   - SyncJobs table: PK=connectorId, SK=jobId
 */
public interface ConnectorRepository {

    // --- Connector CRUD ---

    /**
     * Persists a connector configuration.
     * Creates a new record or overwrites an existing one with the same ID.
     *
     * @param connector the connector config to save
     * @return the saved connector (same object, passed through)
     */
    SourceConnector saveConnector(SourceConnector connector);

    /**
     * Retrieves a specific connector by publisher and connector ID.
     *
     * @param publisherId the owning publisher's ID (partition key)
     * @param connectorId the connector's unique ID (sort key)
     * @return the connector if found, empty otherwise
     */
    Optional<SourceConnector> findConnectorById(String publisherId, String connectorId);

    /**
     * Lists all connectors for a given publisher.
     * Used to display the publisher's configured API sources.
     *
     * @param publisherId the publisher whose connectors to list
     * @return all connectors, ordered by creation date (newest first)
     */
    List<SourceConnector> listConnectors(String publisherId);

    /**
     * Deletes a connector and all its associated sync job records.
     * This is a cascading delete — removing the connector also removes history.
     *
     * @param publisherId the owning publisher's ID
     * @param connectorId the connector to delete
     */
    void deleteConnector(String publisherId, String connectorId);

    // --- SyncJob tracking ---

    /**
     * Saves or updates a sync job record.
     * Called at job start (status=RUNNING) and job end (status=COMPLETED/FAILED).
     *
     * @param job the sync job to persist
     * @return the saved job
     */
    SyncJob saveSyncJob(SyncJob job);

    /**
     * Lists recent sync jobs for a connector, most recent first.
     * Used to show sync history in the UI.
     *
     * @param connectorId the connector whose jobs to list
     * @param limit maximum number of jobs to return
     * @return recent sync jobs
     */
    List<SyncJob> listSyncJobs(String connectorId, int limit);

    /**
     * Retrieves a specific sync job by ID.
     *
     * @param connectorId the connector this job belongs to
     * @param jobId the job's unique ID
     * @return the job if found, empty otherwise
     */
    Optional<SyncJob> findSyncJobById(String connectorId, String jobId);
}
