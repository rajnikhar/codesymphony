from __future__ import annotations

from pathlib import Path


_JS_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
_PYTHON_EXTENSIONS = (".py",)


def build_path_index(repository_root: Path, files: list[Path]) -> dict[str, str]:
    """Map lowercase relative path -> canonical relative path with forward slashes."""
    index: dict[str, str] = {}
    for file_path in files:
        relative = _relative(repository_root, file_path)
        index[relative.lower()] = relative
    return index


def resolve_javascript_import(
    repository_root: Path,
    importer_relative_path: str,
    import_specifier: str,
    path_index: dict[str, str],
) -> str | None:
    if not import_specifier.startswith("."):
        return None

    importer_dir = (repository_root / importer_relative_path).parent
    raw_target = (importer_dir / import_specifier).resolve()
    try:
        raw_target.relative_to(repository_root.resolve())
    except ValueError:
        return None

    candidates: list[Path] = []
    if raw_target.suffix:
        candidates.append(raw_target)
    else:
        for extension in _JS_EXTENSIONS:
            candidates.append(Path(str(raw_target) + extension))
        for extension in _JS_EXTENSIONS:
            candidates.append(raw_target / f"index{extension}")

    return _first_indexed_candidate(repository_root, candidates, path_index)


def resolve_python_import(
    repository_root: Path,
    importer_relative_path: str,
    module_name: str,
    is_relative: bool,
    relative_level: int,
    path_index: dict[str, str],
) -> str | None:
    if is_relative:
        base = (repository_root / importer_relative_path).parent
        for _ in range(max(relative_level - 1, 0)):
            base = base.parent
        if module_name:
            base = base / Path(*module_name.split("."))
        candidates = [
            base.with_suffix(".py"),
            base / "__init__.py",
        ]
        if base.suffix == ".py":
            candidates.insert(0, base)
        return _first_indexed_candidate(repository_root, candidates, path_index)

    module_path = Path(*module_name.split("."))
    candidates = [
        repository_root / module_path.with_suffix(".py"),
        repository_root / module_path / "__init__.py",
        repository_root / "src" / module_path.with_suffix(".py"),
        repository_root / "src" / module_path / "__init__.py",
    ]
    return _first_indexed_candidate(repository_root, candidates, path_index)


def resolve_java_import(
    repository_root: Path,
    import_name: str,
    path_index: dict[str, str],
) -> str | None:
    if import_name.endswith(".*"):
        return None
    relative_java = Path(*import_name.split(".")).with_suffix(".java")
    suffix = str(relative_java).replace("\\", "/").lower()
    for indexed_path, canonical in path_index.items():
        if indexed_path.endswith(suffix) or indexed_path.endswith("/" + suffix):
            return canonical
    # Also try under common roots without full scan match
    for prefix in ("src/main/java", "src/test/java", "src"):
        candidate = repository_root / prefix / relative_java
        found = _first_indexed_candidate(repository_root, [candidate], path_index)
        if found:
            return found
    return None


def _first_indexed_candidate(
    repository_root: Path,
    candidates: list[Path],
    path_index: dict[str, str],
) -> str | None:
    root = repository_root.resolve()
    for candidate in candidates:
        try:
            relative = candidate.resolve().relative_to(root)
        except ValueError:
            continue
        key = str(relative).replace("\\", "/").lower()
        if key in path_index:
            return path_index[key]
    return None


def _relative(repository_root: Path, file_path: Path) -> str:
    return str(file_path.relative_to(repository_root)).replace("\\", "/")
