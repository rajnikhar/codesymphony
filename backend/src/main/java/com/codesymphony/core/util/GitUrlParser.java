package com.codesymphony.core.util;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class GitUrlParser {

  private static final Pattern GITHUB_HTTPS =
      Pattern.compile("^https://github\\.com/([\\w.-]+)/([\\w.-]+?)(?:\\.git)?/?$", Pattern.CASE_INSENSITIVE);
  private static final Pattern GITHUB_SSH =
      Pattern.compile("^git@github\\.com:([\\w.-]+)/([\\w.-]+?)(?:\\.git)?$", Pattern.CASE_INSENSITIVE);

  private GitUrlParser() {}

  public static String canonicalizeGitHubUrl(String rawUrl) {
    String trimmed = rawUrl == null ? "" : rawUrl.trim();
    Matcher https = GITHUB_HTTPS.matcher(trimmed);
    if (https.matches()) {
      return "https://github.com/" + https.group(1) + "/" + stripGitSuffix(https.group(2));
    }
    Matcher ssh = GITHUB_SSH.matcher(trimmed);
    if (ssh.matches()) {
      return "https://github.com/" + ssh.group(1) + "/" + stripGitSuffix(ssh.group(2));
    }
    throw new IllegalArgumentException("Unsupported GitHub repository URL: " + rawUrl);
  }

  public static String repositoryKey(String canonicalUrl) {
    return canonicalUrl.toLowerCase(Locale.ROOT);
  }

  public static String cloneUrl(String canonicalUrl) {
    return canonicalUrl.endsWith(".git") ? canonicalUrl : canonicalUrl + ".git";
  }

  private static String stripGitSuffix(String repositoryName) {
    if (repositoryName.toLowerCase(Locale.ROOT).endsWith(".git")) {
      return repositoryName.substring(0, repositoryName.length() - 4);
    }
    return repositoryName;
  }
}
