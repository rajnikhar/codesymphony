package com.codesymphony.core.service;

import com.codesymphony.core.dto.response.FileNeighborhoodResponse;
import com.codesymphony.core.dto.response.GraphEdgeDto;
import com.codesymphony.core.dto.response.GraphNodeDto;
import com.codesymphony.core.dto.response.GraphResponse;
import com.codesymphony.core.dto.response.RelatedFileDto;
import com.codesymphony.core.exception.SourceFileNotFoundException;
import com.codesymphony.core.model.DependencyEdge;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.model.SourceFile;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class FileNeighborhoodService {

  public FileNeighborhoodResponse buildNeighborhood(RepositoryGraph graph, String path) {
    Map<String, SourceFile> filesByPath =
        graph.files().stream()
            .collect(Collectors.toMap(SourceFile::path, Function.identity(), (a, b) -> a));

    SourceFile center = filesByPath.get(path);
    if (center == null) {
      throw new SourceFileNotFoundException(path);
    }

    List<RelatedFileDto> dependsOn = new ArrayList<>();
    List<RelatedFileDto> usedBy = new ArrayList<>();

    for (DependencyEdge edge : graph.edges()) {
      if (edge.fromPath().equals(path)) {
        SourceFile target = filesByPath.get(edge.toPath());
        if (target != null) {
          dependsOn.add(toRelated(target, "depends_on"));
        }
      }
      if (edge.toPath().equals(path)) {
        SourceFile source = filesByPath.get(edge.fromPath());
        if (source != null) {
          usedBy.add(toRelated(source, "used_by"));
        }
      }
    }

    GraphResponse focusGraph = buildFocusGraph(graph, center, dependsOn, usedBy);
    return new FileNeighborhoodResponse(
        graph.repositoryId(),
        center.path(),
        center.language(),
        center.commitCount(),
        center.churn(),
        List.copyOf(dependsOn),
        List.copyOf(usedBy),
        focusGraph);
  }

  private static RelatedFileDto toRelated(SourceFile file, String relation) {
    return new RelatedFileDto(
        file.path(), file.language(), file.commitCount(), file.churn(), relation);
  }

  private static GraphResponse buildFocusGraph(
      RepositoryGraph graph,
      SourceFile center,
      List<RelatedFileDto> dependsOn,
      List<RelatedFileDto> usedBy) {
    Set<String> visible = new LinkedHashSet<>();
    visible.add(center.path());
    dependsOn.forEach(file -> visible.add(file.path()));
    usedBy.forEach(file -> visible.add(file.path()));

    Map<String, SourceFile> filesByPath =
        graph.files().stream()
            .collect(Collectors.toMap(SourceFile::path, Function.identity(), (a, b) -> a));

    List<GraphNodeDto> nodes = new ArrayList<>();
    for (String path : visible) {
      SourceFile file = filesByPath.get(path);
      if (file == null) {
        continue;
      }
      nodes.add(
          new GraphNodeDto(file.path(), file.path(), "file", file.commitCount(), file.churn()));
    }

    List<GraphEdgeDto> edges =
        graph.edges().stream()
            .filter(
                edge ->
                    visible.contains(edge.fromPath()) && visible.contains(edge.toPath()))
            .map(edge -> new GraphEdgeDto(edge.fromPath(), edge.toPath(), edge.kind()))
            .toList();

    return new GraphResponse(graph.repositoryId(), graph.mode().name(), nodes, edges);
  }
}
