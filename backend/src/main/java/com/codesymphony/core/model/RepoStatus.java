package com.codesymphony.core.model;

public record RepoStatus(
    String repoId,
    String status,
    RepoMode mode,
    String message
) {}
