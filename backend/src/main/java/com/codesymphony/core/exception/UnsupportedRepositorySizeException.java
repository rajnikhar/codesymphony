package com.codesymphony.core.exception;

public class UnsupportedRepositorySizeException extends RuntimeException {

  public UnsupportedRepositorySizeException(int fileCount, int maxAllowed) {
    super(
        "Repository has "
            + fileCount
            + " files, which exceeds the supported limit of "
            + maxAllowed
            + " (laptop safety ceiling). Try a smaller repo.");
  }
}
