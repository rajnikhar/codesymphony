# CodeSymphony Client

React + Vite + TypeScript + D3 force graph.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Backend must be on `http://localhost:8080` (override with `VITE_API_BASE`).

## Features (v1 UI)

- Paste GitHub URL → ingest via Spring Boot
- Force-directed import graph
- **Click a file** → related-files panel (depends on / used by)
- **“Want to understand something?”** → explanation of role + neighbors
- Timeline scrubber pulses nodes touched by each commit
- Double-click directory nodes to expand
