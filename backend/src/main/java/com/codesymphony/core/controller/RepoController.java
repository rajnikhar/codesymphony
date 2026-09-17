package com.codesymphony.core.controller;

import com.codesymphony.core.model.GraphResponse;
import com.codesymphony.core.model.IngestRequest;
import com.codesymphony.core.model.IngestResponse;
import com.codesymphony.core.model.RepoStatus;
import com.codesymphony.core.service.RepoService;
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
public class RepoController {

  private final RepoService repoService;

  public RepoController(RepoService repoService) {
    this.repoService = repoService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.ACCEPTED)
  public IngestResponse ingest(@Valid @RequestBody IngestRequest request) {
    return repoService.startIngest(request.url());
  }

  @GetMapping("/{id}")
  public RepoStatus status(@PathVariable("id") String id) {
    return repoService.getStatus(id);
  }

  @GetMapping("/{id}/graph")
  public GraphResponse graph(@PathVariable("id") String id) {
    return repoService.getGraph(id);
  }
}
