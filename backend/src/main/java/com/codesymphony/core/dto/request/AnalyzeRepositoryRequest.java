package com.codesymphony.core.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record AnalyzeRepositoryRequest(
    @NotBlank
    @Pattern(
        regexp = "^(https://github\\.com/[\\w.-]+/[\\w.-]+(?:\\.git)?/?|git@github\\.com:[\\w.-]+/[\\w.-]+(?:\\.git)?)$",
        message = "url must be a GitHub HTTPS or SSH repository URL")
    String url
) {}
