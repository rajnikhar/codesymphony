# CodeSymphony — Architecture (v1)

## One-sentence done criteria

> Paste a public GitHub URL → see a force-directed **file import** graph (directories by default, expand to files) → drag a timeline slider → nodes glow/pulse in commit order over WebSocket-streamed history.

If a feature does not serve that sentence, it goes in `LATER.md`, not in v1.

**v1 tag:** commit at end of week 4 = `v1-demo-ready`. Weeks 5–6 are optional additive branches.

---

## Product modes

| Mode | When | Graph edges | Timeline pulses |
|------|------|-------------|-----------------|
| **Full (import graph)** | Repo has enough parseable files in supported languages | Yes — file-level imports | Yes |
| **History-only** | Repo is mostly unsupported languages (e.g. C/C++) or import extraction yields almost no edges | No (or directory co-change only) | Yes — files/dirs still glow on commits |

### History-only mode (v1)

- Clone + JGit history still work.
- Nodes = directories (default) and/or files; **no import edges**.
- Scrubbing commits still ripples changed paths.
- UI banner: *“History-only mode — this repo has few/no supported imports (JS/TS, Python, Java). Showing commit activity without a dependency graph.”*
- Optional threshold: if parseable files < 5% of source files **or** edge count < N, auto-switch to history-only instead of a sparse useless graph.

Unsupported languages (C++, Go, Rust, etc.) do **not** crash the app; they land in history-only (or get a clear reject if you prefer zero nodes — prefer history-only for demos).

---

## Hard locks (do not revisit mid-build)

| Lock | Value |
|------|--------|
| Max files ingested | `800` |
| Max nodes in force layout | `150` |
| Languages (import parse) | **JavaScript/TypeScript, Python, Java** only |
| Graph type | **File-level import graph** (not call graph) |
| WebSocket purpose | **Commit scrub events only** |
| Cache (v1) | Caffeine in-process (Redis → `LATER.md`) |
| Sonification / fly-throughs / Redis | `LATER.md` |

### Language allowlist

| Ext | Parser |
|-----|--------|
| `.js` `.jsx` `.ts` `.tsx` `.mjs` `.cjs` | tree-sitter JS/TS — `import` / `require` |
| `.py` | tree-sitter Python — `import` / `from … import` |
| `.java` | tree-sitter Java — `import …;` (wildcards coarsened or skipped) |

Ignore for graph edges: `.cpp` `.cc` `.h` `.hpp` `.go` `.rs` etc.  
Still count path churn for history-only / timeline.

Ignore build noise in caps: `node_modules/`, `target/`, `build/`, `.git/`, `dist/`, `vendor/`, etc.

### Demo repos (lock in week 1)

| Size | Target | Role |
|------|--------|------|
| Small | ~30–80 files | Happy path, fast CI-style smoke |
| Medium | ~200–600 files | Primary demo (force layout + scrub) |
| Large | ~1500–4000+ files | Cap + directory collapse + history-only stress |

Use the **same three URLs** every milestone. Prefer demos that hit JS/TS, Python, **and** Java across the set.

---

## System overview

```
┌─────────────┐     HTTPS      ┌──────────────────────┐
│   Browser   │◄──────────────►│  Spring Boot (core)  │
│  Vite + D3  │   WebSocket    │  JGit · JGraphT      │
│  (Three.js  │   commit_*     │  Caffeine · WS       │
│   later)    │                └──────────┬───────────┘
└─────────────┘                           │ HTTP
                                          ▼
                               ┌──────────────────────┐
                               │ Parsing microservice │
                               │ tree-sitter → JSON   │
                               └──────────────────────┘
```

**Why two backends:** tree-sitter has weak/awkward Java bindings; parsing stays Python or Node. Spring Boot owns clone, history, graph merge, cache, WebSocket.

---

## Backend

### 1. Parsing microservice (Python or Node)

**Stateless:** receive repo path (or tarball) → walk allowlisted files → extract imports → return JSON → discard temp data.

**Responsibilities**
- Walk tree; respect ignore globs and `MAX_INGESTED_FILES`
- Per-file AST import extraction (JS/TS, Python, Java only)
- Resolve import string → target file path when possible (best-effort; drop unresolved edges)
- Output:

```json
{
  "modeHint": "full" | "history_only_candidate",
  "files": [{ "path": "src/App.tsx", "language": "ts" }],
  "edges": [{ "from": "src/App.tsx", "to": "src/api.ts", "kind": "import" }],
  "stats": { "parsed": 120, "skippedUnsupported": 40, "unresolvedImports": 15 }
}
```

**Non-goals (v1):** call graphs, symbol resolution, C++ includes, monorepo workspace magic.

### 2. Core service (Spring Boot + Java 21)

**Responsibilities**
- Accept GitHub URL; clone via **JGit** to ephemeral disk
- Call parsing microservice once per ingest
- Walk commits with JGit: per-file commit count, churn (lines ±), last modified, ordered commit list for scrubbing
- Build graph with **JGraphT**: nodes (file + directory aggregates), edges (imports), optional centrality for “top N on expand”
- Decide **full vs history-only** from parse stats
- **Caffeine** cache: `repoKey → GraphModel + CommitTimeline`
- **WebSocket** (Spring): stream scrub events only

