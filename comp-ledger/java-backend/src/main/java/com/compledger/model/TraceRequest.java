package com.compledger.model;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Request body for POST /api/trace")
public class TraceRequest {

    @Schema(description = "The original question posed to the AI model", example = "When was OpenAI founded?", requiredMode = Schema.RequiredMode.REQUIRED)
    private String question;

    @Schema(description = "The AI-generated answer whose claims will be traced and scored", example = "OpenAI was founded in December 2015 by Sam Altman, Greg Brockman, and others.", requiredMode = Schema.RequiredMode.REQUIRED)
    private String answer;

    @Schema(description = "Scoring mode. 'audit' is the only supported value; reserved for future use.", example = "audit", defaultValue = "audit")
    private String mode = "audit";

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public String getMode() { return mode; }

    /** Keeps the default value if the client sends null */
    public void setMode(String mode) { this.mode = mode != null ? mode : "audit"; }
}
