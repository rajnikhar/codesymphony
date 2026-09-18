package com.codesymphony.core.dto.response;

import java.util.List;

public record FileNeighborhoodResponse(
    String repositoryId,
    String path,
    String language,
    int commitCount,
    int churn,
    List<RelatedFileDto> dependsOn,
    List<RelatedFileDto> usedBy,
    GraphResponse focusGraph
) {}
