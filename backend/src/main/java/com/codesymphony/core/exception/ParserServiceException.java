package com.codesymphony.core.exception;

public class ParserServiceException extends RuntimeException {

  public ParserServiceException(String message, Throwable cause) {
    super(message, cause);
  }

  public ParserServiceException(String message) {
    super(message);
  }
}
