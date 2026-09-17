package com.codesymphony.core.model;

import java.util.List;

public record CommitEvent(
    String type,
    String repoId,
    int index,
    String commitHash,
    String timestamp,
    List<String> filesChanged,
    int linesAdded,
    int linesDeleted
) {
  public static final String TYPE = "commit_event";
}
