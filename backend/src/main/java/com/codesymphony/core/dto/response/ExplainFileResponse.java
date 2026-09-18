package com.codesymphony.core.dto.response;

import java.util.List;

public record ExplainFileResponse(
    String path,
    String title,
    String summary,
    String story,
    List<String> points,
    List<String> howToReadTheMap,
    String questionPrompt
) {}
