from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException

from app.models import ParseRequest, ParseResponse
from app.service import parse_repository

app = FastAPI(title="CodeSymphony Parser", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "codesymphony-parser"}


@app.post("/parse", response_model=ParseResponse, response_model_by_alias=True)
def parse(body: ParseRequest) -> ParseResponse:
    repository_root = Path(body.repo_path).expanduser()
    if not repository_root.is_absolute():
        raise HTTPException(status_code=400, detail="repo_path must be an absolute path")
    if not repository_root.exists():
        raise HTTPException(status_code=400, detail="repo_path does not exist")
    return parse_repository(repository_root.resolve())
