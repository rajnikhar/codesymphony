from __future__ import annotations

from pathlib import Path

from app.config import HISTORY_ONLY_MIN_EDGE_COUNT, HISTORY_ONLY_MIN_PARSEABLE_RATIO
from app.extractors.common import ExtractedImport
from app.extractors.java_lang import extract_java_imports
from app.extractors.javascript import extract_javascript_imports
from app.extractors.python_lang import extract_python_imports
from app.models import ImportEdge, ParseResponse, ParseStats, ParsedFile
from app.resolve import (
    build_path_index,
    resolve_java_import,
    resolve_javascript_import,
    resolve_python_import,
)
from app.walker import collect_allowlisted_files, language_for_suffix


def parse_repository(repository_root: Path) -> ParseResponse:
    if not repository_root.is_dir():
        return _empty_history_only()

    files, skipped_unsupported = collect_allowlisted_files(repository_root)
    path_index = build_path_index(repository_root, files)

    parsed_files: list[ParsedFile] = []
    edges: list[ImportEdge] = []
    unresolved = 0
    edge_keys: set[tuple[str, str]] = set()
    total_files_seen = len(files) + skipped_unsupported

    for file_path in files:
        relative = str(file_path.relative_to(repository_root)).replace("\\", "/")
        language = language_for_suffix(file_path.suffix)
        if language is None:
            continue
        parsed_files.append(ParsedFile(path=relative, language=language))

        source = file_path.read_bytes()
        try:
            extracted = _extract_imports(file_path, language, source)
        except Exception:
            # Keep ingest alive if one file's grammar/query fails
            continue
        for item in extracted:
            target = _resolve_import(
                repository_root, relative, language, item, path_index
            )
            if target is None:
                unresolved += 1
                continue
            key = (relative, target)
            if key in edge_keys or relative == target:
                continue
            edge_keys.add(key)
            edges.append(ImportEdge(from_path=relative, to_path=target, kind="import"))

    return ParseResponse(
        mode_hint=_decide_mode_hint(len(parsed_files), total_files_seen, len(edges)),
        files=parsed_files,
        edges=edges,
        stats=ParseStats(
            parsed=len(parsed_files),
            skipped_unsupported=skipped_unsupported,
            unresolved_imports=unresolved,
        ),
    )


def _extract_imports(
    file_path: Path, language: str, source: bytes
) -> list[ExtractedImport]:
    if language in {"js", "ts"}:
        return extract_javascript_imports(source, file_path.suffix.lower())
    if language == "py":
        return extract_python_imports(source)
    if language == "java":
        return extract_java_imports(source)
    return []


def _resolve_import(
    repository_root: Path,
    importer_relative_path: str,
    language: str,
    item: ExtractedImport,
    path_index: dict[str, str],
) -> str | None:
    if language in {"js", "ts"}:
        return resolve_javascript_import(
            repository_root, importer_relative_path, item.specifier, path_index
        )
    if language == "py":
        return resolve_python_import(
            repository_root,
            importer_relative_path,
            item.specifier,
            item.is_relative,
            item.relative_level,
            path_index,
        )
    if language == "java":
        return resolve_java_import(repository_root, item.specifier, path_index)
    return None


def _decide_mode_hint(
    parseable_count: int, total_files_seen: int, edge_count: int
) -> str:
    if parseable_count == 0 or edge_count < HISTORY_ONLY_MIN_EDGE_COUNT:
        return "history_only_candidate"
    if total_files_seen > 0 and (
        parseable_count / total_files_seen < HISTORY_ONLY_MIN_PARSEABLE_RATIO
    ):
        return "history_only_candidate"
    return "full"


def _empty_history_only() -> ParseResponse:
    return ParseResponse(
        mode_hint="history_only_candidate",
        files=[],
        edges=[],
        stats=ParseStats(parsed=0, skipped_unsupported=0, unresolved_imports=0),
    )
