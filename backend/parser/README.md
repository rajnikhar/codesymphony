# CodeSymphony Parser

Stateless FastAPI + tree-sitter import extraction (JS/TS, Python, Java).

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

| Method | Path | Body |
|--------|------|------|
| GET | `/health` | — |
| POST | `/parse` | `{ "repo_path": "/absolute/clone/path" }` |

Cap: 800 allowlisted files. Ignores `node_modules`, `target`, `build`, `.git`, etc.
