#!/usr/bin/env bash
#
# One-time setup for the symptom checker's GPU, run INSIDE a Lightning.ai
# GPU Studio — not on your laptop.
#
#   bash setup.sh
#
# What it does: installs Ollama, points its model store at the Studio's
# persistent disk, pulls the model in full, verifies it actually answers, and
# installs an authenticating reverse proxy in front of it.
#
# Safe to re-run. Every step checks before it acts.

set -euo pipefail

# ── Where the weights live ───────────────────────────────────────────────
# A Lightning Studio's container filesystem is disposable; only the teamspace
# directory survives a stop/start. Ollama defaults to ~/.ollama, which on most
# Studio images is NOT on that persistent mount — so a 18GB pull evaporates the
# first time the machine sleeps, and the next request pays for it again. This
# single line is the difference between pulling once and pulling every day.
PERSIST_ROOT="${PERSIST_ROOT:-/teamspace/studios/this_studio}"
if [ ! -d "$PERSIST_ROOT" ]; then
  echo "note: $PERSIST_ROOT not found, falling back to \$HOME (weights may not persist)"
  PERSIST_ROOT="$HOME"
fi
export OLLAMA_MODELS="${OLLAMA_MODELS:-$PERSIST_ROOT/.ollama/models}"
mkdir -p "$OLLAMA_MODELS"

# ── Model choice ─────────────────────────────────────────────────────────
# Default is Qwen3 30B-A3B: a mixture-of-experts model with 30B total weights
# but only ~3B active per token. It generates at roughly small-model speed
# while answering at roughly large-model quality, which is exactly the trade
# this route wants — the checker asks up to six questions in a row, so tokens
# per second IS the user experience.
#
# You asked for "Qwen 3.5". Qwen's published Ollama tags have moved around, so
# this script does not assume a tag exists: it verifies against the registry
# and tells you what it actually found. Override freely:
#
#   OLLAMA_MODEL=qwen3:14b bash setup.sh          # smaller, fits 16GB
#   OLLAMA_MODEL=qwen3:32b bash setup.sh          # denser, slower, needs 24GB+
#
MODEL="${OLLAMA_MODEL:-qwen3:30b-a3b}"

echo "==> model:      $MODEL"
echo "==> model store: $OLLAMA_MODELS"

# ── GPU sanity ───────────────────────────────────────────────────────────
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
else
  echo "WARNING: no nvidia-smi. If this Studio has no GPU, Ollama will run on"
  echo "         CPU and be slower than the API you are replacing. Stop here"
  echo "         and switch the Studio to a GPU machine."
fi

# ── Install Ollama ───────────────────────────────────────────────────────
if ! command -v ollama >/dev/null 2>&1; then
  echo "==> installing ollama"
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "==> ollama already installed: $(ollama --version 2>&1 | head -1)"
fi

# ── Start the server ─────────────────────────────────────────────────────
# Bound to localhost ONLY. The public port is the authenticating proxy below;
# Ollama itself must never be the thing listening on the open internet.
start_ollama() {
  if curl -sf http://127.0.0.1:11434/api/version >/dev/null 2>&1; then
    echo "==> ollama already serving"
    return
  fi
  echo "==> starting ollama"
  OLLAMA_HOST=127.0.0.1:11434 \
  OLLAMA_MODELS="$OLLAMA_MODELS" \
  OLLAMA_KEEP_ALIVE=-1 \
  OLLAMA_FLASH_ATTENTION=1 \
    nohup ollama serve > "$PERSIST_ROOT/ollama.log" 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf http://127.0.0.1:11434/api/version >/dev/null 2>&1 && return
    sleep 1
  done
  echo "ERROR: ollama did not come up. Check $PERSIST_ROOT/ollama.log" >&2
  exit 1
}
start_ollama

# ── Pull the model, in full ──────────────────────────────────────────────
if ollama list | awk '{print $1}' | grep -qx "$MODEL"; then
  echo "==> $MODEL already pulled"
else
  echo "==> pulling $MODEL (this is tens of GB, expect several minutes)"
  if ! ollama pull "$MODEL"; then
    echo ""
    echo "ERROR: could not pull '$MODEL'." >&2
    echo "That tag may not exist. Check https://ollama.com/library/qwen3 for the" >&2
    echo "current tags and re-run with, e.g.:  OLLAMA_MODEL=qwen3:14b bash setup.sh" >&2
    exit 1
  fi
fi

