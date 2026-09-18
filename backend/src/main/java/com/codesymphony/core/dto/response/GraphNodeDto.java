package com.codesymphony.core.dto.response;

public record GraphNodeDto(
    String id,
    String path,
    String kind,
    int commitCount,
    int churn
) {}
