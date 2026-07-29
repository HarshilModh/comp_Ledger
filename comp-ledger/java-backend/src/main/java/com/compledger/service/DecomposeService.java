package com.compledger.service;

import com.compledger.model.Claim;
import com.compledger.util.Prompts;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Breaks an AI-generated answer into a list of atomic factual claims.
 *
 * Uses Spring AI's ChatClient to call a Claude model (Haiku by default) with
 * the DECOMPOSE_PROMPT. The model is expected to return a JSON array of
 * {id, text} objects. A regex fallback extracts the array if the model wraps
 * it in markdown fencing or adds preamble text.
 */
@Service
public class DecomposeService {

    /** Bedrock model ID used for decomposition (e.g. Claude Haiku) */
    @Value("${bedrock.decompose-model-id}")
    private String decomposeModelId;

    /** Spring AI ChatClient built from the auto-configured BedrockProxyChatModel */
    private final ChatClient chatClient;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Constructor injection of ChatModel (provided by Spring AI's Bedrock auto-config).
     * ChatClient.builder wraps it to give us the fluent prompt API.
     */
    public DecomposeService(ChatModel chatModel) {
        this.chatClient = ChatClient.builder(chatModel).build();
    }

    /**
     * Sends the question and answer to the LLM and returns the extracted claims.
     *
     * @param question the original reader question
     * @param answer   the AI-generated answer to decompose
     * @return ordered list of atomic claims, each with an id and text
     * @throws Exception if the model response cannot be parsed as a JSON array
     */
    public List<Claim> decompose(String question, String answer) throws Exception {
        // Fill the placeholders in the prompt template
        String prompt = Prompts.DECOMPOSE_PROMPT
                .replace("{question}", question)
                .replace("{answer}", answer);

        // Call the model via Spring AI — ChatOptions overrides model and token limit per-call
        String text = chatClient.prompt()
                .user(prompt)
                .options(ChatOptions.builder()
                        .model(decomposeModelId)
                        .maxTokens(4096)
                        .build())
                .call()
                .content();

        return parseClaims(text);
    }

    /**
     * Attempts to parse the model response as a JSON array.
     * Falls back to a regex scan for "[...]" in case the model adds preamble
     * or markdown fencing around the JSON.
     *
     * @param text raw text response from the model
     * @return list of Claim objects
     * @throws Exception if no valid JSON array can be extracted
     */
    private List<Claim> parseClaims(String text) throws Exception {
        try {
            JsonNode parsed = objectMapper.readTree(text);
            if (!parsed.isArray()) throw new Exception("Not an array");
            return extractClaimsFromArray((ArrayNode) parsed);
        } catch (Exception e) {
            // Regex fallback: find the first [...] block in the response
            Pattern pattern = Pattern.compile("\\[[\\s\\S]*\\]");
            Matcher matcher = pattern.matcher(text);
            if (matcher.find()) {
                JsonNode parsed = objectMapper.readTree(matcher.group());
                if (parsed.isArray()) return extractClaimsFromArray((ArrayNode) parsed);
            }
            throw new Exception("Failed to parse claims: " + e.getMessage());
        }
    }

    /**
     * Converts a parsed JSON array node into a typed List of Claim objects.
     * Uses the array index as a fallback id if the model omits the id field.
     */
    private List<Claim> extractClaimsFromArray(ArrayNode array) {
        List<Claim> claims = new ArrayList<>();
        for (int i = 0; i < array.size(); i++) {
            JsonNode c = array.get(i);
            Claim claim = new Claim();
            claim.setId(c.has("id") ? c.get("id").asInt() : i + 1);
            claim.setText(c.path("text").asText(""));
            claims.add(claim);
        }
        return claims;
    }
}
