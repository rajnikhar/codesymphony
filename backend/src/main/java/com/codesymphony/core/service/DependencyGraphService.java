package com.codesymphony.core.service;

import com.codesymphony.core.config.CodeSymphonyProperties;
import com.codesymphony.core.dto.response.GraphEdgeDto;
import com.codesymphony.core.dto.response.GraphNodeDto;
import com.codesymphony.core.dto.response.GraphResponse;
import com.codesymphony.core.model.DependencyEdge;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.model.RepositoryMode;
import com.codesymphony.core.model.SourceFile;
import com.codesymphony.core.service.CommitHistoryService.FileChurn;
import com.codesymphony.core.service.ParsingClientService.ParserResult;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class DependencyGraphService {

  private final CodeSymphonyProperties properties;
  private final CentralityService centralityService;

  public DependencyGraphService(
      CodeSymphonyProperties properties, CentralityService centralityService) {
    this.properties = properties;
    this.centralityService = centralityService;
  }

  public RepositoryMode decideRepositoryMode(ParserResult parserResult) {
    if (parserResult.edges() == null || parserResult.edges().isEmpty()) {
      return RepositoryMode.HISTORY_ONLY;
    }
    if (parserResult.stats() == null) {
      return RepositoryMode.FULL;
    }
    int parsed = parserResult.stats().parsed();
    int skipped = parserResult.stats().skippedUnsupported();
    int total = parsed + skipped;
    if (total > 0
        && ((double) parsed / total) < properties.historyOnlyParseableRatio()) {
      return RepositoryMode.HISTORY_ONLY;
    }
    if (parserResult.edges().size() < properties.historyOnlyMinEdgeCount()) {
      return RepositoryMode.HISTORY_ONLY;
    }
    return RepositoryMode.FULL;
  }

  public List<SourceFile> buildSourceFiles(
      ParserResult parserResult, Map<String, FileChurn> churnByPath) {
    if (parserResult.files() == null) {
      return List.of();
    }
    List<SourceFile> files = new ArrayList<>();
    for (var parsedFile : parserResult.files()) {
      FileChurn churn = churnByPath.getOrDefault(parsedFile.path(), new FileChurn(0, 0, 0));
      files.add(
          new SourceFile(
              parsedFile.path(),
              parsedFile.language(),
              churn.commitCount(),
              churn.totalChurn()));
    }
    return List.copyOf(files);
  }

  /**
   * Ensures the story always has files to show: merge top churn paths that the
   * parser skipped (other languages / over budget), capped for laptop safety.
   */
  public List<SourceFile> mergeHistorySample(
      List<SourceFile> parsedFiles, Map<String, FileChurn> churnByPath) {
    Map<String, SourceFile> byPath = new LinkedHashMap<>();
    for (SourceFile file : parsedFiles) {
      byPath.put(file.path(), file);
    }

    churnByPath.entrySet().stream()
        .filter(entry -> !byPath.containsKey(entry.getKey()))
        .filter(entry -> isReasonableStoryPath(entry.getKey()))
        .sorted(
            Comparator.<Map.Entry<String, FileChurn>>comparingInt(
                    entry -> entry.getValue().totalChurn())
                .reversed()
                .thenComparing(
                    entry -> entry.getValue().commitCount(), Comparator.reverseOrder()))
        .limit(Math.max(0, properties.maxHistorySampleFiles() - byPath.size()))
        .forEach(
            entry ->
                byPath.put(
                    entry.getKey(),
                    new SourceFile(
                        entry.getKey(),
                        languageGuess(entry.getKey()),
                        entry.getValue().commitCount(),
                        entry.getValue().totalChurn())));

    return List.copyOf(byPath.values());
  }

  public List<DependencyEdge> buildDependencyEdges(ParserResult parserResult) {
    if (parserResult.edges() == null) {
      return List.of();
    }
    return parserResult.edges().stream()
        .map(edge -> new DependencyEdge(edge.from(), edge.to(), edge.kind() == null ? "import" : edge.kind()))
        .toList();
  }

  public GraphResponse toDirectoryCollapsedGraphResponse(RepositoryGraph graph) {
    int maxVisible = properties.maxVisibleNodes();
    if (graph.mode() == RepositoryMode.HISTORY_ONLY || graph.edges().isEmpty()) {
      return buildHistoryOnlyDirectoryGraph(graph, maxVisible);
    }
    // Layered client layout needs file-level nodes; directory collapse is no
    // longer the primary simplification mechanism.
    return buildFileLevelGraph(graph, maxVisible);
  }

  private GraphResponse buildImportDirectoryGraph(RepositoryGraph graph, int maxVisible) {
    Map<String, AggregateNode> aggregates = new LinkedHashMap<>();
    for (SourceFile file : graph.files()) {
      String directory = directoryKey(file.path());
      aggregates
          .computeIfAbsent(directory, AggregateNode::new)
          .absorb(file.commitCount(), file.churn());
    }

    Map<String, Integer> edgeWeights = new HashMap<>();
    for (DependencyEdge edge : graph.edges()) {
      String fromDir = directoryKey(edge.fromPath());
      String toDir = directoryKey(edge.toPath());
      if (fromDir.equals(toDir)) {
        continue;
      }
      String key = fromDir + "->" + toDir;
      edgeWeights.merge(key, 1, Integer::sum);
    }

    // Flat repos (everything under one directory key) keep file-level edges visible.
    if (aggregates.size() <= 1 || edgeWeights.isEmpty()) {
      return buildFileLevelGraph(graph, maxVisible);
    }

    List<AggregateNode> ranked =
        aggregates.values().stream()
            .sorted(Comparator.comparingInt(AggregateNode::churn).reversed())
            .limit(maxVisible)
            .toList();
    Map<String, AggregateNode> visible =
        ranked.stream()
            .collect(
                Collectors.toMap(
                    AggregateNode::path, node -> node, (a, b) -> a, LinkedHashMap::new));

    List<GraphNodeDto> nodes =
        visible.values().stream()
            .map(
                node ->
                    new GraphNodeDto(
                        node.path(), node.path(), "directory", node.commitCount(), node.churn()))
            .toList();

    List<GraphEdgeDto> edges = new ArrayList<>();
    edgeWeights.forEach(
        (key, weight) -> {
          String[] parts = key.split("->", 2);
          if (visible.containsKey(parts[0]) && visible.containsKey(parts[1])) {
            edges.add(new GraphEdgeDto(parts[0], parts[1], "import"));
          }
        });

    return new GraphResponse(
        graph.repositoryId(), graph.mode().name(), nodes, List.copyOf(edges));
  }

  private GraphResponse buildFileLevelGraph(RepositoryGraph graph, int maxVisible) {
    Map<String, Double> scores =
        centralityService.computeFileCentralityScores(graph.files(), graph.edges());
    List<SourceFile> selected =
        graph.files().stream()
            .filter(file -> !CentralityService.isNonCodePath(file.path()))
            .sorted(
                Comparator.comparingDouble(
                        (SourceFile file) -> scores.getOrDefault(file.path(), 0.0))
                    .reversed()
                    .thenComparing(SourceFile::commitCount, Comparator.reverseOrder())
                    .thenComparing(SourceFile::churn, Comparator.reverseOrder()))
            .limit(maxVisible)
            .toList();
    List<String> visiblePaths = selected.stream().map(SourceFile::path).toList();
    List<GraphNodeDto> nodes =
        selected.stream()
            .map(
                file ->
                    new GraphNodeDto(
                        file.path(), file.path(), "file", file.commitCount(), file.churn()))
            .toList();
    List<GraphEdgeDto> edges =
        graph.edges().stream()
            .filter(
                edge ->
                    visiblePaths.contains(edge.fromPath())
                        && visiblePaths.contains(edge.toPath()))
            .map(edge -> new GraphEdgeDto(edge.fromPath(), edge.toPath(), edge.kind()))
            .toList();
    return new GraphResponse(graph.repositoryId(), graph.mode().name(), nodes, edges);
  }

  private GraphResponse buildHistoryOnlyDirectoryGraph(RepositoryGraph graph, int maxVisible) {
    // Prefer real file nodes so Overview / Spine are never stuck at zero.
    List<SourceFile> rankedFiles =
        graph.files().stream()
            .sorted(
                Comparator.comparingInt(SourceFile::churn)
                    .reversed()
                    .thenComparing(SourceFile::commitCount, Comparator.reverseOrder()))
            .limit(maxVisible)
            .toList();

    if (!rankedFiles.isEmpty()) {
      List<GraphNodeDto> nodes =
          rankedFiles.stream()
              .map(
                  file ->
                      new GraphNodeDto(
                          file.path(),
                          file.path(),
                          "file",
                          file.commitCount(),
                          file.churn()))
              .toList();
      return new GraphResponse(graph.repositoryId(), graph.mode().name(), nodes, List.of());
    }

    Map<String, AggregateNode> aggregates = new LinkedHashMap<>();
    graph.commits().forEach(
        commit ->
            commit
                .filesChanged()
                .forEach(
                    path -> {
                      if (!isReasonableStoryPath(path)) {
                        return;
                      }
                      String directory = directoryKey(path);
                      aggregates.computeIfAbsent(directory, AggregateNode::new);
                    }));

    List<GraphNodeDto> nodes =
        aggregates.values().stream()
            .sorted(Comparator.comparingInt(AggregateNode::churn).reversed())
            .limit(maxVisible)
            .map(
                node ->
                    new GraphNodeDto(
                        node.path(), node.path(), "directory", node.commitCount(), node.churn()))
            .toList();

    return new GraphResponse(graph.repositoryId(), graph.mode().name(), nodes, List.of());
  }

  public GraphResponse expandDirectory(RepositoryGraph graph, String directoryPath) {
    String normalized = directoryPath.endsWith("/") ? directoryPath.substring(0, directoryPath.length() - 1) : directoryPath;
    List<SourceFile> children =
        graph.files().stream()
            .filter(file -> directoryKey(file.path()).equals(normalized) || file.path().startsWith(normalized + "/"))
            .filter(file -> {
              String parent = directoryKey(file.path());
              return parent.equals(normalized);
            })
            .toList();

    Map<String, Double> scores =
        centralityService.computeFileCentralityScores(graph.files(), graph.edges());
    int limit = Math.min(properties.maxVisibleNodes(), Math.max(children.size(), 1));
    List<SourceFile> selected =
        children.stream()
            .sorted(
                Comparator.comparingDouble(
                        (SourceFile file) -> scores.getOrDefault(file.path(), 0.0))
                    .reversed()
                    .thenComparing(SourceFile::churn, Comparator.reverseOrder()))
            .limit(limit)
            .toList();

    List<GraphNodeDto> nodes = new ArrayList<>();
    for (SourceFile file : selected) {
      nodes.add(
          new GraphNodeDto(file.path(), file.path(), "file", file.commitCount(), file.churn()));
    }
    int remaining = children.size() - selected.size();
    if (remaining > 0) {
      nodes.add(
          new GraphNodeDto(
              normalized + "/+more",
              "+" + remaining + " more files",
              "aggregate",
              0,
              0));
    }

    List<String> visiblePaths = selected.stream().map(SourceFile::path).toList();
    List<GraphEdgeDto> edges =
        graph.edges().stream()
            .filter(
                edge ->
                    visiblePaths.contains(edge.fromPath())
                        && visiblePaths.contains(edge.toPath()))
            .map(edge -> new GraphEdgeDto(edge.fromPath(), edge.toPath(), edge.kind()))
            .toList();

    return new GraphResponse(graph.repositoryId(), graph.mode().name(), nodes, edges);
  }

  private static String directoryKey(String path) {
    int slash = path.lastIndexOf('/');
    if (slash < 0) {
      return "(root)";
    }
    String directory = path.substring(0, slash);
    // Collapse to top-two segments for default view stability
    String[] parts = directory.split("/");
    if (parts.length <= 2) {
      return directory.isBlank() ? "(root)" : directory;
    }
    return parts[0] + "/" + parts[1];
  }

  static boolean isReasonableStoryPath(String path) {
    if (path == null || path.isBlank() || path.contains("\0")) {
      return false;
    }
    String normalized = path.replace('\\', '/');
    if (normalized.startsWith(".git/") || normalized.contains("/.git/")) {
      return false;
    }
    String lower = normalized.toLowerCase();
    return !(lower.contains("/node_modules/")
        || lower.startsWith("node_modules/")
        || lower.contains("/target/")
        || lower.contains("/dist/")
        || lower.contains("/build/")
        || lower.contains("/.venv/")
        || lower.contains("/vendor/"));
  }

  static String languageGuess(String path) {
    String lower = path.toLowerCase();
    if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
      return "ts";
    }
    if (lower.endsWith(".js")
        || lower.endsWith(".jsx")
        || lower.endsWith(".mjs")
        || lower.endsWith(".cjs")) {
      return "js";
    }
    if (lower.endsWith(".py")) {
      return "py";
    }
    if (lower.endsWith(".java")) {
      return "java";
    }
    int dot = lower.lastIndexOf('.');
    int slash = lower.lastIndexOf('/');
    if (dot > slash && dot < lower.length() - 1) {
      return lower.substring(dot + 1);
    }
    return "other";
  }

  private static final class AggregateNode {
    private final String path;
    private int commitCount;
    private int churn;

    private AggregateNode(String path) {
      this.path = path;
    }

    private void absorb(int commits, int fileChurn) {
      this.commitCount += commits;
      this.churn += fileChurn;
    }

    private String path() {
      return path;
    }

    private int commitCount() {
      return commitCount;
    }

    private int churn() {
      return churn;
    }
  }
}
