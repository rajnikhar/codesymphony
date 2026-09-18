package com.codesymphony.core.dto.request;

import jakarta.validation.constraints.Min;

public record ScrubCommitRequest(
    @Min(0) int index
) {}
