from __future__ import annotations

from dataclasses import dataclass

from tree_sitter import Language, Node, Parser, Query, QueryCursor


@dataclass(frozen=True)
class ExtractedImport:
    specifier: str
    is_relative: bool = False
    relative_level: int = 0


def create_parser(language: Language) -> Parser:
    return Parser(language)


def node_text(source: bytes, node: Node) -> str:
    return source[node.start_byte : node.end_byte].decode("utf-8", errors="replace")


def run_query(language: Language, source_query: str, root: Node) -> dict[str, list[Node]]:
    """tree-sitter ≥0.23: Query(language, …) + QueryCursor — not language.query()."""
    query = Query(language, source_query)
    captures = QueryCursor(query).captures(root)
    if isinstance(captures, dict):
        return captures
    result: dict[str, list[Node]] = {}
    for node, name in captures:
        result.setdefault(name, []).append(node)
    return result
