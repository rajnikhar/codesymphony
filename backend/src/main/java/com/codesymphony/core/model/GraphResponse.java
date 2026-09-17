package com.codesymphony.core.model;

import java.util.List;

public record GraphResponse(
    RepoMode mode,
    List<GraphNode> nodes,
    List<GraphEdge> edges
) {}
