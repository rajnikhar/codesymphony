package com.codesymphony.core.dto.response;

import java.util.List;

public record TreeBranchDto(
    String directory,
    int depth,
    int churn,
    int fileCount,
    int firstCommitIndex,
    List<TreeFileDto> files,
    int overflowCount,
    List<TreeBranchDto> subBranches
) {}
