package com.codesymphony.core.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "codesymphony")
public record CodeSymphonyProperties(
    int maxIngestedFiles,
    int maxVisibleNodes,
    String parserBaseUrl,
    String cloneDir,
    double historyOnlyParseableRatio,
    int historyOnlyMinEdgeCount,
    /** Absolute laptop-safety ceiling — only reject absurd clones. */
    int maxRepositoryFilesBeforeReject,
    /** Max files kept in the story graph from commit churn (beyond parsed). */
    int maxHistorySampleFiles,
    /** Shallow clone depth — limits disk/CPU on ingest. */
    int cloneDepth
) {}
