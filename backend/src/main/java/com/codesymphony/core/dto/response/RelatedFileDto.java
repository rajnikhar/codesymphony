package com.codesymphony.core.dto.response;


public record RelatedFileDto(
    String path,
    String language,
    int commitCount,
    int churn,
    String relation
) {}
