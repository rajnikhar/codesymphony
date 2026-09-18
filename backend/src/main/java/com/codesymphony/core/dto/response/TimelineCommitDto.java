package com.codesymphony.core.dto.response;

import java.util.List;

public record TimelineCommitDto(
    int index,
    String commitHash,
    String timestamp,
    List<String> filesChanged,
    int linesAdded,
    int linesDeleted
) {}
