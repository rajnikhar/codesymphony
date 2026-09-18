package com.codesymphony.core.exception;

public class GitCloneFailedException extends RuntimeException {

  public GitCloneFailedException(String url, Throwable cause) {
    super("Failed to clone repository: " + url, cause);
  }
}
