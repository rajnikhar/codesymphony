Here's the full updated plan with Spring Boot swapped in.

Architecture (updated)

Backend — split into two services

Parsing microservice (Python or Node, small/stateless) — runs tree-sitter, walks the repo, extracts imports/function calls, outputs JSON dependency graph. This is the one piece with no good Java binding, so it stays a separate lightweight service.
Core service (Spring Boot, Java) — the "real" backend:
JGit — clone repos, walk commit history, compute per-file churn/frequency/last-modified
JGraphT — adjacency graph, centrality, cycle detection
spring-websocket (or STOMP/SockJS) — streams ripple/hotspot events to frontend
Caffeine (@Cacheable) — in-memory cache for parsed repos; optional Redis if you want it to survive restarts
Calls the parsing microservice once per repo, merges its output with JGit's commit data into one graph model

Frontend — unchanged

Three.js/WebGL for particle rendering, D3-force for physics, Web Audio API for sonification, Vite for build
Free tech stack table
Layer	Tech	Cost
Parsing service	Python + tree-sitter (or Node + tree-sitter-node)	Free
Core backend	Java 21 + Spring Boot + JGit + JGraphT + WebSocket	Free
Cache	Caffeine (in-process) → Upstash Redis free tier if needed	Free
Frontend	Three.js + D3-force + Vite + Web Audio API	Free
Repo access	GitHub REST API with a personal access token (5000 req/hr)	Free
Free deployment layout
Component	Where	Notes
Frontend	Cloudflare Pages or Vercel	Static build, no card needed, instant deploy from GitHub
Spring Boot core service	Fly.io	Docker-based, you control JVM flags (-Xmx256m -Xss512k etc.) to fit free allowance; needs a card on file but free allowance covers a small always-on machine
Parsing microservice	Same Fly.io app as a second process, or a separate free Render service	Keep it stateless — clone to /tmp, parse, respond, discard
Repo clones	Ephemeral disk on Fly.io, wiped per deploy/restart	Fine since it's just a working cache, not source of truth

Key gotcha specific to Java here: JVM cold start on a scaled-to-zero free instance is the main tax you pay for using Spring Boot — budget for it by keeping the Spring Boot service always-on within Fly.io's free allowance rather than letting it sleep (Render's free tier auto-sleeps and JVM cold starts there are rough, 30-40s+).

Suggested build order (updated for two-service split)
Week 1: Get parsing microservice working standalone — feed it a repo path, get back a dependency JSON. Test it in isolation before touching Java.
Week 1-2: Spring Boot skeleton — JGit clone + commit walk, JGraphT graph construction from the parsing service's JSON, render statically with D3-force (no animation yet).
Week 3: Wire in churn/frequency data from JGit into the graph nodes.
Week 4: WebSocket streaming of ripple events + timeline scrubber on frontend.
Week 5: WebGL/Three.js polish, glow shaders, camera fly-throughs.
Week 6 (stretch): Sonification via Web Audio API.