package com.codesymphony.core.dto.response;

public record RepositoryStatusResponse(
    String repositoryId,
    String status,
    String mode,
    String canonicalUrl,
    int fileCount,
    int edgeCount,
    String message
) {}
