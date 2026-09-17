package com.codesymphony.core.model;

import jakarta.validation.constraints.NotBlank;

public record IngestRequest(
    @NotBlank String url
) {}