**Suggested REST (v1)**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/repos` | `{ "url": "…" }` → start ingest; return `repoId` |
| `GET` | `/api/repos/{id}` | Status + mode (`full` \| `history_only`) |
| `GET` | `/api/repos/{id}/graph` | Nodes + edges for current view (dir-collapsed) |
| `GET` | `/api/repos/{id}/graph/expand?path=` | Expand directory → top-N files + “+X more” |
| `GET` | `/api/repos/{id}/timeline` | Ordered commits metadata (hashes, dates, file lists) |

Clone progress: HTTP polling on `GET …/status` — **not** WebSocket.

**WebSocket (v1) — single event family**

```json
{
  "type": "commit_event",
  "repoId": "…",
  "index": 42,
  "commitHash": "abc123",
  "timestamp": "2024-01-15T10:00:00Z",
  "filesChanged": ["src/A.java", "src/B.java"],
  "linesAdded": 30,
  "linesDeleted": 4
}
```

Client scrubber seeks `index` → server (or client-driven playback) emits `commit_event` → frontend pulses matching nodes.

**Non-goals (v1):** multi-user rooms, live `git pull`, build logs, Redis, sonification params.

### 3. Graph model

- **Default view:** directory/package-level nodes (configurable depth, e.g. top 2 path segments). Aggregate file import edges up to parent dirs.
- **Expand:** double-click directory → up to `MAX_VISIBLE_NODES` children; prefer top-N by centrality or churn; rest as one aggregated node `"+340 more"`.
- **File-level edges:** only between allowlisted parsed files.
- **History-only:** nodes without import edges; pulse by path prefix match on `filesChanged`.

---

## Frontend (v1)

| Piece | Tech | Role |
|-------|------|------|
| App shell | Vite + React (or plain TS) | URL paste, status, mode banner |
| Graph | **D3-force** (v1) | Layout ≤150 nodes |
| Canvas | SVG or 2D canvas first | Glow/pulse via opacity/scale (not full WebGL yet) |
| Timeline | Range scrubber | Maps to commit index; drives WS / local replay |
| Week 5+ | Three.js | Particles, shaders, LOD-by-zoom → `LATER.md` / post-`v1-demo-ready` |

**UI must say:** “Import graph · file level · JS/TS, Python, Java” and show **Full** vs **History-only**.

---

## Data flow (happy path)

1. User pastes GitHub URL → `POST /api/repos`
2. Core clones with JGit → calls parser → merges churn + imports into `GraphModel`
3. If edges sparse / unsupported-heavy → `mode = history_only`
4. `GET /graph` returns ≤150 directory nodes
5. Frontend runs D3-force; user expands dirs as needed
6. `GET /timeline` loads commit list; scrubber emits/requests `commit_event`s
7. Changed-file nodes pulse; cache serves repeat visits via Caffeine

---

## Caps & performance policy

1. At ingest: stop adding parse targets after **800** allowlisted files (or hard-cap all tracked source paths for churn at a documented limit).
2. At render: never simulate more than **150** nodes.
3. Large demo must: load, show directory graph or history-only, scrub without tab freeze.
4. LOD/particle shaders: week 5+ only; decide policy now, implement later.

---

## Suggested build order

| Week | Goal |
|------|------|
| **1** | Parsing service alone → JSON for JS/TS, Python, Java. Caps + ignore globs. Test on small demo. |
| **1–2** | Spring Boot: JGit clone + timeline; merge parser JSON; JGraphT; static D3 graph; history-only detection. |
| **3** | Attach churn/frequency/last-modified to nodes; directory collapse + expand top-N. |
| **4** | WebSocket `commit_event` + timeline scrubber pulses. Tag **`v1-demo-ready`**. |
| **5** | Three.js polish (optional branch). |
| **6** | Sonification (optional branch). |

---

## LATER.md (explicit non-v1)

- Redis / multi-instance cache
- Sonification (Web Audio)
- Camera fly-throughs / particle WebGL LOD
- Call graphs
- C/C++ `#include` parsing
- Kotlin/Go/Rust/etc.
- Multi-user WebSocket rooms
- Live clone progress over WS
- Clustering polish beyond dir collapse + top-N

---

## Free stack (aligned with deployment)

| Layer | Tech |
|-------|------|
| Parsing | Python or Node + tree-sitter |
| Core | Java 21 + Spring Boot + JGit + JGraphT + WebSocket + Caffeine |
| Frontend | Vite + D3-force (+ Three.js later) |
| Hosting | See `docs/deployment.md` (Pages/Vercel + Fly.io) |

---

## Resume / demo note

Ship the **`v1-demo-ready`** build with a short video: paste URL → graph (or history-only banner) → scrub timeline → pulses. Stretch goals are footnotes, not blockers.
