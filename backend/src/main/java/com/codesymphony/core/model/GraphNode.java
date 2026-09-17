package com.codesymphony.core.model;

public record GraphNode(
    String id,
    String path,
    String kind,
    int commitCount,
    int churn
) {}
