package com.codesymphony.core.dto.response;

import java.util.List;

public record GraphResponse(
    String repositoryId,
    String mode,
    List<GraphNodeDto> nodes,
    List<GraphEdgeDto> edges
) {}
