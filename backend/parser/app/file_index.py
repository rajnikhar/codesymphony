from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class FileIndex:
    """Indexed allowlisted files for import resolution."""

    by_path: dict[str, str] = field(default_factory=dict)
    """lowercase relative path → canonical relative path"""

    by_module: dict[str, list[str]] = field(default_factory=dict)
    """dotted module name → candidate relative paths (Python / JS path modules)"""

    by_java_type: dict[str, str] = field(default_factory=dict)
    """fully-qualified class/type name → .java path"""

    by_java_package: dict[str, list[str]] = field(default_factory=dict)
    """package name → .java paths in that package"""


def build_file_index(repository_root: Path, files: list[Path]) -> FileIndex:
    index = FileIndex()
    for file_path in files:
        relative = _relative(repository_root, file_path)
        index.by_path[relative.lower()] = relative
        suffix = file_path.suffix.lower()
        if suffix == ".py":
            _register_python_modules(relative, index)
        elif suffix == ".java":
            _register_java_file(repository_root, file_path, relative, index)
    return index


def build_path_index(repository_root: Path, files: list[Path]) -> dict[str, str]:
    """Backward-compatible path map — prefer build_file_index for new code."""
    return build_file_index(repository_root, files).by_path


def lookup_module(
    index: FileIndex, module_name: str, importer_relative_path: str
) -> str | None:
    if not module_name:
        return None
    candidates = index.by_module.get(module_name)
    if not candidates:
        return None
    if len(candidates) == 1:
        return candidates[0]
    importer_parts = importer_relative_path.split("/")
    best = max(
        candidates,
        key=lambda path: _shared_prefix_len(path.split("/"), importer_parts),
    )
    return best


def lookup_path(index: FileIndex, relative_path: str) -> str | None:
    return index.by_path.get(relative_path.replace("\\", "/").lower())


def _register_python_modules(relative: str, index: FileIndex) -> None:
    if not relative.endswith(".py"):
        return
    without_suffix = relative[: -len(".py")]
    parts = without_suffix.split("/")
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    if not parts:
        return
    for start in range(len(parts)):
        module = ".".join(parts[start:])
        paths = index.by_module.setdefault(module, [])
        if relative not in paths:
            paths.append(relative)


def _register_java_file(
    repository_root: Path,
    file_path: Path,
    relative: str,
    index: FileIndex,
) -> None:
    package = _read_java_package(file_path)
    stem = file_path.stem
    if package:
        fqcn = f"{package}.{stem}"
        index.by_java_type[fqcn] = relative
        index.by_java_package.setdefault(package, []).append(relative)
        # Also index path-derived FQCN under src/main/java etc.
    path_fqcn = _java_fqcn_from_path(relative)
    if path_fqcn and path_fqcn not in index.by_java_type:
        index.by_java_type[path_fqcn] = relative
        pkg = path_fqcn.rsplit(".", 1)[0] if "." in path_fqcn else ""
        if pkg:
            paths = index.by_java_package.setdefault(pkg, [])
            if relative not in paths:
                paths.append(relative)


def _read_java_package(file_path: Path) -> str | None:
    try:
        # Package declaration is near the top; avoid reading huge files fully.
        text = file_path.read_text(encoding="utf-8", errors="replace")[:4000]
    except OSError:
        return None
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("package ") and stripped.endswith(";"):
            return stripped[len("package ") : -1].strip()
        if stripped.startswith("import ") or stripped.startswith("public "):
            break
    return None


def _java_fqcn_from_path(relative: str) -> str | None:
    if not relative.endswith(".java"):
        return None
    parts = relative[: -len(".java")].split("/")
    for marker in ("src/main/java", "src/test/java", "src"):
        marker_parts = marker.split("/")
        if parts[: len(marker_parts)] == marker_parts:
            type_parts = parts[len(marker_parts) :]
            return ".".join(type_parts) if type_parts else None
    return ".".join(parts)


def _shared_prefix_len(a: list[str], b: list[str]) -> int:
    count = 0
    for left, right in zip(a, b):
        if left != right:
            break
        count += 1
    return count


def _relative(repository_root: Path, file_path: Path) -> str:
    return str(file_path.relative_to(repository_root)).replace("\\", "/")
