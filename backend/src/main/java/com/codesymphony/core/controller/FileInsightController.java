package com.codesymphony.core.controller;

import com.codesymphony.core.dto.request.ExplainFileRequest;
import com.codesymphony.core.dto.response.ExplainFileResponse;
import com.codesymphony.core.dto.response.FileNeighborhoodResponse;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.service.CodeExplanationService;
import com.codesymphony.core.service.FileNeighborhoodService;
import com.codesymphony.core.service.RepositoryIngestionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/repos/{repositoryId}/files")
public class FileInsightController {

  private final RepositoryIngestionService repositoryIngestionService;
  private final FileNeighborhoodService fileNeighborhoodService;
  private final CodeExplanationService codeExplanationService;

  public FileInsightController(
      RepositoryIngestionService repositoryIngestionService,
      FileNeighborhoodService fileNeighborhoodService,
      CodeExplanationService codeExplanationService) {
    this.repositoryIngestionService = repositoryIngestionService;
    this.fileNeighborhoodService = fileNeighborhoodService;
    this.codeExplanationService = codeExplanationService;
  }

  @GetMapping("/neighborhood")
  public FileNeighborhoodResponse neighborhood(
      @PathVariable String repositoryId, @RequestParam("path") String path) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return fileNeighborhoodService.buildNeighborhood(graph, path);
  }

  @PostMapping("/explain")
  public ExplainFileResponse explain(
      @PathVariable String repositoryId, @Valid @RequestBody ExplainFileRequest request) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return codeExplanationService.explainFile(graph, request.path());
  }
}
