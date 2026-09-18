package com.codesymphony.core.service;

import com.codesymphony.core.dto.response.ExplainFileResponse;
import com.codesymphony.core.dto.response.FileNeighborhoodResponse;
import com.codesymphony.core.dto.response.RelatedFileDto;
import com.codesymphony.core.exception.SourceFileNotFoundException;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.model.SourceFile;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class CodeExplanationService {

  private static final Pattern JAVA_PACKAGE =
      Pattern.compile("^\\s*package\\s+([\\w.]+)\\s*;", Pattern.MULTILINE);
  private static final Pattern JAVA_TYPE =
      Pattern.compile(
          "^\\s*(?:public\\s+|protected\\s+|private\\s+)?(?:abstract\\s+|final\\s+)?(class|interface|enum|record)\\s+(\\w+)",
          Pattern.MULTILINE);
  private static final Pattern JS_EXPORT_FUNCTION =
      Pattern.compile("export\\s+(?:async\\s+)?function\\s+(\\w+)");
  private static final Pattern JS_EXPORT_CLASS =
      Pattern.compile("export\\s+(?:default\\s+)?class\\s+(\\w+)");
  private static final Pattern PYTHON_CLASS = Pattern.compile("^class\\s+(\\w+)", Pattern.MULTILINE);
  private static final Pattern PYTHON_DEF = Pattern.compile("^def\\s+(\\w+)\\s*\\(", Pattern.MULTILINE);

  private final FileNeighborhoodService fileNeighborhoodService;

  public CodeExplanationService(FileNeighborhoodService fileNeighborhoodService) {
    this.fileNeighborhoodService = fileNeighborhoodService;
  }

  public ExplainFileResponse explainFile(RepositoryGraph graph, String path) {
    SourceFile sourceFile =
        graph.files().stream()
            .filter(file -> file.path().equals(path))
            .findFirst()
            .orElseThrow(() -> new SourceFileNotFoundException(path));

    FileNeighborhoodResponse neighborhood =
        fileNeighborhoodService.buildNeighborhood(graph, path);
    String content = readFileSnippet(graph.cloneDirectory().resolve(path));
    FileRole role = detectRole(path, content);
    String name = fileName(path);

    List<String> points = new ArrayList<>();
    points.add(roleDescription(role, name));
    points.add(activityPoint(sourceFile));
    points.add(dependsOnPoint(neighborhood.dependsOn(), name));
    points.add(usedByPoint(neighborhood.usedBy(), name));
    extractStructureHints(content, sourceFile.language()).ifPresent(points::add);
    points.add(architectureTip(role));

    String title = "Understanding " + name;
    String summary =
        name
            + " is best thought of as a "
            + role.label()
            + " in this codebase.";

    String story = buildStory(name, role, neighborhood, sourceFile);

    List<String> howToRead =
        List.of(
            "The glowing / selected circle is the file you clicked.",
            "Lines mean \"imports\" — not runtime calls.",
            "\"Depends on\" = files this one needs (it imports them).",
            "\"Used by\" = files that need this one (they import it).",
            "Drag the timeline to see which files changed in each commit.");

    return new ExplainFileResponse(
        path,
        title,
        summary,
        story,
        List.copyOf(points),
        howToRead,
        "Still curious? Click any related file name to jump there, or scrub the timeline to see when this area of the code changed.");
  }

  private static String buildStory(
      String name,
      FileRole role,
      FileNeighborhoodResponse neighborhood,
      SourceFile sourceFile) {
    StringBuilder story = new StringBuilder();
    story
        .append("Imagine this repo as a team of files that hand work to each other. ")
        .append(name)
        .append(" is playing the role of a ")
        .append(role.label())
        .append(". ");

    story.append(roleStoryBeat(role));

    if (!neighborhood.usedBy().isEmpty()) {
      story
          .append(" Other files that call into it by importing it are: ")
          .append(joinNames(neighborhood.usedBy()))
          .append(". Think of those as \"upstream\" teammates that rely on ")
          .append(name)
          .append(". ");
    } else {
      story
          .append(" Right now nothing else in the parsed graph imports it, so it may be an entry point, a leaf utility, or only referenced outside allowlisted files. ");
    }

    if (!neighborhood.dependsOn().isEmpty()) {
      story
          .append(" To do its job it pulls in: ")
          .append(joinNames(neighborhood.dependsOn()))
          .append(". Those are \"downstream\" helpers it needs. ");
    } else {
      story.append(" It does not import other project files in this graph, so it is fairly self-contained. ");
    }

    story
        .append("In git history it shows up in ")
        .append(sourceFile.commitCount())
        .append(" commits with a churn score of ")
        .append(sourceFile.churn())
        .append(" (higher churn usually means this file changes often).");

    return story.toString();
  }

  private static String roleStoryBeat(FileRole role) {
    return switch (role) {
      case CONTROLLER ->
          "In many apps, that means it is near the front door: HTTP requests arrive here, then work is passed deeper into the system. ";
      case SERVICE ->
          "That usually means business rules and orchestration live here — it coordinates other pieces instead of talking to the outside world directly. ";
      case REPOSITORY ->
          "That usually means database / storage access lives here — load and save data for the rest of the app. ";
      case DTO ->
          "That usually means it is a data shape carried between layers (request/response fields), not the place with heavy logic. ";
      case ENTITY ->
          "That usually means it models a core domain object other layers hang off of. ";
      case CONFIG ->
          "That usually means it wires framework settings and beans rather than serving user requests. ";
      case TEST ->
          "That means it checks other code — useful to see what behavior the team cares about protecting. ";
      case MODULE ->
          "Use the related-file lists to see whether it is more of a helper, a hub, or a leaf. ";
    };
  }

  private static String activityPoint(SourceFile sourceFile) {
    String intensity =
        sourceFile.churn() > 80
            ? "quite active (high churn)"
            : sourceFile.churn() > 20 ? "moderately active" : "fairly quiet";
    return "Change activity: touched in "
        + sourceFile.commitCount()
        + " commits and marked "
        + intensity
        + ". Scrub the timeline to watch this file light up when it was edited.";
  }

  private static String dependsOnPoint(List<RelatedFileDto> dependsOn, String name) {
    if (dependsOn.isEmpty()) {
      return name + " does not import other project files in this graph.";
    }
    return name
        + " depends on "
        + dependsOn.size()
        + " project file(s): "
        + joinNames(dependsOn)
        + ". If those break, "
        + name
        + " usually breaks too.";
  }

  private static String usedByPoint(List<RelatedFileDto> usedBy, String name) {
    if (usedBy.isEmpty()) {
      return "No other parsed project file imports "
          + name
          + " — changing it may still matter, but this graph does not show inbound dependents.";
    }
    return usedBy.size()
        + " file(s) import "
        + name
        + ": "
        + joinNames(usedBy)
        + ". Changing "
        + name
        + " can ripple into those.";
  }

  private static String architectureTip(FileRole role) {
    return switch (role) {
      case CONTROLLER ->
          "Reading tip: start at the controller methods, then jump to the service files it depends on.";
      case SERVICE ->
          "Reading tip: read the service next to its repository/entity neighbors to see the full request path.";
      case REPOSITORY ->
          "Reading tip: pair this with the entity/DTO it depends on to understand the data shape.";
      case DTO, ENTITY ->
          "Reading tip: open a service/controller that uses this file to see how the fields are filled.";
      case TEST ->
          "Reading tip: tests name the behaviors that matter — skim test titles before diving into production code.";
      default ->
          "Reading tip: click a \"Used by\" neighbor to see a concrete place this file matters.";
    };
  }

  private static String readFileSnippet(Path filePath) {
    try {
      if (!Files.isRegularFile(filePath)) {
        return "";
      }
      String text = Files.readString(filePath, StandardCharsets.UTF_8);
      return text.length() > 6000 ? text.substring(0, 6000) : text;
    } catch (IOException exception) {
      return "";
    }
  }

  private static FileRole detectRole(String path, String content) {
    String name = fileName(path).toLowerCase(Locale.ROOT);
    if (name.contains("controller") || name.endsWith("controller.java")) {
      return FileRole.CONTROLLER;
    }
    if (name.contains("service") || name.endsWith("service.java")) {
      return FileRole.SERVICE;
    }
    if (name.contains("repository") || name.contains("repo") || name.endsWith("dao.java")) {
      return FileRole.REPOSITORY;
    }
    if (name.contains("dto") || name.contains("request") || name.contains("response")) {
      return FileRole.DTO;
    }
    if (name.contains("config") || name.contains("configuration")) {
      return FileRole.CONFIG;
    }
    if (name.contains("test") || path.contains("/test/")) {
      return FileRole.TEST;
    }
    if (content.contains("@RestController") || content.contains("@Controller")) {
      return FileRole.CONTROLLER;
    }
    if (content.contains("@Service")) {
      return FileRole.SERVICE;
    }
    if (content.contains("@Repository")) {
      return FileRole.REPOSITORY;
    }
    if (content.contains("@Entity") || content.contains("@Table")) {
      return FileRole.ENTITY;
    }
    return FileRole.MODULE;
  }

  private static String roleDescription(FileRole role, String fileName) {
    return switch (role) {
      case CONTROLLER ->
          fileName + " looks like an API/web layer type — requests arrive here first.";
      case SERVICE ->
          fileName + " looks like business logic — it coordinates work between layers.";
      case REPOSITORY ->
          fileName + " looks like data access — it loads/saves information for the app.";
      case DTO ->
          fileName + " looks like a data-transfer object — a package of fields moved between layers.";
      case ENTITY ->
          fileName + " looks like a domain/persistence entity — a core data model.";
      case CONFIG ->
          fileName + " looks like configuration wiring for the framework.";
      case TEST ->
          fileName + " is a test — it documents and protects expected behavior.";
      case MODULE ->
          fileName + " is a project module — use neighbors to see where it sits.";
    };
  }

  private static Optional<String> extractStructureHints(String content, String language) {
    if (content.isBlank()) {
      return Optional.empty();
    }
    if ("java".equals(language)) {
      Matcher packageMatcher = JAVA_PACKAGE.matcher(content);
      Matcher typeMatcher = JAVA_TYPE.matcher(content);
      String packageName = packageMatcher.find() ? packageMatcher.group(1) : null;
      if (typeMatcher.find()) {
        String typeKind = typeMatcher.group(1);
        String typeName = typeMatcher.group(2);
        if (packageName != null) {
          return Optional.of(
              "In code it is declared as "
                  + typeKind
                  + " "
                  + typeName
                  + " inside package "
                  + packageName
                  + ".");
        }
        return Optional.of("In code it is declared as " + typeKind + " " + typeName + ".");
      }
    }
    if ("js".equals(language) || "ts".equals(language)) {
      Matcher classMatcher = JS_EXPORT_CLASS.matcher(content);
      Matcher fnMatcher = JS_EXPORT_FUNCTION.matcher(content);
      List<String> exports = new ArrayList<>();
      while (classMatcher.find() && exports.size() < 3) {
        exports.add("class " + classMatcher.group(1));
      }
      while (fnMatcher.find() && exports.size() < 5) {
        exports.add("function " + fnMatcher.group(1));
      }
      if (!exports.isEmpty()) {
        return Optional.of("Notable exports include: " + String.join(", ", exports) + ".");
      }
    }
    if ("py".equals(language)) {
      Matcher classMatcher = PYTHON_CLASS.matcher(content);
      Matcher defMatcher = PYTHON_DEF.matcher(content);
      List<String> bits = new ArrayList<>();
      if (classMatcher.find()) {
        bits.add("class " + classMatcher.group(1));
      }
      int defs = 0;
      while (defMatcher.find() && defs < 3) {
        bits.add("def " + defMatcher.group(1));
        defs++;
      }
      if (!bits.isEmpty()) {
        return Optional.of("Notable definitions include: " + String.join(", ", bits) + ".");
      }
    }
    return Optional.empty();
  }

  private static String joinNames(List<RelatedFileDto> files) {
    return files.stream()
        .map(file -> fileName(file.path()))
        .limit(8)
        .collect(Collectors.joining(", "));
  }

  private static String fileName(String path) {
    int slash = path.lastIndexOf('/');
    return slash >= 0 ? path.substring(slash + 1) : path;
  }

  private enum FileRole {
    CONTROLLER("controller"),
    SERVICE("service"),
    REPOSITORY("repository"),
    DTO("DTO"),
    ENTITY("entity"),
    CONFIG("config module"),
    TEST("test"),
    MODULE("module");

    private final String label;

    FileRole(String label) {
      this.label = label;
    }

    String label() {
      return label;
    }
  }
}
