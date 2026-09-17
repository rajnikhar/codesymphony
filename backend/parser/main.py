from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="CodeSymphony Parser", version="0.1.0")

MAX_INGESTED_FILES = 800
ALLOWED_SUFFIXES = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".py",
    ".java",
}


class ParseRequest(BaseModel):
    repo_path: str = Field(..., description="Absolute path to a cloned repo root")


class FileInfo(BaseModel):
    path: str
    language: str


class Edge(BaseModel):
    """Serialized as from/to to match architecture.md."""

    source: str
    target: str
    kind: str = "import"

    def model_dump_api(self) -> dict:
        return {"from": self.source, "to": self.target, "kind": self.kind}


class ParseStats(BaseModel):
    parsed: int
    skipped_unsupported: int
    unresolved_imports: int


class ParseResponse(BaseModel):
    mode_hint: Literal["full", "history_only_candidate"]
    files: list[FileInfo]
    edges: list[Edge]
    stats: ParseStats


def language_for(path: Path) -> str | None:
    suffix = path.suffix.lower()
    if suffix in {".js", ".jsx", ".mjs", ".cjs"}:
        return "js"
    if suffix in {".ts", ".tsx"}:
        return "ts"
    if suffix == ".py":
        return "py"
    if suffix == ".java":
        return "java"
    return None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "codesymphony-parser"}


@app.post("/parse", response_model=ParseResponse)
def parse_repo(body: ParseRequest) -> ParseResponse:
    """
    Skeleton: walks allowlisted files and returns empty edges.
    Week 1: plug in tree-sitter import extraction.
    """
    root = Path(body.repo_path)
    if not root.is_dir():
        return ParseResponse(
            mode_hint="history_only_candidate",
            files=[],
            edges=[],
            stats=ParseStats(parsed=0, skipped_unsupported=0, unresolved_imports=0),
        )

    files: list[FileInfo] = []
    skipped = 0
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in {"node_modules", "target", "build", ".git", "dist", "vendor"} for part in path.parts):
            continue
        lang = language_for(path)
        if lang is None:
            skipped += 1
            continue
        if len(files) >= MAX_INGESTED_FILES:
            break
        rel = str(path.relative_to(root)).replace("\\", "/")
        files.append(FileInfo(path=rel, language=lang))

    mode: Literal["full", "history_only_candidate"] = (
        "full" if len(files) > 0 else "history_only_candidate"
    )
    return ParseResponse(
        mode_hint=mode,
        files=files,
        edges=[],
        stats=ParseStats(
            parsed=len(files),
            skipped_unsupported=skipped,
            unresolved_imports=0,
        ),
    )
