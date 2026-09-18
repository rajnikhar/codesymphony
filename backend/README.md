# CodeSymphony Backend (Spring Boot)

Java 17 + Spring Boot 3.3 — layered per `guidelines.md`.

## Run

Terminal 1 — parser:

```bash
cd parser
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Terminal 2 — core:

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./mvnw spring-boot:run
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| POST | `/api/repos` | `{ "url": "https://github.com/org/repo" }` → ingest |
| GET | `/api/repos/{id}` | Status + mode |
| GET | `/api/repos/{id}/graph` | Directory/file graph (≤150 nodes) |
| GET | `/api/repos/{id}/graph/expand?path=` | Expand directory to top files |
| GET | `/api/repos/{id}/timeline` | Ordered commits for scrubber |
| GET | `/api/repos/{id}/timeline/commits/{index}` | Single `commit_event` (REST helper) |
| GET | `/api/repos/{id}/files/neighborhood?path=` | Related files + focus subgraph |
| POST | `/api/repos/{id}/files/explain` | `{ "path": "…" }` → plain-English explanation |

## WebSocket (phase 2)

- Connect: `ws://localhost:8080/ws` (STOMP) or SockJS at `/ws-sockjs`
- Subscribe: `/topic/repos/{repositoryId}/commits`
- Send scrub: `/app/repos/{repositoryId}/scrub` with `{ "index": 0 }`
- Errors: `/user/queue/errors`

## Structure

See `guidelines.md`. Package layout under `com.codesymphony.core`.
