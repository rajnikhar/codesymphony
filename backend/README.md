# CodeSymphony Backend (Spring Boot)

Java 17 + Spring Boot 3.3 — JGit, JGraphT, Caffeine, WebSocket.

The import parser lives beside this app at `parser/` (FastAPI + tree-sitter).

## Run

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./mvnw spring-boot:run
```

API: `http://localhost:8080`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| POST | `/api/repos` | `{ "url": "https://github.com/..." }` |
| GET | `/api/repos/{id}` | Status + mode |
| GET | `/api/repos/{id}/graph` | Nodes + edges |
| WS | `/ws` | STOMP (commit scrub — week 4) |

## Parser sidecar

```bash
cd parser
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
