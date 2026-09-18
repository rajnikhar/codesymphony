from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ParseRequest(BaseModel):
    repo_path: str = Field(..., description="Absolute path to a cloned repository root")


class ParsedFile(BaseModel):
    path: str
    language: str


class ImportEdge(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    from_path: str = Field(..., alias="from")
    to_path: str = Field(..., alias="to")
    kind: str = "import"


class ParseStats(BaseModel):
    parsed: int
    skipped_unsupported: int
    unresolved_imports: int


class ParseResponse(BaseModel):
    mode_hint: Literal["full", "history_only_candidate"]
    files: list[ParsedFile]
    edges: list[ImportEdge]
    stats: ParseStats
