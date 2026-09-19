package com.codesymphony.core.service;

import com.codesymphony.core.model.DependencyEdge;
import com.codesymphony.core.model.SourceFile;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.jgrapht.Graph;
import org.jgrapht.graph.DefaultEdge;
import org.jgrapht.graph.SimpleDirectedGraph;
import org.springframework.stereotype.Service;

@Service
public class CentralityService {

  /**
   * v1 spine score: primarily in-degree (depended-on), then out-degree, then
   * commit count as a weak tiebreaker — never the primary sort key.
   */
  public Map<String, Double> computeFileCentralityScores(
      List<SourceFile> files, List<DependencyEdge> edges) {
    Graph<String, DefaultEdge> graph = new SimpleDirectedGraph<>(DefaultEdge.class);
    for (SourceFile file : files) {
      if (isNonCodePath(file.path())) {
        continue;
      }
      graph.addVertex(file.path());
    }
    for (DependencyEdge edge : edges) {
      if (!graph.containsVertex(edge.fromPath()) || !graph.containsVertex(edge.toPath())) {
        continue;
      }
      if (edge.fromPath().equals(edge.toPath())) {
        continue;
      }
      if (graph.containsEdge(edge.fromPath(), edge.toPath())) {
        continue;
      }
      graph.addEdge(edge.fromPath(), edge.toPath());
    }
    if (graph.vertexSet().isEmpty()) {
      return Map.of();
    }

    Map<String, Integer> commitByPath = new HashMap<>();
    for (SourceFile file : files) {
      commitByPath.put(file.path(), file.commitCount());
    }

    Map<String, Double> scores = new HashMap<>();
    for (String vertex : graph.vertexSet()) {
      int inDegree = graph.inDegreeOf(vertex);
      int outDegree = graph.outDegreeOf(vertex);
      int commits = commitByPath.getOrDefault(vertex, 0);
      double score = inDegree * 1000.0 + outDegree * 10.0 + commits * 0.01;
      scores.put(vertex, score);
    }
    return Map.copyOf(scores);
  }

  public Map<String, int[]> computeDegrees(
      List<SourceFile> files, List<DependencyEdge> edges) {
    Graph<String, DefaultEdge> graph = new SimpleDirectedGraph<>(DefaultEdge.class);
    for (SourceFile file : files) {
      graph.addVertex(file.path());
    }
    for (DependencyEdge edge : edges) {
      if (!graph.containsVertex(edge.fromPath()) || !graph.containsVertex(edge.toPath())) {
        continue;
      }
      if (edge.fromPath().equals(edge.toPath())
          || graph.containsEdge(edge.fromPath(), edge.toPath())) {
        continue;
      }
      graph.addEdge(edge.fromPath(), edge.toPath());
    }
    Map<String, int[]> degrees = new HashMap<>();
    for (String vertex : graph.vertexSet()) {
      degrees.put(vertex, new int[] {graph.inDegreeOf(vertex), graph.outDegreeOf(vertex)});
    }
    return Map.copyOf(degrees);
  }

  public List<String> selectTopPathsByCentrality(Map<String, Double> scores, int limit) {
    return scores.entrySet().stream()
        .sorted(Map.Entry.<String, Double>comparingByValue(Comparator.reverseOrder()))
        .limit(limit)
        .map(Map.Entry::getKey)
        .collect(Collectors.toList());
  }

  public static boolean isNonCodePath(String path) {
    if (path == null || path.isBlank()) {
      return true;
    }
    String lower = path.replace('\\', '/').toLowerCase(Locale.ROOT);
    String name = lower.substring(lower.lastIndexOf('/') + 1);
    if (name.isBlank()) {
      return true;
    }
    if (name.equals("license")
        || name.equals("licence")
        || name.startsWith("license.")
        || name.startsWith("licence.")
        || name.equals("copying")
        || name.equals("changelog")
        || name.equals("authors")
        || name.equals("contributors")) {
      return true;
    }
    if (name.startsWith("readme")) {
      return true;
    }
    return name.endsWith(".md")
        || name.endsWith(".rst")
        || name.endsWith(".txt")
        || name.endsWith(".png")
        || name.endsWith(".jpg")
        || name.endsWith(".jpeg")
        || name.endsWith(".gif")
        || name.endsWith(".svg")
        || name.endsWith(".ico")
        || name.endsWith(".ipynb")
        || name.endsWith(".csv")
        || name.endsWith(".json")
        || name.endsWith(".yml")
        || name.endsWith(".yaml")
        || name.endsWith(".toml")
        || name.endsWith(".lock");
  }
}
