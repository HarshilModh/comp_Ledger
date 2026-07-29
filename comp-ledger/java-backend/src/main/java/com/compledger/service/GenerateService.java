package com.compledger.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Generates AI answers for comparison in the multi-trace flow.
 *
 * In the multi-trace feature, the same question is posed to multiple models
 * simultaneously so their answers can be compared for exclusivity. Spring AI's
 * Bedrock Converse API handles all model-family differences (Anthropic, Amazon Nova,
 * Llama, Mistral) transparently — no per-model request body branching needed.
 */
@Service
public class GenerateService {

    /**
     * The five models available for comparison in the multi-trace UI.
     * Each entry is a {id, label} map matching the shape the frontend expects.
     * Order here determines the display order in the Compare view.
     */
    public static final List<Map<String, String>> AVAILABLE_MODELS;

    static {
        AVAILABLE_MODELS = new ArrayList<>();

        Map<String, String> haiku = new LinkedHashMap<>();
        haiku.put("id", "us.anthropic.claude-haiku-4-5-20251001-v1:0");
        haiku.put("label", "Claude Haiku 4.5");
        AVAILABLE_MODELS.add(haiku);

        Map<String, String> sonnet = new LinkedHashMap<>();
        sonnet.put("id", "us.anthropic.claude-sonnet-4-20250514-v1:0");
        sonnet.put("label", "Claude Sonnet 4");
        AVAILABLE_MODELS.add(sonnet);

        Map<String, String> novaMicro = new LinkedHashMap<>();
        novaMicro.put("id", "us.amazon.nova-micro-v1:0");
        novaMicro.put("label", "Amazon Nova Micro");
        AVAILABLE_MODELS.add(novaMicro);

        Map<String, String> novaLite = new LinkedHashMap<>();
        novaLite.put("id", "us.amazon.nova-lite-v1:0");
        novaLite.put("label", "Amazon Nova Lite");
        AVAILABLE_MODELS.add(novaLite);

        Map<String, String> llama = new LinkedHashMap<>();
        llama.put("id", "us.meta.llama3-1-8b-instruct-v1:0");
        llama.put("label", "Llama 3.1 8B");
        AVAILABLE_MODELS.add(llama);
    }

    /** Spring AI ChatClient backed by the auto-configured BedrockProxyChatModel */
    private final ChatClient chatClient;

    /**
     * Constructor injection of ChatModel from Spring AI's Bedrock auto-configuration.
     * The Converse API this model uses supports all major model families natively,
     * so a single ChatClient can call Anthropic, Nova, and Llama models without
     * any per-model request/response format handling in application code.
     */
    public GenerateService(ChatModel chatModel) {
        this.chatClient = ChatClient.builder(chatModel).build();
    }

    /**
     * Builds the standard question prompt used for all models.
     * The instruction to include specific facts, dates, and numbers is intentional —
     * it increases the likelihood the answer contains traceable claims.
     */
    private String buildPrompt(String question) {
        return "Answer the following question with specific, factual details in 3-6 sentences. " +
               "Include any known figures, dates, names, or amounts.\n\nQuestion: " + question;
    }

    /**
     * Generates a factual answer to the question using the specified model.
     * The model is overridden per-call via ChatOptions so the same ChatClient
     * instance can drive any of the five AVAILABLE_MODELS.
     *
     * @param question the reader question to answer
     * @param modelId  Bedrock model ID (must be one of the IDs in AVAILABLE_MODELS)
     * @return the model's text response, trimmed
     */
    public String generateAnswer(String question, String modelId) {
        return chatClient.prompt()
                .user(buildPrompt(question))
                .options(ChatOptions.builder()
                        .model(modelId)
                        .maxTokens(1024)
                        .build())
                .call()
                .content();
    }
}
