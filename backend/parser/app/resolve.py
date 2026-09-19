from __future__ import annotations

from pathlib import Path

from app.file_index import FileIndex, lookup_module, lookup_path


_JS_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")


def resolve_javascript_import(
    repository_root: Path,
    importer_relative_path: str,
    import_specifier: str,
    index: FileIndex,
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

    return _first_indexed_candidate(repository_root, candidates, index)


def resolve_python_import(
    repository_root: Path,
    importer_relative_path: str,
    module_name: str,
    is_relative: bool,
    relative_level: int,
    index: FileIndex,
) -> str | None:
    """
    Resolve a Python module name to an indexed file path.

    Absolute: look up dotted module in the file index (every path suffix is
    registered, so nested layouts like backend/parser/app resolve).
    Relative: walk up from the importer by relative_level, then append module.
    """
    if is_relative:
        return _resolve_python_relative(
            repository_root,
            importer_relative_path,
            module_name,
            relative_level,
            index,
        )

    if not module_name:
        return None

    # Try full module, then parent packages (from pkg.sub import name may be a symbol).
    parts = module_name.split(".")
    for end in range(len(parts), 0, -1):
        candidate_module = ".".join(parts[:end])
        found = lookup_module(index, candidate_module, importer_relative_path)
        if found:
            return found

    # Filesystem fallback for unusual layouts not covered by suffix index.
    module_path = Path(*parts)
    fallback = [
        repository_root / module_path.with_suffix(".py"),
        repository_root / module_path / "__init__.py",
        repository_root / "src" / module_path.with_suffix(".py"),
        repository_root / "src" / module_path / "__init__.py",
    ]
    return _first_indexed_candidate(repository_root, fallback, index)


def resolve_java_import(
    repository_root: Path,
    import_name: str,
    index: FileIndex,
) -> str | None:
    if import_name.endswith(".*"):
        # Wildcard: coarsen to first file in package (documented later in Step 6).
        package = import_name[: -len(".*")]
        members = index.by_java_package.get(package) or []
        return members[0] if members else None

    if import_name in index.by_java_type:
        return index.by_java_type[import_name]

    relative_java = Path(*import_name.split(".")).with_suffix(".java")
    suffix = str(relative_java).replace("\\", "/").lower()
    for indexed_path, canonical in index.by_path.items():
        if indexed_path.endswith(suffix) or indexed_path.endswith("/" + suffix):
            return canonical
    for prefix in ("src/main/java", "src/test/java", "src"):
        candidate = repository_root / prefix / relative_java
        found = _first_indexed_candidate(repository_root, [candidate], index)
        if found:
            return found
    return None


def _resolve_python_relative(
    repository_root: Path,
    importer_relative_path: str,
    module_name: str,
    relative_level: int,
    index: FileIndex,
) -> str | None:
    # PEP 328: level is number of leading dots; base is importer's package.
    base = (repository_root / importer_relative_path).parent
    ups = max(relative_level - 1, 0)
    for _ in range(ups):
        base = base.parent

    module_parts = module_name.split(".") if module_name else []

    # Try full module path, then parents (from .util import helper → util.py).
    for end in range(len(module_parts), -1, -1):
        if end == 0:
            if module_parts:
                break
            target = base
            parts_used: list[str] = []
        else:
            parts_used = module_parts[:end]
            target = base / Path(*parts_used)

        candidates = [
            Path(str(target) + ".py") if target.suffix != ".py" else target,
            target.with_suffix(".py") if target.suffix != ".py" else target,
            target / "__init__.py",
        ]
        unique: list[Path] = []
        seen: set[str] = set()
        for candidate in candidates:
            key = str(candidate)
            if key in seen:
                continue
            seen.add(key)
            unique.append(candidate)

        found = _first_indexed_candidate(repository_root, unique, index)
        if found:
            return found

    if module_name:
        # Try full then parent dotted names in the module index.
        parts = module_name.split(".")
        for end in range(len(parts), 0, -1):
            found = lookup_module(
                index, ".".join(parts[:end]), importer_relative_path
            )
            if found:
                return found
    return None


def _first_indexed_candidate(
    repository_root: Path,
    candidates: list[Path],
    index: FileIndex,
) -> str | None:
    root = repository_root.resolve()
    for candidate in candidates:
        try:
            relative = candidate.resolve().relative_to(root)
        except (ValueError, OSError):
            continue
        key = str(relative).replace("\\", "/")
        found = lookup_path(index, key)
        if found:
            return found
    return None
