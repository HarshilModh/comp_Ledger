package com.compledger.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * Writes immutable evidence records to S3 with a SHA-256 content hash.
 *
 * The hash is computed before the integrity field is added, then the integrity
 * field (containing the hash) is appended to the record before writing.
 * This means the hash covers the original content, not itself, so the record
 * can be independently verified by re-hashing the content without the integrity field.
 *
 * The S3 key is: {prefix}{iso-timestamp}-{first8hexOfHash}.json
 * Timestamps use '-' instead of ':' and '.' so the key is safe in all S3 tooling.
 */
@Service
public class S3Service {

    /** S3 bucket name, read from s3.bucket property (set via .env S3_BUCKET) */
    @Value("${s3.bucket}")
    private String bucket;

    /** Key prefix for evidence records (default: "evidence-records/") */
    @Value("${s3.evidence-prefix}")
    private String evidencePrefix;

    @Autowired
    private S3Client s3Client;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Writes an evidence record map to S3 and returns the storage location and hash.
     *
     * Steps:
     *   1. Serialize the record to pretty-printed JSON (without integrity field)
     *   2. Compute SHA-256 of the serialized bytes
     *   3. Add the hash as record.integrity.sha256
     *   4. Re-serialize the record (now including integrity)
     *   5. Build an S3 key from the current timestamp and first 8 hex chars of the hash
     *   6. PUT the final JSON to S3 with a custom metadata header x-amz-meta-x-sha256
     *
     * @param record the evidence record map to persist (mutated in-place to add integrity)
     * @return map with s3_uri, sha256, and record keys
     * @throws Exception if serialization, hashing, or the S3 PutObject call fails
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> writeEvidenceRecord(Map<String, Object> record) throws Exception {
        // Step 1: serialise without the integrity field to get a stable hash input
        String jsonWithoutHash = objectMapper.writerWithDefaultPrettyPrinter()
                .writeValueAsString(record);

        // Step 2: compute SHA-256 and hex-encode it manually (no external library needed)
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashBytes = digest.digest(jsonWithoutHash.getBytes("UTF-8"));
        StringBuilder hexString = new StringBuilder();
        for (byte b : hashBytes) {
            String hex = Integer.toHexString(0xff & b); // mask to unsigned byte
            if (hex.length() == 1) hexString.append('0'); // zero-pad single hex digits
            hexString.append(hex);
        }
        String sha256 = hexString.toString();

        // Step 3: add the integrity field to the record before final serialisation
        Map<String, Object> integrity = new HashMap<>();
        integrity.put("sha256", sha256);
        record.put("integrity", integrity);

        // Step 4: re-serialise including the integrity field
        String finalJson = objectMapper.writerWithDefaultPrettyPrinter()
                .writeValueAsString(record);

        // Step 5: build a unique S3 key — replace ':' and '.' in ISO timestamp
        // so the key is URL-safe and works cleanly in AWS Console and CLI
        String timestamp = Instant.now().toString().replace(":", "-").replace(".", "-");
        String key = evidencePrefix + timestamp + "-" + sha256.substring(0, 8) + ".json";

        // Step 6: write to S3 with the hash in a custom metadata header for quick verification
        PutObjectRequest putRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType("application/json")
                .overrideConfiguration(b -> b.putHeader("x-amz-meta-x-sha256", sha256))
                .build();

        s3Client.putObject(putRequest, RequestBody.fromString(finalJson));

        // Return the storage location and hash so the caller can surface them in the UI
        Map<String, Object> result = new HashMap<>();
        result.put("s3_uri", "s3://" + bucket + "/" + key);
        result.put("sha256", sha256);
        result.put("record", objectMapper.readValue(finalJson, Map.class));
        return result;
    }
}
