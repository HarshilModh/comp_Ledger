package com.compledger.model;

import java.time.Instant;

public class Publisher {

    private String id;
    private String name;
    private String email;
    private String apiKey;
    private Instant createdAt;

    public Publisher() {}

    public Publisher(String id, String name, String email, String apiKey, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.apiKey = apiKey;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
