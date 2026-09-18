package com.codesymphony.core.service;

import com.codesymphony.core.exception.ParserServiceException;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.nio.file.Path;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class ParsingClientService {

  private final RestClient restClient;

  public ParsingClientService(
      RestClient.Builder restClientBuilder,
      com.codesymphony.core.config.CodeSymphonyProperties properties) {
    this.restClient = restClientBuilder.baseUrl(properties.parserBaseUrl()).build();
  }

  public ParserResult fetchImportGraph(Path repositoryCloneDirectory) {
    try {
      ParserResult result =
          restClient
              .post()
              .uri("/parse")
              .contentType(MediaType.APPLICATION_JSON)
              .body(new ParseRequestBody(repositoryCloneDirectory.toAbsolutePath().toString()))
              .retrieve()
              .body(ParserResult.class);
      if (result == null) {
        throw new ParserServiceException("Parser returned an empty response");
      }
      return result;
    } catch (RestClientException exception) {
      throw new ParserServiceException(
          "Failed to call parsing microservice at /parse", exception);
    }
  }

  public record ParseRequestBody(@JsonProperty("repo_path") String repoPath) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ParserResult(
      @JsonProperty("mode_hint") String modeHint,
      List<ParsedFileDto> files,
      List<ParsedEdgeDto> edges,
      ParseStatsDto stats) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ParsedFileDto(String path, String language) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ParsedEdgeDto(
      @JsonProperty("from") String from, @JsonProperty("to") String to, String kind) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record ParseStatsDto(
      int parsed,
      @JsonProperty("skipped_unsupported") int skippedUnsupported,
      @JsonProperty("unresolved_imports") int unresolvedImports) {}
}
