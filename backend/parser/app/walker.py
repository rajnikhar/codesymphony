from __future__ import annotations

from pathlib import Path

from app.config import IGNORED_DIRECTORY_NAMES, MAX_INGESTED_FILES


def language_for_suffix(suffix: str) -> str | None:
    normalized = suffix.lower()
    if normalized in {".js", ".jsx", ".mjs", ".cjs"}:
        return "js"
    if normalized in {".ts", ".tsx"}:
        return "ts"
    if normalized == ".py":
        return "py"
    if normalized == ".java":
        return "java"
    return None


def is_ignored_path(path: Path) -> bool:
    return any(part in IGNORED_DIRECTORY_NAMES for part in path.parts)


def collect_allowlisted_files(repository_root: Path) -> tuple[list[Path], int]:
    """Return (allowlisted files capped at MAX_INGESTED_FILES, skipped unsupported count)."""
    allowlisted: list[Path] = []
    skipped_unsupported = 0

    for path in sorted(repository_root.rglob("*")):
        if not path.is_file() or is_ignored_path(path.relative_to(repository_root)):
            continue
        language = language_for_suffix(path.suffix)
        if language is None:
            skipped_unsupported += 1
            continue
        if len(allowlisted) >= MAX_INGESTED_FILES:
            continue
        allowlisted.append(path)

    return allowlisted, skipped_unsupported
