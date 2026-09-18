package com.codesymphony.core.exception;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(RepositoryNotFoundException.class)
  ResponseEntity<Map<String, Object>> handleNotFound(RepositoryNotFoundException exception) {
    return error(HttpStatus.NOT_FOUND, exception.getMessage());
  }

  @ExceptionHandler(SourceFileNotFoundException.class)
  ResponseEntity<Map<String, Object>> handleMissingFile(SourceFileNotFoundException exception) {
    return error(HttpStatus.NOT_FOUND, exception.getMessage());
  }

  @ExceptionHandler(CommitIndexOutOfBoundsException.class)
  ResponseEntity<Map<String, Object>> handleCommitIndex(CommitIndexOutOfBoundsException exception) {
    return error(HttpStatus.BAD_REQUEST, exception.getMessage());
  }

  @ExceptionHandler(UnsupportedRepositorySizeException.class)
  ResponseEntity<Map<String, Object>> handleTooLarge(UnsupportedRepositorySizeException exception) {
    return error(HttpStatus.PAYLOAD_TOO_LARGE, exception.getMessage());
  }

  @ExceptionHandler({GitCloneFailedException.class, ParserServiceException.class})
  ResponseEntity<Map<String, Object>> handleUpstream(RuntimeException exception) {
    return error(HttpStatus.BAD_GATEWAY, exception.getMessage());
  }

  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException exception) {
    return error(HttpStatus.BAD_REQUEST, exception.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
    FieldError fieldError = exception.getBindingResult().getFieldError();
    String message =
        fieldError == null ? "Validation failed" : fieldError.getField() + ": " + fieldError.getDefaultMessage();
    return error(HttpStatus.BAD_REQUEST, message);
  }

  private static ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "timestamp", Instant.now().toString(),
                "status", status.value(),
                "error", status.getReasonPhrase(),
                "message", message));
  }
}
