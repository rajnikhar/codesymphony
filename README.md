# CodeSymphony

Paste a public GitHub URL → force-directed **file import** graph → scrub git history → nodes glow/pulse on commits.

**v1 languages:** JavaScript/TypeScript, Python, Java  
**v1 graph:** file-level imports (not call graphs)

## Layout

```
backend/          # Spring Boot core API (Java 17) + parser sidecar
  src/            # application, services, controllers
  parser/         # FastAPI + tree-sitter
client/           # React + Vite story UI
```

## Quick start (backend + client)

```bash
# Terminal 1 — parser
cd backend/parser && source .venv/bin/activate
uvicorn main:app --reload --port 8001

# Terminal 2 — Spring Boot
cd backend
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./mvnw spring-boot:run

# Terminal 3 — React client
cd client && npm install && npm run dev
```

Open `http://localhost:5173`, paste a GitHub URL, Visualize, scrub the timeline.

## Free hosting (Render + Cloudflare)

See **[DEPLOY.md](./DEPLOY.md)** — Dockerfile is built **on Render** (no Docker needed on your laptop).
