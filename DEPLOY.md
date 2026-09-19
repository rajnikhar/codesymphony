# Free deploy (no local Docker)

CodeSymphony needs **one** API process that runs **parser + Spring together**
(parser reads clone paths on the same disk). Frontend is separate.

## 1. Render — API (Docker, free)

1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Web Service**
2. Connect GitHub → `rajnikhar/CodeSymphony`
3. Settings:

| Field | Value |
|--------|--------|
| Language | **Docker** |
| Branch | `main` |
| Root Directory | *(leave empty — Dockerfile is at repo root)* |
| Dockerfile Path | `./Dockerfile` |
| Instance | **Free** |

4. Environment variables:

| Key | Value |
|-----|--------|
| `CODESYMPHONY_CORS_ALLOWED_ORIGINS` | `http://localhost:5173,https://YOUR-APP.pages.dev` |
| `CODESYMPHONY_PARSER_BASE_URL` | `http://127.0.0.1:8001` *(default; optional)* |

Render sets `PORT` automatically — `start.sh` / Spring already use it.

5. Deploy → copy URL, e.g. `https://codesymphony-api.onrender.com`
6. Test (wait up to ~1 min on cold start):  
   `https://YOUR-API.onrender.com/api/health`

## 2. Cloudflare Pages — client (free)

1. [Cloudflare Pages](https://dash.cloudflare.com) → Create → Connect `CodeSymphony`
2. Build settings:

| Field | Value |
|--------|--------|
| Root directory | `client` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Env `VITE_API_BASE` | `https://YOUR-API.onrender.com` *(no trailing slash)* |

3. Deploy → copy `https://YOUR-APP.pages.dev`
4. Update Render env `CODESYMPHONY_CORS_ALLOWED_ORIGINS` to include that Pages URL → **Manual Deploy** on Render once.

## 3. Resume link

Use the **Pages** URL. Note: free Render sleeps when idle — first open may take 30–60s.

## Local (unchanged)

Still run three terminals as in `README.md` — no Docker required on your laptop.