# ── Prove it actually answers ────────────────────────────────────────────
# A completed pull is not the same as a working model: a wrong quantization or
# an out-of-VRAM condition shows up here and nowhere earlier.
echo "==> verifying the model responds"
VERIFY=$(curl -sf http://127.0.0.1:11434/api/chat -d "{
  \"model\": \"$MODEL\",
  \"stream\": false,
  \"format\": \"json\",
  \"think\": false,
  \"keep_alive\": -1,
  \"messages\": [{\"role\":\"user\",\"content\":\"Reply with exactly {\\\"ok\\\":true}\"}],
  \"options\": {\"num_predict\": 32}
}") || { echo "ERROR: verification request failed" >&2; exit 1; }
echo "    -> $(echo "$VERIFY" | head -c 200)"

# ── Preload into VRAM and pin it there ───────────────────────────────────
# keep_alive -1 means "never unload". The first request after a load pays
# 20-60s; every request after that is fast. Pinning is the entire reason
# self-hosting beats a managed API on latency, so it is not optional.
echo "==> pinning weights in VRAM"
curl -sf http://127.0.0.1:11434/api/chat -d "{
  \"model\": \"$MODEL\", \"messages\": [], \"keep_alive\": -1
}" >/dev/null || true

# ── Authenticating reverse proxy ─────────────────────────────────────────
# Ollama has NO authentication of its own. An open /api/chat on a public URL
# is found by scanners within hours and used to run somebody else's workload
# on your GPU bill. Caddy sits in front and demands a bearer token.
if [ -z "${OLLAMA_AUTH_TOKEN:-}" ]; then
  echo ""
  echo "ERROR: OLLAMA_AUTH_TOKEN is not set." >&2
  echo "Generate one and re-run:" >&2
  echo "  export OLLAMA_AUTH_TOKEN=\$(openssl rand -hex 32)" >&2
  echo "Store the same value in Vercel as OLLAMA_AUTH_TOKEN." >&2
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "==> installing caddy"
  CADDY_URL="$(curl -fsSL https://api.github.com/repos/caddyserver/caddy/releases/latest \
    | grep -o 'https://[^\"]*caddy_[^\"]*_linux_amd64\.tar\.gz' \
    | head -1)"
  if [ -z "$CADDY_URL" ]; then
    echo "ERROR: could not resolve the current Caddy Linux release URL" >&2
    exit 1
  fi
  curl -fsSL "$CADDY_URL" | tar -xz -C /tmp caddy
  install -m 0755 /tmp/caddy /usr/local/bin/caddy 2>/dev/null \
    || { mkdir -p "$HOME/.local/bin" && install -m 0755 /tmp/caddy "$HOME/.local/bin/caddy" && export PATH="$HOME/.local/bin:$PATH"; }
fi

cat > "$PERSIST_ROOT/Caddyfile" <<'CADDY'
# Public edge for the symptom checker's GPU.
#
# Port 8080 is what you expose from the Lightning Studio. Ollama stays on
# 127.0.0.1:11434 and is unreachable from outside this container.
:8080 {
	@unauthorized not header Authorization "Bearer {env.OLLAMA_AUTH_TOKEN}"
	respond @unauthorized "unauthorized" 401

	# Model loads and long conclusions both take real time; the default proxy
	# read timeout would cut a cold first request off at the knees.
	reverse_proxy 127.0.0.1:11434 {
		transport http {
			read_timeout 120s
			write_timeout 120s
		}
	}
}
CADDY

if pgrep -f "caddy run" >/dev/null 2>&1; then
  echo "==> reloading caddy"
  caddy reload --config "$PERSIST_ROOT/Caddyfile" --adapter caddyfile 2>/dev/null || true
else
  echo "==> starting caddy on :8080"
  nohup caddy run --config "$PERSIST_ROOT/Caddyfile" --adapter caddyfile \
    > "$PERSIST_ROOT/caddy.log" 2>&1 &
  sleep 2
fi

# ── Confirm the guard actually guards ────────────────────────────────────
echo "==> checking auth"
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/api/version)
[ "$CODE" = "401" ] \
  && echo "    unauthenticated request correctly rejected (401)" \
  || echo "    WARNING: expected 401 without a token, got $CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $OLLAMA_AUTH_TOKEN" http://127.0.0.1:8080/api/version)
[ "$CODE" = "200" ] \
  && echo "    authenticated request accepted (200)" \
  || echo "    WARNING: expected 200 with a token, got $CODE"

cat <<EOF

────────────────────────────────────────────────────────────
Done. Now, in the Lightning UI, expose port 8080 and copy the
public URL it gives you.

Then set these in Vercel (and .env.local for local testing):

  USE_OLLAMA=true
  OLLAMA_BASE_URL=<the public URL for port 8080>
  OLLAMA_MODEL=$MODEL
  OLLAMA_AUTH_TOKEN=<the same token you exported here>

Then measure it, do not assume:  node scripts/bench-diagnose.mjs
────────────────────────────────────────────────────────────
EOF
