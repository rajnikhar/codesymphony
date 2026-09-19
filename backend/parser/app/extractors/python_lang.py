from __future__ import annotations

import tree_sitter_python as ts_python
from tree_sitter import Language, Node

from app.extractors.common import (
    ExtractedImport,
    create_parser,
    node_text,
)

_LANGUAGE = Language(ts_python.language())


def extract_python_imports(source: bytes) -> list[ExtractedImport]:
    """
    Extract raw import module identifiers before resolution.

    Emits one specifier per candidate module path, e.g.:
      from a.b import c  →  a.b.c, a.b
      from . import x    →  x (relative_level=1)
      from ..pkg import y → pkg.y, pkg (relative_level=2)
    """
    parser = create_parser(_LANGUAGE)
    tree = parser.parse(source)
    imports: list[ExtractedImport] = []
    seen: set[tuple[str, bool, int]] = set()

    for node in _walk(tree.root_node):
        if node.type == "import_statement":
            for item in _from_import_statement(source, node):
                _append_unique(imports, seen, item)
        elif node.type == "import_from_statement":
            for item in _from_import_from_statement(source, node):
                _append_unique(imports, seen, item)

    return imports


def _from_import_statement(source: bytes, node: Node) -> list[ExtractedImport]:
    results: list[ExtractedImport] = []
    for child in node.children:
        if child.type == "dotted_name":
            results.append(
                ExtractedImport(specifier=node_text(source, child), is_relative=False)
            )
        elif child.type == "aliased_import":
            name = child.child_by_field_name("name")
            if name is not None:
                results.append(
                    ExtractedImport(
                        specifier=node_text(source, name), is_relative=False
                    )
                )
    return results


def _from_import_from_statement(
    source: bytes, node: Node
) -> list[ExtractedImport]:
    module_node = node.child_by_field_name("module_name")
    is_relative = False
    relative_level = 0
    module = ""

    if module_node is not None:
        if module_node.type == "relative_import":
            is_relative = True
            relative_level, module = _parse_relative_import(source, module_node)
        elif module_node.type == "dotted_name":
            module = node_text(source, module_node)

    names = _imported_names(source, node)
    results: list[ExtractedImport] = []

    if names:
        for name in names:
            if name == "*":
                if module or is_relative:
                    results.append(
                        ExtractedImport(
                            specifier=module,
                            is_relative=is_relative,
                            relative_level=relative_level,
                        )
                    )
                continue
            combined = f"{module}.{name}" if module else name
            results.append(
                ExtractedImport(
                    specifier=combined,
                    is_relative=is_relative,
                    relative_level=relative_level,
                )
            )
        if module:
            results.append(
                ExtractedImport(
                    specifier=module,
                    is_relative=is_relative,
                    relative_level=relative_level,
                )
            )
    elif module or is_relative:
        results.append(
            ExtractedImport(
                specifier=module,
                is_relative=is_relative,
                relative_level=relative_level,
            )
        )

    return results


def _parse_relative_import(source: bytes, node: Node) -> tuple[int, str]:
    """Return (leading_dot_count, remainder_module) — dots inside module don't count."""
    level = 0
    remainder = ""
    for child in node.children:
        if child.type == "import_prefix":
            level = node_text(source, child).count(".")
        elif child.type == "dotted_name":
            remainder = node_text(source, child)
    if level == 0:
        # Fallback if grammar shape differs
        text = node_text(source, node)
        level = len(text) - len(text.lstrip("."))
        remainder = text.lstrip(".")
    return level, remainder


def _imported_names(source: bytes, node: Node) -> list[str]:
    names: list[str] = []
    for i in range(node.child_count):
        if node.field_name_for_child(i) != "name":
            continue
        child = node.child(i)
        if child is None:
            continue
        if child.type == "dotted_name":
            names.append(node_text(source, child))
        elif child.type == "aliased_import":
            name = child.child_by_field_name("name")
            if name is not None:
                names.append(node_text(source, name))
        elif child.type == "wildcard_import":
            names.append("*")
    return names


def _append_unique(
    imports: list[ExtractedImport],
    seen: set[tuple[str, bool, int]],
    item: ExtractedImport,
) -> None:
    key = (item.specifier, item.is_relative, item.relative_level)
    if key in seen:
        return
    seen.add(key)
    imports.append(item)


def _walk(node: Node):
    yield node
    for child in node.children:
        yield from _walk(child)
