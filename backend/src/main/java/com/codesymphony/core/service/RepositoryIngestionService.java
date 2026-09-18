package com.codesymphony.core.service;

import com.codesymphony.core.config.CodeSymphonyProperties;
import com.codesymphony.core.exception.GitCloneFailedException;
import com.codesymphony.core.exception.UnsupportedRepositorySizeException;
import com.codesymphony.core.model.CommitRecord;
import com.codesymphony.core.model.DependencyEdge;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.model.RepositoryMode;
import com.codesymphony.core.model.SourceFile;
import com.codesymphony.core.repository.ParsedRepositoryCache;
import com.codesymphony.core.service.CommitHistoryService.CommitHistorySnapshot;
import com.codesymphony.core.service.ParsingClientService.ParserResult;
import com.codesymphony.core.util.GitUrlParser;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class RepositoryIngestionService {

  private static final Logger log = LoggerFactory.getLogger(RepositoryIngestionService.class);

  /** Warn (do not reject) when clones get large — sampling protects the laptop. */
  private static final int LARGE_REPO_WARN_FILES = 50_000;

  private final CodeSymphonyProperties properties;
  private final ParsedRepositoryCache parsedRepositoryCache;
  private final ParsingClientService parsingClientService;
  private final CommitHistoryService commitHistoryService;
  private final DependencyGraphService dependencyGraphService;

  public RepositoryIngestionService(
      CodeSymphonyProperties properties,
      ParsedRepositoryCache parsedRepositoryCache,
      ParsingClientService parsingClientService,
      CommitHistoryService commitHistoryService,
      DependencyGraphService dependencyGraphService) {
    this.properties = properties;
    this.parsedRepositoryCache = parsedRepositoryCache;
    this.parsingClientService = parsingClientService;
    this.commitHistoryService = commitHistoryService;
    this.dependencyGraphService = dependencyGraphService;
  }

  public RepositoryGraph ingestGitHubRepository(String rawUrl) {
    String canonicalUrl = GitUrlParser.canonicalizeGitHubUrl(rawUrl);
    return parsedRepositoryCache
        .findByCanonicalUrl(canonicalUrl)
        .orElseGet(() -> cloneParseAndStore(canonicalUrl));
  }

  public RepositoryGraph requireRepository(String repositoryId) {
    return parsedRepositoryCache.requireById(repositoryId);
  }

  private RepositoryGraph cloneParseAndStore(String canonicalUrl) {
    String repositoryId = UUID.randomUUID().toString();
    Path cloneDirectory = Path.of(properties.cloneDir(), repositoryId);

    cloneRepository(canonicalUrl, cloneDirectory);
    enforceLaptopSafetyCeiling(cloneDirectory);

    // Read-only: we never execute cloned code — parse + git history only.
    ParserResult parserResult = parsingClientService.fetchImportGraph(cloneDirectory);
    CommitHistorySnapshot history = commitHistoryService.loadCommitHistory(cloneDirectory);

    RepositoryMode mode = dependencyGraphService.decideRepositoryMode(parserResult);
    List<SourceFile> parsedFiles =
        dependencyGraphService.buildSourceFiles(parserResult, history.churnByPath());
    List<SourceFile> files =
        dependencyGraphService.mergeHistorySample(parsedFiles, history.churnByPath());
    List<DependencyEdge> edges =
        mode == RepositoryMode.FULL
            ? dependencyGraphService.buildDependencyEdges(parserResult)
            : List.of();
    List<CommitRecord> commits = history.commits();

    int unresolved =
        parserResult.stats() == null ? 0 : parserResult.stats().unresolvedImports();

    RepositoryGraph graph =
        new RepositoryGraph(
            repositoryId,
            canonicalUrl,
            cloneDirectory,
            mode,
            files,
            edges,
            commits,
            files.size(),
            unresolved);

    parsedRepositoryCache.store(graph);
    log.info(
        "Ingested {} as {} (mode={}, files={}, edges={}, sampled={})",
        canonicalUrl,
        repositoryId,
        mode,
        files.size(),
        edges.size(),
        files.size() > parsedFiles.size());
    return graph;
  }

  private void cloneRepository(String canonicalUrl, Path cloneDirectory) {
    try {
      Files.createDirectories(cloneDirectory.getParent());
      int depth = Math.max(1, Math.min(properties.cloneDepth(), 200));
      Git.cloneRepository()
          .setURI(GitUrlParser.cloneUrl(canonicalUrl))
          .setDirectory(cloneDirectory.toFile())
          .setCloneAllBranches(false)
          .setDepth(depth)
          .call()
          .close();
    } catch (GitAPIException | IOException exception) {
      throw new GitCloneFailedException(canonicalUrl, exception);
    }
  }

  private void enforceLaptopSafetyCeiling(Path cloneDirectory) {
    int fileCount = countFiles(cloneDirectory);
    if (fileCount > LARGE_REPO_WARN_FILES) {
      log.warn(
          "Large clone ({} files) — continuing with shallow history + parse/sample caps",
          fileCount);
    }
    if (fileCount > properties.maxRepositoryFilesBeforeReject()) {
      throw new UnsupportedRepositorySizeException(
          fileCount, properties.maxRepositoryFilesBeforeReject());
    }
  }

  private static int countFiles(Path cloneDirectory) {
    try (Stream<Path> paths = Files.walk(cloneDirectory)) {
      return (int)
          paths
              .filter(Files::isRegularFile)
              .filter(path -> !path.toString().contains("/.git/"))
              .count();
    } catch (IOException exception) {
      throw new IllegalStateException("Failed to inspect cloned repository size", exception);
    }
  }
}
