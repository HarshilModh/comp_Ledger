package com.compledger.model;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

@Schema(description = "Request body for POST /api/multi-trace")
public class MultiTraceRequest {

    @Schema(description = "The question to pose to every selected model",
            example = "What caused the 2008 financial crisis?", requiredMode = Schema.RequiredMode.REQUIRED)
    private String question;

    @Schema(description = "Subset of Bedrock model IDs to compare. If null or empty, all available models are used.",
            example = "[\"us.anthropic.claude-haiku-4-5-20251001-v1:0\"]")
    private List<String> modelIds;

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public List<String> getModelIds() { return modelIds; }
    public void setModelIds(List<String> modelIds) { this.modelIds = modelIds; }
}
