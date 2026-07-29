package com.compledger.model;

import java.time.Instant;

/**
 * Represents a single sync execution for a SourceConnector.
 *
 * Each time a connector runs (manually triggered or via the scheduler),
 * a SyncJob record is created to track progress and results. This allows
 * publishers to see their sync history and debug failures.
 *
 * Lifecycle: QUEUED → RUNNING → COMPLETED | FAILED | CANCELLED
 */
public class SyncJob {

    /** Unique identifier for this sync run */
    private String id;

    /** The connector that triggered this sync */
    private String connectorId;

    /** Publisher who owns this connector */
    private String publisherId;

    /**
     * Current job status:
     * - QUEUED: waiting to be picked up by a worker
     * - RUNNING: actively fetching and indexing articles
     * - COMPLETED: finished successfully
     * - FAILED: encountered an unrecoverable error
     * - CANCELLED: manually stopped by the publisher
     */
    private String status;

    /** Total articles discovered from the publisher's API */
    private int articlesFound;

    /** Articles successfully chunked, embedded, and stored */
    private int articlesIngested;

    /** Articles that failed to process (bad format, embedding error, etc.) */
    private int articlesFailed;

    /** Articles skipped because they were already in the corpus */
    private int articlesSkipped;

    /** When this job was created/queued */
    private Instant startedAt;

    /** When this job finished (completed, failed, or cancelled) */
    private Instant completedAt;

    /** Error message if status is FAILED */
    private String errorMessage;

    /** Human-readable progress message (e.g., "Processing page 5 of 20") */
    private String progressMessage;

    // --- Getters and Setters ---

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getConnectorId() { return connectorId; }
    public void setConnectorId(String connectorId) { this.connectorId = connectorId; }

    public String getPublisherId() { return publisherId; }
    public void setPublisherId(String publisherId) { this.publisherId = publisherId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getArticlesFound() { return articlesFound; }
    public void setArticlesFound(int articlesFound) { this.articlesFound = articlesFound; }

    public int getArticlesIngested() { return articlesIngested; }
    public void setArticlesIngested(int articlesIngested) { this.articlesIngested = articlesIngested; }

    public int getArticlesFailed() { return articlesFailed; }
    public void setArticlesFailed(int articlesFailed) { this.articlesFailed = articlesFailed; }

    public int getArticlesSkipped() { return articlesSkipped; }
    public void setArticlesSkipped(int articlesSkipped) { this.articlesSkipped = articlesSkipped; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public String getProgressMessage() { return progressMessage; }
    public void setProgressMessage(String progressMessage) { this.progressMessage = progressMessage; }
}
