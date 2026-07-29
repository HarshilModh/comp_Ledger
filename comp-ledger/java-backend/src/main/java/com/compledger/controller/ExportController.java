package com.compledger.controller;

import com.compledger.model.ExportRequest;
import com.compledger.service.S3Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Export", description = "Package and persist a scored trace as an evidence record")
@RestController
public class ExportController {

    private static final Logger logger = LoggerFactory.getLogger(ExportController.class);

    @Autowired
    private S3Service s3Service;

    @Autowired
    private ObjectMapper objectMapper;

    @Operation(
            summary = "Export a trace as an evidence record",
            description = """
                    Packages a completed trace into a signed, immutable **CoMP evidence record** \
                    and attempts to persist it to S3.

                    The record captures publisher identity, the original query, every scored claim \
                    with its exclusivity and fingerprint data, summary metrics, and a SHA-256 \
                    integrity hash.

                    **S3 availability:**
                    - If `S3_BUCKET` is configured and writable, the response includes a non-null `s3_uri`.
                    - If S3 is unavailable the record is returned inline with `s3_uri: null` and \
                    `s3_error` describing the failure. The SHA-256 hash is always present in both paths.

                    **Response fields:**
                    | Field | Type | Description |
                    |---|---|---|
                    | `s3_uri` | string \\| null | S3 URI of the persisted record, or null on fallback |
                    | `s3_error` | string | Present only when S3 write failed |
                    | `sha256` | string | SHA-256 hex digest of the evidence record JSON |
                    | `record` | object | The full evidence record (present on fallback path) |
                    """)
    @ApiResponse(
            responseCode = "200",
            description = "Evidence record created (S3 path or inline fallback)",
            content = @Content(
                    mediaType = "application/json",
                    examples = {
                            @ExampleObject(name = "S3 success", value =
                                    "{\"s3_uri\": \"s3://my-bucket/evidence-records/2024-01-01T00:00:00Z.json\", " +
                                    "\"sha256\": \"abc123...\"}"),
                            @ExampleObject(name = "S3 fallback", value =
                                    "{\"s3_uri\": null, \"s3_error\": \"No bucket configured\", " +
                                    "\"sha256\": \"abc123...\", \"record\": {\"version\": \"1.0\", \"type\": \"comp_evidence_record\", \"...\": \"...\"}}")
                    }))
    @ApiResponse(responseCode = "500", description = "Unexpected server error (JSON serialization or hashing failure)")
    @PostMapping("/api/export")
    public Map<String, Object> export(
            @org.springframework.web.bind.annotation.RequestBody
            @RequestBody(
                    description = "The scored claims produced by `/api/trace` plus query and publisher metadata",
                    required = true,
                    content = @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = ExportRequest.class),
                            examples = @ExampleObject(value =
                                    "{\"question\": \"When was OpenAI founded?\", " +
                                    "\"answer\": \"OpenAI was founded in December 2015.\", " +
                                    "\"publisher_name\": \"Silicon Insider\", " +
                                    "\"claims\": [{\"claim_id\": 1, \"claim_text\": \"OpenAI was founded in December 2015.\", " +
                                    "\"exclusivity_score\": 0.2, \"agreement_active\": false}]}")))
            ExportRequest exportRequest) throws Exception {
        List<Map<String, Object>> claims = exportRequest.getClaims();
        String question = exportRequest.getQuestion();
        String answer = exportRequest.getAnswer();
        String publisherName = exportRequest.getPublisherName() != null
                ? exportRequest.getPublisherName() : "Silicon Insider";

        // Count claims with exclusivity_score >= 0.5 (publisher-exclusive facts)
        long exclusiveClaimsCount = claims.stream()
                .filter(c -> {
                    Object score = c.get("exclusivity_score");
                    if (score instanceof Number) {
                        return ((Number) score).doubleValue() >= 0.5;
                    }
                    return false;
                })
                .count();

        // Count claims where the fingerprint detector flagged publisher-specific phrasing
        long fingerprintedClaimsCount = claims.stream()
                .filter(c -> {
                    Object fp = c.get("fingerprint");
                    if (fp instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> fpMap = (Map<String, Object>) fp;
                        return Boolean.TRUE.equals(fpMap.get("detected"));
                    }
                    return false;
                })
                .count();

        // Sum all exclusivity scores to compute the average
        double totalExclusivity = claims.stream()
                .mapToDouble(c -> {
                    Object score = c.get("exclusivity_score");
                    if (score instanceof Number) return ((Number) score).doubleValue();
                    return 0.0;
                })
                .sum();

        // Round average to 2 decimal places to match the JS implementation
        double averageExclusivity = claims.size() > 0
                ? Math.round(totalExclusivity / claims.size() * 100.0) / 100.0
                : 0.0;

        // Build the top-level evidence record using LinkedHashMap to preserve field order in JSON
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("version", "1.0");
        record.put("type", "comp_evidence_record");
        record.put("generated_at", Instant.now().toString());
        record.put("generator", "comp-ledger/0.1.0");

        // Publisher identity block
        Map<String, Object> publisher = new LinkedHashMap<>();
        publisher.put("name", publisherName);
        String archiveId = publisherName.toLowerCase().replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-|-$", "");
        publisher.put("archive_id", archiveId);
        record.put("publisher", publisher);

        // Original query that was traced
        Map<String, Object> query = new LinkedHashMap<>();
        query.put("question", question);
        query.put("answer", answer);
        record.put("query", query);

        // Map each raw claim event to a clean, standardised claim object for the record
        List<Map<String, Object>> mappedClaims = new ArrayList<>();
        for (Map<String, Object> c : claims) {
            Map<String, Object> mappedClaim = new LinkedHashMap<>();
            mappedClaim.put("id", c.get("claim_id"));
            mappedClaim.put("text", c.get("claim_text"));
            mappedClaim.put("exclusivity_score", c.get("exclusivity_score"));

            // Extract independent_source_count from the nested exclusivity map
            @SuppressWarnings("unchecked")
            Map<String, Object> exclusivity = (Map<String, Object>) c.get("exclusivity");
            int independentSourceCount = exclusivity != null
                    ? ((Number) exclusivity.getOrDefault("independent_source_count", 0)).intValue()
                    : 0;
            mappedClaim.put("independent_source_count", independentSourceCount);

            // Include match and fingerprint as-is, or safe defaults if missing
            Object match = c.get("match");
            mappedClaim.put("match", match != null ? match : Map.of("found", false));

            Object fingerprint = c.get("fingerprint");
            mappedClaim.put("fingerprint", fingerprint != null ? fingerprint : Map.of("detected", false));

            // Translate the boolean agreement_active flag to a human-readable string
            Object agreementRaw = c.get("agreement_active");
            boolean agreementActive = agreementRaw instanceof Boolean && (Boolean) agreementRaw;
            mappedClaim.put("agreement_status", agreementActive ? "covered" : "unlicensed");

            mappedClaims.add(mappedClaim);
        }
        record.put("claims", mappedClaims);

        // Summary metrics block
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total_claims", claims.size());
        summary.put("exclusive_claims", (int) exclusiveClaimsCount);
        summary.put("fingerprinted_claims", (int) fingerprintedClaimsCount);
        summary.put("average_exclusivity", averageExclusivity);
        record.put("summary", summary);

        // Attempt to write to S3; fall back to returning the record locally if S3 is unavailable
        try {
            return s3Service.writeEvidenceRecord(record);
        } catch (Exception err) {
            logger.warn("S3 write failed, returning record without S3 URI: {}", err.getMessage());

            // Compute SHA-256 locally so the response still includes an integrity hash
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(record);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            String sha256 = hexString.toString();

            // Attach the integrity field to the record even in the fallback path
            Map<String, Object> integrity = new HashMap<>();
            integrity.put("sha256", sha256);
            record.put("integrity", integrity);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("s3_uri", null);           // null signals to the UI that S3 was unavailable
            result.put("s3_error", err.getMessage());
            result.put("sha256", sha256);
            result.put("record", record);
            return result;
        }
    }
}
