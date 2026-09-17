# CodeSymphony Parser

Stateless FastAPI service: walk repo → extract imports (tree-sitter, week 1) → JSON.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness |
| POST | `/parse` | `{ "repo_path": "/abs/path/to/clone" }` |

v1 languages: JS/TS, Python, Java. Cap: 800 files.
