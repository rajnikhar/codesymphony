package com.codesymphony.core.controller;

import com.codesymphony.core.dto.response.CommitEventMessage;
import com.codesymphony.core.dto.response.TimelineResponse;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.service.CommitHistoryService;
import com.codesymphony.core.service.RepositoryIngestionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/repos/{repositoryId}/timeline")
public class TimelineController {

  private final RepositoryIngestionService repositoryIngestionService;
  private final CommitHistoryService commitHistoryService;

  public TimelineController(
      RepositoryIngestionService repositoryIngestionService,
      CommitHistoryService commitHistoryService) {
    this.repositoryIngestionService = repositoryIngestionService;
    this.commitHistoryService = commitHistoryService;
  }

  @GetMapping
  public TimelineResponse timeline(@PathVariable String repositoryId) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return commitHistoryService.buildTimelineResponse(graph);
  }

  /**
   * REST scrub helper for tests and clients that do not use WebSocket yet. Live streaming uses
   * {@link HistoryStreamController}.
   */
  @GetMapping("/commits/{index}")
  public CommitEventMessage commitAt(
      @PathVariable String repositoryId, @PathVariable int index) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return commitHistoryService.buildCommitEvent(graph, index);
  }
}
