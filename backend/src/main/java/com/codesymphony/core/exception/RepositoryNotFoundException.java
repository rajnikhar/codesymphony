package com.codesymphony.core.exception;

public class RepositoryNotFoundException extends RuntimeException {

  public RepositoryNotFoundException(String repositoryId) {
    super("Repository not found: " + repositoryId);
  }
}
