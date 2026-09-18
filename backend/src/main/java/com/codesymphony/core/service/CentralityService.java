package com.codesymphony.core.service;

import com.codesymphony.core.model.DependencyEdge;
import com.codesymphony.core.model.SourceFile;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jgrapht.Graph;
import org.jgrapht.alg.scoring.PageRank;
import org.jgrapht.graph.DefaultEdge;
import org.jgrapht.graph.SimpleDirectedGraph;
import org.springframework.stereotype.Service;

@Service
public class CentralityService {

  public Map<String, Double> computeFileCentralityScores(
      List<SourceFile> files, List<DependencyEdge> edges) {
    Graph<String, DefaultEdge> graph = new SimpleDirectedGraph<>(DefaultEdge.class);
    for (SourceFile file : files) {
      graph.addVertex(file.path());
    }
    for (DependencyEdge edge : edges) {
      if (!graph.containsVertex(edge.fromPath()) || !graph.containsVertex(edge.toPath())) {
        continue;
      }
      if (edge.fromPath().equals(edge.toPath())) {
        continue;
      }
      graph.addEdge(edge.fromPath(), edge.toPath());
    }
    if (graph.vertexSet().isEmpty()) {
      return Map.of();
    }
    PageRank<String, DefaultEdge> pageRank = new PageRank<>(graph);
    Map<String, Double> scores = new HashMap<>();
    for (String vertex : graph.vertexSet()) {
      scores.put(vertex, pageRank.getVertexScore(vertex));
    }
    return Map.copyOf(scores);
  }

  public List<String> selectTopPathsByCentrality(Map<String, Double> scores, int limit) {
    return scores.entrySet().stream()
        .sorted(Map.Entry.<String, Double>comparingByValue(Comparator.reverseOrder()))
        .limit(limit)
        .map(Map.Entry::getKey)
        .collect(Collectors.toList());
  }
}
