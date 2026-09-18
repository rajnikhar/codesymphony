package com.codesymphony.core.repository;

import com.codesymphony.core.exception.RepositoryNotFoundException;
import com.codesymphony.core.model.RepositoryGraph;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Repository;

@Repository
public class ParsedRepositoryCache {

  private final Map<String, RepositoryGraph> graphsById = new ConcurrentHashMap<>();
  private final Map<String, String> idsByCanonicalUrl = new ConcurrentHashMap<>();

  public void store(RepositoryGraph graph) {
    graphsById.put(graph.repositoryId(), graph);
    idsByCanonicalUrl.put(graph.canonicalUrl(), graph.repositoryId());
  }

  public RepositoryGraph requireById(String repositoryId) {
    RepositoryGraph graph = graphsById.get(repositoryId);
    if (graph == null) {
      throw new RepositoryNotFoundException(repositoryId);
    }
    return graph;
  }

  public Optional<RepositoryGraph> findByCanonicalUrl(String canonicalUrl) {
    String repositoryId = idsByCanonicalUrl.get(canonicalUrl);
    if (repositoryId == null) {
      return Optional.empty();
    }
    return Optional.ofNullable(graphsById.get(repositoryId));
  }
}
