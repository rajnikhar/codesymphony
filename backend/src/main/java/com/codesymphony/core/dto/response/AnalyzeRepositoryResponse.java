package com.codesymphony.core.dto.response;

public record AnalyzeRepositoryResponse(
    String repositoryId,
    String status,
    String mode,
    String message
) {}
