from __future__ import annotations

import tree_sitter_python as ts_python
from tree_sitter import Language, Node

from app.extractors.common import (
    ExtractedImport,
    create_parser,
    node_text,
    run_query,
)

_LANGUAGE = Language(ts_python.language())

_IMPORT_QUERY = """
(import_statement name: (dotted_name) @module)
(import_statement name: (aliased_import name: (dotted_name) @module))
(import_from_statement module_name: (dotted_name) @module)
(import_from_statement module_name: (relative_import) @relative)
"""


def extract_python_imports(source: bytes) -> list[ExtractedImport]:
    parser = create_parser(_LANGUAGE)
    tree = parser.parse(source)
    nodes_by_name = run_query(_LANGUAGE, _IMPORT_QUERY, tree.root_node)
    imports: list[ExtractedImport] = []
    seen: set[tuple[str, int]] = set()

    for node in nodes_by_name.get("module", []):
        module_name = node_text(source, node)
        key = (module_name, 0)
        if key in seen:
            continue
        seen.add(key)
        imports.append(ExtractedImport(specifier=module_name, is_relative=False))

    for node in nodes_by_name.get("relative", []):
        extracted = _relative_import(source, node)
        key = (extracted.specifier, extracted.relative_level)
        if key in seen:
            continue
        seen.add(key)
        imports.append(extracted)

    return imports


def _relative_import(source: bytes, node: Node) -> ExtractedImport:
    text = node_text(source, node)
    level = text.count(".")
    remainder = text.lstrip(".")
    return ExtractedImport(
        specifier=remainder,
        is_relative=True,
        relative_level=level,
    )
