# CodeSymphony

Paste a public GitHub URL → force-directed **file import** graph → scrub git history → nodes glow/pulse on commits.

**v1 languages:** JavaScript/TypeScript, Python, Java  
**v1 graph:** file-level imports (not call graphs)  
**Unsupported langs (e.g. C++):** history-only mode (timeline pulses, no import edges)

## Layout

```
backend/          # Spring Boot core API (Java 17)
  src/            # JGit, JGraphT, WebSocket stubs
  parser/         # FastAPI + tree-sitter sidecar
client/           # React + Vite frontend
docs/             # architecture + deployment
```

## Quick start

### 1. Parser (port 8001)

```bash
cd backend/parser
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

### 2. Backend (port 8080)

```bash
cd backend
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./mvnw spring-boot:run
```

### 3. Client (port 5173)

```bash
cd client
npm install
npm run dev
```

## Docs

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Later](LATER.md)
- [Demo repos](DEMO_REPOS.md)

## Done criteria (v1)

> Paste a public GitHub URL → see a force-directed file import graph (directories by default) → drag a timeline → nodes glow/pulse in commit order over WebSocket-streamed history.
