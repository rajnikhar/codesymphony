package com.codesymphony.core.model;

import java.nio.file.Path;
import java.util.List;

public record RepositoryGraph(
    String repositoryId,
    String canonicalUrl,
    Path cloneDirectory,
    RepositoryMode mode,
    List<SourceFile> files,
    List<DependencyEdge> edges,
    List<CommitRecord> commits,
    int parsedFileCount,
    int unresolvedImportCount
) {}
