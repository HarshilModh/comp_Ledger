package com.compledger.service;

import com.compledger.model.IndexData;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;

/**
 * Loads the pre-built embedding index from disk into memory at startup.
 *
 * The index (index.json) is produced by the Node.js build-index script and contains
 * 512-dimensional embedding vectors for all publisher and reference corpus chunks.
 * It is held in memory for the lifetime of the process so every trace request can
 * perform fast in-memory cosine search without hitting Bedrock for retrieval.
 */
@Service
public class IndexService {

    private static final Logger logger = LoggerFactory.getLogger(IndexService.class);

    /** Path to the data directory, configured via application.properties (data.dir) */
    @Value("${data.dir}")
    private String dataDir;

    @Autowired
    private ObjectMapper objectMapper;

    /** The in-memory index, null if the file was missing or failed to parse */
    private IndexData indexData;

    /**
     * Runs automatically after Spring has injected all dependencies.
     * Reads index.json, deserialises it into an IndexData object, and logs
     * how many chunks were loaded for each corpus side.
     * If the file is missing, logs a warning and leaves indexData null —
     * RetrieveService will throw an IllegalStateException if a trace is attempted.
     */
    @PostConstruct
    public void loadIndex() {
        File indexFile = new File(dataDir, "index.json");
        if (!indexFile.exists()) {
            logger.warn("WARNING: No index.json found at {}. Run 'npm run build-index' first.",
                    indexFile.getAbsolutePath());
            return;
        }

        try {
            logger.info("Loading embedding index from {}...", indexFile.getAbsolutePath());
            indexData = objectMapper.readValue(indexFile, IndexData.class);

            // Count chunks on each side for the startup log message
            int publisherCount = indexData.getPublisher() != null && indexData.getPublisher().getChunks() != null
                    ? indexData.getPublisher().getChunks().size() : 0;
            int referenceCount = indexData.getReference() != null && indexData.getReference().getChunks() != null
                    ? indexData.getReference().getChunks().size() : 0;

            logger.info("Index loaded: {} publisher chunks, {} reference chunks",
                    publisherCount, referenceCount);
        } catch (Exception e) {
            logger.error("Failed to load index.json: {}", e.getMessage(), e);
        }
    }

    /**
     * Returns the loaded index, or null if the index was never loaded successfully.
     * Callers (RetrieveService) must check for null before using it.
     */
    public IndexData getIndex() {
        return indexData;
    }
}
