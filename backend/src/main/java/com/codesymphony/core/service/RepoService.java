package com.codesymphony.core.service;

import com.codesymphony.core.model.GraphNode;
import com.codesymphony.core.model.GraphResponse;
import com.codesymphony.core.model.IngestResponse;
import com.codesymphony.core.model.RepoMode;
import com.codesymphony.core.model.RepoStatus;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Skeleton ingest/graph service. Week 1–2: wire JGit clone + parser HTTP + JGraphT.
 */
@Service
public class RepoService {

  private final Map<String, RepoStatus> statuses = new ConcurrentHashMap<>();

  public IngestResponse startIngest(String url) {
    String repoId = UUID.randomUUID().toString();
    statuses.put(
        repoId,
        new RepoStatus(repoId, "accepted", RepoMode.HISTORY_ONLY,
            "Skeleton only — clone/parse not implemented yet. url=" + url));
    return new IngestResponse(repoId, "accepted");
  }

  public RepoStatus getStatus(String repoId) {
    RepoStatus status = statuses.get(repoId);
    if (status == null) {
      return new RepoStatus(repoId, "not_found", RepoMode.HISTORY_ONLY, "Unknown repoId");
    }
    return status;
  }

  public GraphResponse getGraph(String repoId) {
    getStatus(repoId);
    // Placeholder empty graph until JGit + parser are wired
    return new GraphResponse(
        RepoMode.HISTORY_ONLY,
        List.of(new GraphNode("root", "/", "directory", 0, 0)),
        List.of());
  }
}
