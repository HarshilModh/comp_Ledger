package com.compledger.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.Map;

@Schema(description = "Request body for POST /api/export")
public class ExportRequest {

    @Schema(description = "Scored claim objects produced by /api/trace. Each element must include " +
            "claim_id, claim_text, exclusivity_score, and optionally match, exclusivity, fingerprint, agreement_active.",
            requiredMode = Schema.RequiredMode.REQUIRED)
    private List<Map<String, Object>> claims;

    @Schema(description = "The original question that was posed to the AI model",
            example = "When was OpenAI founded?", requiredMode = Schema.RequiredMode.REQUIRED)
    private String question;

    @Schema(description = "The AI-generated answer that was traced",
            example = "OpenAI was founded in December 2015.", requiredMode = Schema.RequiredMode.REQUIRED)
    private String answer;

    @JsonProperty("publisher_name")
    @Schema(description = "Name of the publisher whose archive was used. Defaults to 'Silicon Insider'.",
            example = "Silicon Insider", defaultValue = "Silicon Insider")
    private String publisherName = "Silicon Insider";

    public List<Map<String, Object>> getClaims() { return claims; }
    public void setClaims(List<Map<String, Object>> claims) { this.claims = claims; }

    public String getQuestion() { return question; }
    public void setQuestion(String question) { this.question = question; }

    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }

    public String getPublisherName() { return publisherName; }

    /** Keeps the default value if the client sends null */
    public void setPublisherName(String publisherName) {
        this.publisherName = publisherName != null ? publisherName : "Silicon Insider";
    }
}
