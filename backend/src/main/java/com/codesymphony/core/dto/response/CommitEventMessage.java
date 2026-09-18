package com.codesymphony.core.dto.response;

import java.util.List;

public record CommitEventMessage(
    String type,
    String repositoryId,
    int index,
    String commitHash,
    String timestamp,
    List<String> filesChanged,
    int linesAdded,
    int linesDeleted
) {
  public static final String TYPE = "commit_event";
}
