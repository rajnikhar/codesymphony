import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'

type Health = { status: string; service: string }

function App() {
  const [url, setUrl] = useState('')
  const [health, setHealth] = useState<string>('…')
  const [message, setMessage] = useState<string>('')

  async function checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`)
      const data = (await res.json()) as Health
      setHealth(`${data.service}: ${data.status}`)
    } catch {
      setHealth('core unreachable')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage('Submitting…')
    try {
      const res = await fetch(`${API_BASE}/api/repos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      setMessage(`Accepted repoId=${data.repoId} (skeleton — graph coming week 1–2)`)
    } catch {
      setMessage('Failed to reach core API. Is Spring Boot running on :8080?')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>CodeSymphony</h1>
        <p className="tagline">
          Import graph · file level · JS/TS, Python, Java
        </p>
        <button type="button" className="ghost" onClick={checkHealth}>
          Ping API
        </button>
        <span className="health">{health}</span>
      </header>

      <main className="main">
        <form className="ingest" onSubmit={onSubmit}>
          <label htmlFor="repo-url">GitHub repo URL</label>
          <div className="row">
            <input
              id="repo-url"
              type="url"
              placeholder="https://github.com/org/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
            <button type="submit">Visualize</button>
          </div>
        </form>
        {message && <p className="message">{message}</p>}

        <section className="graph-placeholder" aria-label="Graph canvas">
          <p>Force graph + timeline scrubber land in weeks 1–4.</p>
          <p className="hint">D3 is installed — wire layout next.</p>
        </section>

        <section className="timeline" aria-label="Timeline">
          <label htmlFor="scrub">Timeline</label>
          <input id="scrub" type="range" min={0} max={100} defaultValue={0} disabled />
        </section>
      </main>
    </div>
  )
}

export default App
