from __future__ import annotations

import tree_sitter_java as ts_java
from tree_sitter import Language, Node

from app.extractors.common import ExtractedImport, create_parser, node_text

_LANGUAGE = Language(ts_java.language())


def extract_java_imports(source: bytes) -> list[ExtractedImport]:
    parser = create_parser(_LANGUAGE)
    tree = parser.parse(source)
    imports: list[ExtractedImport] = []
    seen: set[str] = set()

    for node in _walk(tree.root_node):
        if node.type != "import_declaration":
            continue
        import_name = _java_import_name(source, node)
        if import_name is None or import_name.endswith(".*") or import_name in seen:
            continue
        seen.add(import_name)
        imports.append(ExtractedImport(specifier=import_name, is_relative=False))
    return imports


def _java_import_name(source: bytes, node: Node) -> str | None:
    text = node_text(source, node)
    cleaned = text.removeprefix("import").strip()
    cleaned = cleaned.removeprefix("static").strip().rstrip(";").strip()
    return cleaned or None


def _walk(node: Node):
    yield node
    for child in node.children:
        yield from _walk(child)
