package com.codesymphony.core.dto.response;

import java.util.List;

public record TreeFileDto(
    String path, int inDegree, int firstCommitIndex, List<Integer> commitIndicesTouched
) {}
