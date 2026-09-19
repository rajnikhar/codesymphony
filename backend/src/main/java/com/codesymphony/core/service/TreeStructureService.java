package com.codesymphony.core.service;

import com.codesymphony.core.dto.response.TreeBranchDto;
import com.codesymphony.core.dto.response.TreeFileDto;
import com.codesymphony.core.dto.response.TreeResponse;
import com.codesymphony.core.dto.response.TreeTrunkDto;
import com.codesymphony.core.model.CommitRecord;
import com.codesymphony.core.model.DependencyEdge;
import com.codesymphony.core.model.RepositoryGraph;
import com.codesymphony.core.model.SourceFile;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class TreeStructureService {

  private static final int MAX_DIRECTORY_DEPTH = 3;
  private static final int MAX_FILES_PER_BRANCH = 12;
  private static final int MAX_TOP_LEVEL_BRANCHES = 12;

  private final CentralityService centralityService;

  public TreeStructureService(CentralityService centralityService) {
    this.centralityService = centralityService;
  }

  public TreeResponse buildTree(RepositoryGraph graph) {
    List<SourceFile> files = graph.files() == null ? List.of() : graph.files();
    List<DependencyEdge> edges = graph.edges() == null ? List.of() : graph.edges();
    List<CommitRecord> commits = graph.commits() == null ? List.of() : graph.commits();

    Map<String, int[]> degrees = centralityService.computeDegrees(files, edges);
    Map<String, Integer> depthByPath = computeDependencyDepth(files, edges);
    Map<String, Integer> firstCommitByPath = firstCommitIndices(files, commits);
    Map<String, List<Integer>> touchesByPath = commitTouches(files, commits);
    Map<String, Integer> churnByPath = fileChurn(files, commits);

    TreeTrunkDto trunk = selectTrunk(files, degrees, depthByPath, firstCommitByPath);
    Map<String, Double> languageCoverage = languageCoverage(files, graph.unresolvedImportCount());

    if (trunk == null) {
      return new TreeResponse(
          graph.repositoryId(),
          Instant.now().toString(),
          "no_structure_detected",
          null,
          List.of(),
          commits.size(),
          languageCoverage);
    }

    List<TreeBranchDto> branches =
        buildBranches(files, degrees, firstCommitByPath, touchesByPath, churnByPath);

    return new TreeResponse(
        graph.repositoryId(),
        Instant.now().toString(),
        "tree",
        trunk,
        branches,
        commits.size(),
        languageCoverage);
  }

  private TreeTrunkDto selectTrunk(
      List<SourceFile> files,
      Map<String, int[]> degrees,
      Map<String, Integer> depthByPath,
      Map<String, Integer> firstCommitByPath) {
    boolean anyImportStructure =
        degrees.values().stream().anyMatch(degree -> degree[0] > 0 || degree[1] > 0);
    if (!anyImportStructure) {
      return null;
    }

    SourceFile best = null;
    int bestIn = -1;
    int bestDepth = Integer.MAX_VALUE;
    int bestFirst = Integer.MAX_VALUE;

    for (SourceFile file : files) {
      if (CentralityService.isNonCodePath(file.path())) {
        continue;
      }
      int[] deg = degrees.getOrDefault(file.path(), new int[] {0, 0});
      int inDegree = deg[0];
      int depth = depthByPath.getOrDefault(file.path(), 0);
      int first = firstCommitByPath.getOrDefault(file.path(), Integer.MAX_VALUE);
      if (best == null
          || inDegree > bestIn
          || (inDegree == bestIn && depth < bestDepth)
          || (inDegree == bestIn && depth == bestDepth && first < bestFirst)) {
        best = file;
        bestIn = inDegree;
        bestDepth = depth;
        bestFirst = first;
      }
    }

    if (best == null) {
      return null;
    }
    int[] deg = degrees.getOrDefault(best.path(), new int[] {0, 0});
    return new TreeTrunkDto(
        best.path(), deg[0], firstCommitByPath.getOrDefault(best.path(), 0));
  }

  private List<TreeBranchDto> buildBranches(
      List<SourceFile> files,
      Map<String, int[]> degrees,
      Map<String, Integer> firstCommitByPath,
      Map<String, List<Integer>> touchesByPath,
      Map<String, Integer> churnByPath) {

    // Fold paths deeper than depth 3 into their depth-3 ancestor.
    Map<String, List<SourceFile>> byTop = new LinkedHashMap<>();
    Map<String, Map<String, List<SourceFile>>> nested = new HashMap<>();

    for (SourceFile file : files) {
      String path = file.path().replace('\\', '/');
      String[] parts = path.split("/");
      if (parts.length == 1) {
        byTop.computeIfAbsent("(root)", key -> new ArrayList<>()).add(file);
        continue;
      }
      String top = parts[0];
      byTop.computeIfAbsent(top, key -> new ArrayList<>()).add(file);

      if (parts.length >= 3) {
        // depth-2 directory under top (cap nesting to depth 3 from root → one sub-level)
        String mid = parts[0] + "/" + parts[1];
        nested
            .computeIfAbsent(top, key -> new LinkedHashMap<>())
            .computeIfAbsent(mid, key -> new ArrayList<>())
            .add(file);
      }
    }

    List<Map.Entry<String, List<SourceFile>>> ranked =
        byTop.entrySet().stream()
            .sorted(
                Comparator.<Map.Entry<String, List<SourceFile>>>comparingInt(
                        entry ->
                            entry.getValue().stream()
                                .mapToInt(f -> churnByPath.getOrDefault(f.path(), f.churn()))
                                .sum())
                    .reversed())
            .toList();

    List<TreeBranchDto> branches = new ArrayList<>();
    if (ranked.size() <= MAX_TOP_LEVEL_BRANCHES) {
      for (Map.Entry<String, List<SourceFile>> entry : ranked) {
        branches.add(
            toBranch(
                entry.getKey(),
                1,
                entry.getValue(),
                nested.getOrDefault(entry.getKey(), Map.of()),
                degrees,
                firstCommitByPath,
                touchesByPath,
                churnByPath));
      }
    } else {
      List<SourceFile> miscFiles = new ArrayList<>();
      for (int i = 0; i < ranked.size(); i++) {
        Map.Entry<String, List<SourceFile>> entry = ranked.get(i);
        if (i < MAX_TOP_LEVEL_BRANCHES - 1) {
          branches.add(
              toBranch(
                  entry.getKey(),
                  1,
                  entry.getValue(),
                  nested.getOrDefault(entry.getKey(), Map.of()),
                  degrees,
                  firstCommitByPath,
                  touchesByPath,
                  churnByPath));
        } else {
          miscFiles.addAll(entry.getValue());
        }
      }
      branches.add(
          toBranch(
              "misc",
              1,
              miscFiles,
              Map.of(),
              degrees,
              firstCommitByPath,
              touchesByPath,
              churnByPath));
    }

    return List.copyOf(branches);
  }

  private TreeBranchDto toBranch(
      String directory,
      int depth,
      List<SourceFile> filesInBranch,
      Map<String, List<SourceFile>> childDirs,
      Map<String, int[]> degrees,
      Map<String, Integer> firstCommitByPath,
      Map<String, List<Integer>> touchesByPath,
      Map<String, Integer> churnByPath) {

    int churn =
        filesInBranch.stream()
            .mapToInt(file -> churnByPath.getOrDefault(file.path(), file.churn()))
            .sum();

    int firstCommit =
        filesInBranch.stream()
            .mapToInt(file -> firstCommitByPath.getOrDefault(file.path(), Integer.MAX_VALUE))
            .min()
            .orElse(0);
    if (firstCommit == Integer.MAX_VALUE) {
      firstCommit = 0;
    }

    List<TreeFileDto> leafFiles = new ArrayList<>();
    // Files directly in this directory (not claimed by a deeper sub-branch at depth < 3)
    Set<String> claimedByChild = new HashSet<>();
    List<TreeBranchDto> subBranches = new ArrayList<>();

    if (depth < MAX_DIRECTORY_DEPTH && !childDirs.isEmpty()) {
      List<Map.Entry<String, List<SourceFile>>> childRanked =
          childDirs.entrySet().stream()
              .sorted(
                  Comparator.<Map.Entry<String, List<SourceFile>>>comparingInt(
                          e ->
                              e.getValue().stream()
                                  .mapToInt(f -> churnByPath.getOrDefault(f.path(), f.churn()))
                                  .sum())
                      .reversed())
              .limit(8)
              .toList();
      for (Map.Entry<String, List<SourceFile>> child : childRanked) {
        for (SourceFile file : child.getValue()) {
          claimedByChild.add(file.path());
        }
        subBranches.add(
            toBranch(
                child.getKey(),
                depth + 1,
                child.getValue(),
                Map.of(),
                degrees,
                firstCommitByPath,
                touchesByPath,
                churnByPath));
      }
    }

    List<SourceFile> direct =
        filesInBranch.stream().filter(file -> !claimedByChild.contains(file.path())).toList();

    // When depth-capped, nested files stay as direct leaves of the depth-3 branch.
    List<SourceFile> rankedLeaves =
        direct.stream()
            .sorted(
                Comparator.comparingInt(
                        (SourceFile file) ->
                            degrees.getOrDefault(file.path(), new int[] {0, 0})[0])
                    .reversed()
                    .thenComparing(SourceFile::path))
            .toList();

    int overflow = Math.max(0, rankedLeaves.size() - MAX_FILES_PER_BRANCH);
    for (SourceFile file :
        rankedLeaves.subList(0, Math.min(MAX_FILES_PER_BRANCH, rankedLeaves.size()))) {
      int[] deg = degrees.getOrDefault(file.path(), new int[] {0, 0});
      leafFiles.add(
          new TreeFileDto(
              file.path(),
              deg[0],
              firstCommitByPath.getOrDefault(file.path(), 0),
              touchesByPath.getOrDefault(file.path(), List.of())));
    }

    return new TreeBranchDto(
        directory,
        depth,
        churn,
        rankedLeaves.size(),
        firstCommit,
        List.copyOf(leafFiles),
        overflow,
        List.copyOf(subBranches));
  }

  private static Map<String, Integer> firstCommitIndices(
      List<SourceFile> files, List<CommitRecord> commits) {
    Map<String, Integer> first = new HashMap<>();
    Set<String> paths = new HashSet<>();
    for (SourceFile file : files) {
      paths.add(file.path());
    }
    for (int i = 0; i < commits.size(); i++) {
      for (String changed : commits.get(i).filesChanged()) {
        if (paths.contains(changed) && !first.containsKey(changed)) {
          first.put(changed, i);
        }
      }
    }
    for (SourceFile file : files) {
      first.putIfAbsent(file.path(), 0);
    }
    return first;
  }

  private static Map<String, List<Integer>> commitTouches(
      List<SourceFile> files, List<CommitRecord> commits) {
    Map<String, List<Integer>> touches = new HashMap<>();
    Set<String> paths = new HashSet<>();
    for (SourceFile file : files) {
      paths.add(file.path());
      touches.put(file.path(), new ArrayList<>());
    }
    for (int i = 0; i < commits.size(); i++) {
      for (String changed : commits.get(i).filesChanged()) {
        List<Integer> list = touches.get(changed);
        if (list != null) {
          list.add(i);
        }
      }
    }
    Map<String, List<Integer>> immutable = new HashMap<>();
    touches.forEach((path, indices) -> immutable.put(path, List.copyOf(indices)));
    return immutable;
  }

  private static Map<String, Integer> fileChurn(
      List<SourceFile> files, List<CommitRecord> commits) {
    Map<String, Integer> churn = new HashMap<>();
    for (SourceFile file : files) {
      churn.put(file.path(), Math.max(file.churn(), 0));
    }
    // Prefer commit-derived churn when available.
    Map<String, Integer> fromCommits = new HashMap<>();
    for (CommitRecord commit : commits) {
      int delta = commit.linesAdded() + commit.linesDeleted();
      if (delta <= 0 || commit.filesChanged().isEmpty()) {
        continue;
      }
      int share = Math.max(1, delta / commit.filesChanged().size());
      for (String path : commit.filesChanged()) {
        fromCommits.merge(path, share, Integer::sum);
      }
    }
    fromCommits.forEach(churn::put);
    return churn;
  }

  private static Map<String, Double> languageCoverage(
      List<SourceFile> files, int unresolvedImportCount) {
    Map<String, Integer> counts = new HashMap<>();
    int total = Math.max(files.size(), 1);
    for (SourceFile file : files) {
      String lang = file.language() == null ? "other" : file.language().toLowerCase(Locale.ROOT);
      if (lang.equals("py")) {
        lang = "python";
      } else if (lang.equals("js") || lang.equals("ts")) {
        lang = "javascript";
      } else if (!lang.equals("java")) {
        lang = "other";
      }
      counts.merge(lang, 1, Integer::sum);
    }
    double unresolved =
        Math.min(1.0, unresolvedImportCount / (double) Math.max(total * 4, 1));
    Map<String, Double> coverage = new LinkedHashMap<>();
    coverage.put("python", counts.getOrDefault("python", 0) / (double) total);
    coverage.put("javascript", counts.getOrDefault("javascript", 0) / (double) total);
    coverage.put("java", counts.getOrDefault("java", 0) / (double) total);
    coverage.put("unresolved", unresolved);
    return coverage;
  }

  /** Longest-path depth; A→B means A imports B. Roots (in-degree 0) = depth 0. */
  private static Map<String, Integer> computeDependencyDepth(
      List<SourceFile> files, List<DependencyEdge> edges) {
    Map<String, List<String>> forward = new HashMap<>();
    Map<String, Integer> inDegree = new HashMap<>();
    for (SourceFile file : files) {
      forward.put(file.path(), new ArrayList<>());
      inDegree.put(file.path(), 0);
    }
    Set<String> seen = new HashSet<>();
    for (DependencyEdge edge : edges) {
      if (!forward.containsKey(edge.fromPath()) || !forward.containsKey(edge.toPath())) {
        continue;
      }
      if (edge.fromPath().equals(edge.toPath())) {
        continue;
      }
      String key = edge.fromPath() + "\0" + edge.toPath();
      if (!seen.add(key)) {
        continue;
      }
      forward.get(edge.fromPath()).add(edge.toPath());
      inDegree.merge(edge.toPath(), 1, Integer::sum);
    }

    Map<String, Integer> depth = new HashMap<>();
    ArrayDeque<String> queue = new ArrayDeque<>();
    for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
      if (entry.getValue() == 0) {
        depth.put(entry.getKey(), 0);
        queue.add(entry.getKey());
      }
    }
    Map<String, Integer> remaining = new HashMap<>(inDegree);
    while (!queue.isEmpty()) {
      String node = queue.removeFirst();
      int base = depth.getOrDefault(node, 0);
      for (String next : forward.getOrDefault(node, List.of())) {
        depth.merge(next, base + 1, Math::max);
        Integer left = remaining.merge(next, -1, Integer::sum);
        if (left != null && left == 0) {
          queue.add(next);
        }
      }
    }
    for (SourceFile file : files) {
      depth.putIfAbsent(file.path(), 0);
    }
    return depth;
  }
}
