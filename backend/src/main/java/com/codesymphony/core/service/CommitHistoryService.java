package com.codesymphony.core.service;

import com.codesymphony.core.dto.response.CommitEventMessage;
import com.codesymphony.core.dto.response.TimelineCommitDto;
import com.codesymphony.core.dto.response.TimelineResponse;
import com.codesymphony.core.exception.CommitIndexOutOfBoundsException;
import com.codesymphony.core.model.CommitRecord;
import com.codesymphony.core.model.RepositoryGraph;
import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.diff.RawTextComparator;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectReader;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.treewalk.CanonicalTreeParser;
import org.eclipse.jgit.util.io.DisabledOutputStream;
import org.springframework.stereotype.Service;

@Service
public class CommitHistoryService {

  public record FileChurn(int commitCount, int linesAdded, int linesDeleted) {
    public int totalChurn() {
      return linesAdded + linesDeleted;
    }
  }

  public record CommitHistorySnapshot(
      List<CommitRecord> commits, Map<String, FileChurn> churnByPath) {}

  public CommitHistorySnapshot loadCommitHistory(Path repositoryCloneDirectory) {
    try (Git git = Git.open(repositoryCloneDirectory.toFile())) {
      Repository repository = git.getRepository();
      List<CommitRecord> commits = new ArrayList<>();
      Map<String, MutableChurn> churnByPath = new HashMap<>();

      try (RevWalk revWalk = new RevWalk(repository);
          DiffFormatter diffFormatter = new DiffFormatter(DisabledOutputStream.INSTANCE)) {
        diffFormatter.setRepository(repository);
        diffFormatter.setDiffComparator(RawTextComparator.DEFAULT);
        diffFormatter.setDetectRenames(true);

        ObjectId head = repository.resolve("HEAD");
        if (head == null) {
          return new CommitHistorySnapshot(List.of(), Map.of());
        }
        revWalk.markStart(revWalk.parseCommit(head));

        for (RevCommit commit : revWalk) {
          List<DiffEntry> diffs = listCommitDiffs(repository, diffFormatter, commit);
          List<String> changedPaths = new ArrayList<>();
          int linesAdded = 0;
          int linesDeleted = 0;

          for (DiffEntry diff : diffs) {
            String path = pathForDiff(diff);
            if (path == null || path.isBlank()) {
              continue;
            }
            changedPaths.add(path);
            int[] editCounts = countEdits(diffFormatter, diff);
            linesAdded += editCounts[0];
            linesDeleted += editCounts[1];
            MutableChurn churn = churnByPath.computeIfAbsent(path, ignored -> new MutableChurn());
            churn.commitCount += 1;
            churn.linesAdded += editCounts[0];
            churn.linesDeleted += editCounts[1];
          }

          commits.add(
              new CommitRecord(
                  commit.getName(),
                  Instant.ofEpochSecond(commit.getCommitTime()).toString(),
                  List.copyOf(changedPaths),
                  linesAdded,
                  linesDeleted));
        }
      }

      // Oldest-first for timeline scrubbing
      List<CommitRecord> chronological = new ArrayList<>(commits);
      java.util.Collections.reverse(chronological);

      Map<String, FileChurn> immutableChurn = new HashMap<>();
      churnByPath.forEach(
          (path, mutable) ->
              immutableChurn.put(
                  path,
                  new FileChurn(mutable.commitCount, mutable.linesAdded, mutable.linesDeleted)));
      return new CommitHistorySnapshot(List.copyOf(chronological), Map.copyOf(immutableChurn));
    } catch (IOException exception) {
      throw new IllegalStateException(
          "Failed to read commit history from " + repositoryCloneDirectory, exception);
    }
  }

  private static List<DiffEntry> listCommitDiffs(
      Repository repository, DiffFormatter diffFormatter, RevCommit commit) throws IOException {
    if (commit.getParentCount() == 0) {
      try (ObjectReader reader = repository.newObjectReader()) {
        CanonicalTreeParser newTree = new CanonicalTreeParser();
        newTree.reset(reader, commit.getTree());
        CanonicalTreeParser emptyTree = new CanonicalTreeParser();
        return diffFormatter.scan(emptyTree, newTree);
      }
    }
    RevCommit parent = commit.getParent(0);
    try (RevWalk walk = new RevWalk(repository)) {
      walk.parseCommit(parent);
    }
    return diffFormatter.scan(commit.getParent(0).getTree(), commit.getTree());
  }

  private static String pathForDiff(DiffEntry diff) {
    if (diff.getChangeType() == DiffEntry.ChangeType.DELETE) {
      return diff.getOldPath();
    }
    return diff.getNewPath();
  }

  private static int[] countEdits(DiffFormatter diffFormatter, DiffEntry diff) throws IOException {
    var edits = diffFormatter.toFileHeader(diff).toEditList();
    int added = 0;
    int deleted = 0;
    for (var edit : edits) {
      added += edit.getLengthB();
      deleted += edit.getLengthA();
    }
    return new int[] {added, deleted};
  }

  public TimelineResponse buildTimelineResponse(RepositoryGraph graph) {
    List<TimelineCommitDto> commits = new ArrayList<>();
    List<CommitRecord> records = graph.commits();
    for (int index = 0; index < records.size(); index++) {
      CommitRecord record = records.get(index);
      commits.add(
          new TimelineCommitDto(
              index,
              record.commitHash(),
              record.timestamp(),
              record.filesChanged(),
              record.linesAdded(),
              record.linesDeleted()));
    }
    return new TimelineResponse(
        graph.repositoryId(), graph.mode().name(), commits.size(), List.copyOf(commits));
  }

  public CommitEventMessage buildCommitEvent(RepositoryGraph graph, int index) {
    List<CommitRecord> records = graph.commits();
    if (index < 0 || index >= records.size()) {
      throw new CommitIndexOutOfBoundsException(index, records.size());
    }
    CommitRecord record = records.get(index);
    return new CommitEventMessage(
        CommitEventMessage.TYPE,
        graph.repositoryId(),
        index,
        record.commitHash(),
        record.timestamp(),
        record.filesChanged(),
        record.linesAdded(),
        record.linesDeleted());
  }

  private static final class MutableChurn {
    private int commitCount;
    private int linesAdded;
    private int linesDeleted;
  }
}
