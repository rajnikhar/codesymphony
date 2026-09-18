package com.codesymphony.core.dto.request;

import jakarta.validation.constraints.NotBlank;

public record ExplainFileRequest(
    @NotBlank String path
) {}
