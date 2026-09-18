package com.codesymphony.core.controller;

import com.codesymphony.core.dto.request.AnalyzeRepositoryRequest;
import com.codesymphony.core.dto.response.AnalyzeRepositoryResponse;
import com.codesymphony.core.dto.response.RepositoryStatusResponse;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.service.RepositoryIngestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/repos")
public class RepositoryController {

  private final RepositoryIngestionService repositoryIngestionService;

  public RepositoryController(RepositoryIngestionService repositoryIngestionService) {
    this.repositoryIngestionService = repositoryIngestionService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.ACCEPTED)
  public AnalyzeRepositoryResponse analyze(@Valid @RequestBody AnalyzeRepositoryRequest request) {
    RepositoryGraph graph = repositoryIngestionService.ingestGitHubRepository(request.url());
    return new AnalyzeRepositoryResponse(
        graph.repositoryId(),
        "ready",
        graph.mode().name(),
        "Repository ingested successfully");
  }

  @GetMapping("/{repositoryId}")
  public RepositoryStatusResponse status(@PathVariable String repositoryId) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return new RepositoryStatusResponse(
        graph.repositoryId(),
        "ready",
        graph.mode().name(),
        graph.canonicalUrl(),
        graph.files().size(),
        graph.edges().size(),
        graph.mode() == com.codesymphony.core.model.RepositoryMode.HISTORY_ONLY
            ? "History-only mode — few or no supported import edges"
            : "Full import graph available");
  }
}
