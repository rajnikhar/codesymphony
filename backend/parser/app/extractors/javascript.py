from __future__ import annotations

import tree_sitter_javascript as ts_javascript
import tree_sitter_typescript as ts_typescript
from tree_sitter import Language, Node

from app.extractors.common import ExtractedImport, create_parser, node_text

_JS_LANGUAGE = Language(ts_javascript.language())
_TS_LANGUAGE = Language(ts_typescript.language_typescript())
_TSX_LANGUAGE = Language(ts_typescript.language_tsx())


def extract_javascript_imports(source: bytes, file_suffix: str) -> list[ExtractedImport]:
    language = _language_for_suffix(file_suffix)
    parser = create_parser(language)
    tree = parser.parse(source)
    imports: list[ExtractedImport] = []
    seen: set[str] = set()

    for node in _walk(tree.root_node):
        specifier = _import_specifier(source, node)
        if specifier is None or specifier in seen:
            continue
        seen.add(specifier)
        imports.append(
            ExtractedImport(
                specifier=specifier,
                is_relative=specifier.startswith("."),
            )
        )
    return imports


def _language_for_suffix(suffix: str) -> Language:
    if suffix == ".tsx":
        return _TSX_LANGUAGE
    if suffix == ".ts":
        return _TS_LANGUAGE
    return _JS_LANGUAGE


def _import_specifier(source: bytes, node: Node) -> str | None:
    if node.type in {"import_statement", "export_statement"}:
        for child in node.children:
            if child.type == "string":
                return node_text(source, child).strip("'\"")
        return None

    if node.type == "call_expression":
        function_node = node.child_by_field_name("function")
        arguments_node = node.child_by_field_name("arguments")
        if function_node is None or arguments_node is None:
            return None
        function_name = node_text(source, function_node)
        if function_name not in {"require", "import"} and function_node.type != "import":
            return None
        for child in arguments_node.children:
            if child.type == "string":
                return node_text(source, child).strip("'\"")
    return None


def _walk(node: Node):
    yield node
    for child in node.children:
        yield from _walk(child)
