package com.compledger.model;

/**
 * A single atomic factual claim extracted from an AI-generated answer
 * by the decompose step.
 *
 * Example: { "id": 3, "text": "The Fed raised rates by 0.25% in March 2023" }
 */
public class Claim {

    /** 1-based sequential identifier assigned by the decompose model */
    private int id;

    /** The atomic fact as a single declarative sentence */
    private String text;

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
}
