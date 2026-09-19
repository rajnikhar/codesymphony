package com.codesymphony.core.dto.response;

import java.util.List;
import java.util.Map;

public record TreeResponse(
    String repoId,
    String generatedAt,
    String mode,
    TreeTrunkDto trunk,
    List<TreeBranchDto> branches,
    int totalCommits,
    Map<String, Double> languageCoverage
) {}
