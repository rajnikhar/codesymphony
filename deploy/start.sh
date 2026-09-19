#!/usr/bin/env bash
# Starts FastAPI parser (loopback) then Spring Boot on $PORT (Render injects PORT).
set -euo pipefail

PORT="${PORT:-8090}"
PARSER_PORT="${PARSER_PORT:-8001}"
PARSER_BASE_URL="${CODESYMPHONY_PARSER_BASE_URL:-http://127.0.0.1:${PARSER_PORT}}"

export CODESYMPHONY_PARSER_BASE_URL="${PARSER_BASE_URL}"
export SERVER_PORT="${PORT}"

echo "Starting parser on 127.0.0.1:${PARSER_PORT}"
cd /app/parser
# shellcheck disable=SC1091
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port "${PARSER_PORT}" &
PARSER_PID=$!

cleanup() {
  echo "Stopping parser (pid ${PARSER_PID})"
  kill "${PARSER_PID}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for parser health..."
ready=0
for _ in $(seq 1 60); do
  if python - <<PY
import urllib.request
urllib.request.urlopen("http://127.0.0.1:${PARSER_PORT}/health", timeout=1)
PY
  then
    ready=1
    break
  fi
  sleep 1
done

if [[ "${ready}" -ne 1 ]]; then
  echo "Parser failed to become healthy" >&2
  exit 1
fi

echo "Starting Spring Boot on port ${PORT}"
cd /app
exec java -jar /app/app.jar
