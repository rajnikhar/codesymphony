package com.codesymphony.core.model;

public record DependencyEdge(
    String fromPath,
    String toPath,
    String kind
) {}
