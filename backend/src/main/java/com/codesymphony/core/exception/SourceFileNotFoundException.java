package com.codesymphony.core.exception;

public class SourceFileNotFoundException extends RuntimeException {

  public SourceFileNotFoundException(String path) {
    super("Source file not found in repository graph: " + path);
  }
}
