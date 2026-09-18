package com.codesymphony.core.dto.response;

import java.util.List;

public record TimelineResponse(
    String repositoryId,
    String mode,
    int commitCount,
    List<TimelineCommitDto> commits
) {}
