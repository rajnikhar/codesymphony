package com.codesymphony.core.model;

import java.util.List;

public record CommitRecord(
    String commitHash,
    String timestamp,
    List<String> filesChanged,
    int linesAdded,
    int linesDeleted
) {}
