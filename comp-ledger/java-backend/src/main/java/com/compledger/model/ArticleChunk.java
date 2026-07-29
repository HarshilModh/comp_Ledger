package com.compledger.model;

import java.util.List;

public class ArticleChunk {

    private String publisherId;
    private String articleId;
    private int chunkIdx;
    private String text;
    private List<Double> vector;

    public ArticleChunk() {}

    public String getPublisherId() { return publisherId; }
    public void setPublisherId(String publisherId) { this.publisherId = publisherId; }

    public String getArticleId() { return articleId; }
    public void setArticleId(String articleId) { this.articleId = articleId; }

    public int getChunkIdx() { return chunkIdx; }
    public void setChunkIdx(int chunkIdx) { this.chunkIdx = chunkIdx; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public List<Double> getVector() { return vector; }
    public void setVector(List<Double> vector) { this.vector = vector; }
}
