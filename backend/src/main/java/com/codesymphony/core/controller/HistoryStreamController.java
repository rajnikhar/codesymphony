package com.codesymphony.core.controller;

import com.codesymphony.core.dto.request.ScrubCommitRequest;
import com.codesymphony.core.dto.response.CommitEventMessage;
import com.codesymphony.core.exception.CommitIndexOutOfBoundsException;
import com.codesymphony.core.exception.RepositoryNotFoundException;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.service.CommitHistoryService;
import com.codesymphony.core.service.RepositoryIngestionService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;
import org.springframework.validation.annotation.Validated;

/**
 * WebSocket entry point for commit scrub events only.
 *
 * <p>Client sends to {@code /app/repos/{repositoryId}/scrub} with {@code {"index": N}}. Server
 * publishes {@link CommitEventMessage} to {@code /topic/repos/{repositoryId}/commits}.
 */
@Controller
@Validated
public class HistoryStreamController {

  private final RepositoryIngestionService repositoryIngestionService;
  private final CommitHistoryService commitHistoryService;

  public HistoryStreamController(
      RepositoryIngestionService repositoryIngestionService,
      CommitHistoryService commitHistoryService) {
    this.repositoryIngestionService = repositoryIngestionService;
    this.commitHistoryService = commitHistoryService;
  }

  @MessageMapping("/repos/{repositoryId}/scrub")
  @SendTo("/topic/repos/{repositoryId}/commits")
  public CommitEventMessage scrubCommit(
      @DestinationVariable String repositoryId, @Valid ScrubCommitRequest request) {
    RepositoryGraph graph = repositoryIngestionService.requireRepository(repositoryId);
    return commitHistoryService.buildCommitEvent(graph, request.index());
  }

  @MessageExceptionHandler({
    CommitIndexOutOfBoundsException.class,
    RepositoryNotFoundException.class
  })
  @SendToUser("/queue/errors")
  public Map<String, String> handleScrubFailure(RuntimeException exception) {
    return Map.of("error", exception.getMessage());
  }
}
