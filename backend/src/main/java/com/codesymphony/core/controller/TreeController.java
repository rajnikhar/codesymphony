package com.codesymphony.core.controller;

import com.codesymphony.core.config.CacheConfig;
import com.codesymphony.core.dto.response.TreeResponse;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.service.RepositoryIngestionService;
import com.codesymphony.core.service.TreeStructureService;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/repos/{repositoryId}/tree")
public class TreeController {

  private final RepositoryIngestionService repositoryIngestionService;
  private final TreeStructureService treeStructureService;

  public TreeController(
      RepositoryIngestionService repositoryIngestionService,
      TreeStructureService treeStructureService) {
    this.repositoryIngestionService = repositoryIngestionService;
    this.treeStructureService = treeStructureService;
  }

  @GetMapping
  @Cacheable(cacheNames = CacheConfig.REPOSITORY_TREE_CACHE, key = "#repositoryId")
  public TreeResponse tree(@PathVariable String repositoryId) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return treeStructureService.buildTree(graph);
  }
}
