package com.codesymphony.core.controller;

import com.codesymphony.core.dto.response.GraphResponse;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.service.DependencyGraphService;
import com.codesymphony.core.service.RepositoryIngestionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/repos/{repositoryId}/graph")
public class GraphController {

  private final RepositoryIngestionService repositoryIngestionService;
  private final DependencyGraphService dependencyGraphService;

  public GraphController(
      RepositoryIngestionService repositoryIngestionService,
      DependencyGraphService dependencyGraphService) {
    this.repositoryIngestionService = repositoryIngestionService;
    this.dependencyGraphService = dependencyGraphService;
  }

  @GetMapping
  public GraphResponse graph(@PathVariable String repositoryId) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return dependencyGraphService.toDirectoryCollapsedGraphResponse(graph);
  }

  @GetMapping("/expand")
  public GraphResponse expand(
      @PathVariable String repositoryId, @RequestParam("path") String path) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return dependencyGraphService.expandDirectory(graph, path);
  }
}
