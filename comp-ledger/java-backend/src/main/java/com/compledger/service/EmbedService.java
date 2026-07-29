package com.compledger.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelRequest;
import software.amazon.awssdk.services.bedrockruntime.model.InvokeModelResponse;

import java.util.ArrayList;
import java.util.List;

/**
 * Converts text into a 512-dimensional embedding vector using Amazon Titan on Bedrock.
 *
 * This service calls the Bedrock InvokeModel API directly (not via Spring AI) because
 * the Titan embedding model requires two parameters — dimensions and normalize — that
 * Spring AI's embedding abstraction does not expose. Using the raw SDK ensures the
 * vectors match exactly what was used when building index.json.
 */
@Service
public class EmbedService {

    /** Bedrock model ID for embeddings, e.g. "amazon.titan-embed-text-v2:0" */
    @Value("${bedrock.embed-model-id}")
    private String embedModelId;

    @Autowired
    private BedrockRuntimeClient bedrockRuntimeClient;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Embeds a single string and returns a 512-dimensional unit-length vector.
     *
     * The text is truncated to 8000 characters to stay within Titan's token limit.
     * dimensions=512 and normalize=true must match the values used in build-index —
     * changing either would make query vectors incompatible with the stored index.
     *
     * @param text the claim or chunk text to embed
     * @return 512-element list of doubles representing the embedding
     */
    public List<Double> embedText(String text) throws Exception {
        // Truncate to Titan's maximum input length
        String inputText = text.length() > 8000 ? text.substring(0, 8000) : text;

        // Build the Titan-specific request body
        ObjectNode body = objectMapper.createObjectNode();
        body.put("inputText", inputText);
        body.put("dimensions", 512);  // must match index.json dimensions
        body.put("normalize", true);  // unit-length vectors so dot product == cosine similarity

        String bodyJson = objectMapper.writeValueAsString(body);

        // Call Bedrock InvokeModel synchronously
        InvokeModelRequest request = InvokeModelRequest.builder()
                .modelId(embedModelId)
                .contentType("application/json")
                .accept("application/json")
                .body(SdkBytes.fromUtf8String(bodyJson))
                .build();

        InvokeModelResponse response = bedrockRuntimeClient.invokeModel(request);

        // Parse the "embedding" array from the JSON response
        String responseBody = response.body().asUtf8String();
        JsonNode result = objectMapper.readTree(responseBody);
        JsonNode embeddingNode = result.get("embedding");

        List<Double> embedding = new ArrayList<>();
        for (JsonNode val : embeddingNode) {
            embedding.add(val.asDouble());
        }
        return embedding;
    }

    /**
     * Embeds multiple texts in batches of 10 to avoid overwhelming Bedrock.
     * Returned list preserves the same order as the input list.
     *
     * @param texts list of strings to embed
     * @return list of embedding vectors in the same order as the input
     */
    public List<List<Double>> embedBatch(List<String> texts) throws Exception {
        List<List<Double>> results = new ArrayList<>();
        int batchSize = 10;

        // Process in windows of batchSize
        for (int i = 0; i < texts.size(); i += batchSize) {
            List<String> batch = texts.subList(i, Math.min(i + batchSize, texts.size()));
            for (String text : batch) {
                results.add(embedText(text));
            }
        }
        return results;
    }
}
