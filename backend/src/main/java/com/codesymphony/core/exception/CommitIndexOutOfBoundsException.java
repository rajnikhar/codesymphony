package com.codesymphony.core.exception;

public class CommitIndexOutOfBoundsException extends RuntimeException {

  public CommitIndexOutOfBoundsException(int index, int commitCount) {
    super(
        "Commit index "
            + index
            + " is out of bounds for timeline of size "
            + commitCount);
  }
}
