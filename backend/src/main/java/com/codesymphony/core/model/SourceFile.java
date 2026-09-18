package com.codesymphony.core.model;

public record SourceFile(
    String path,
    String language,
    int commitCount,
    int churn
) {}
