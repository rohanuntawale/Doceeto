# Self-hosted model for the symptom checker

The checker's latency problem is the model, not the network. OpenRouter's 550B
takes 9–13s to answer one narrowing question, and the flow asks up to six in a
row before it concludes. A mid-size model on a GPU we keep warm answers the same
question in 1–2s.

This directory sets that GPU up on Lightning.ai. The app falls back to
OpenRouter automatically, so none of this is load-bearing — if the GPU is down,
the checker gets slow again rather than breaking.

## Read this before you start

**A cold GPU is slower than the API you are replacing.** Loading the weights
into VRAM costs 20–60s, and Lightning Studios stop themselves when idle. Warm,
this setup is several times faster; cold, it is much worse. Everything below
about `keep_alive`, `keepwarm.sh`, and `/api/warm` exists to keep it warm — and
keeping a GPU warm means paying for a GPU around the clock, not just while
patients are using it. That is the real cost of the change. Decide whether you
want it before you run the benchmark and are surprised by either number.

## Setup

1. **Create a GPU Studio** on lightning.ai. The default model needs ~20GB VRAM
   (L4 24GB, A10G 24GB, or better). For a 16GB card use `qwen3:14b` instead.

2. **In the Studio's terminal**, from this repo:

   ```bash
   export OLLAMA_AUTH_TOKEN=$(openssl rand -hex 32)
   echo "$OLLAMA_AUTH_TOKEN"          # save this, you need it in Vercel
   bash infra/lightning/setup.sh
   ```

   The script installs Ollama, puts the model store on the Studio's persistent
   disk (so the pull survives a restart), pulls the model in full, verifies it
   answers, pins it in VRAM, and puts an authenticating proxy in front of it.

   To use a different model:

   ```bash
   OLLAMA_MODEL=qwen3:14b bash infra/lightning/setup.sh
   ```

3. **Keep it awake** (optional, costs money — see above):

   ```bash
   nohup bash infra/lightning/keepwarm.sh > keepwarm.log 2>&1 &
   ```

4. **Expose port 8080** in the Lightning UI and copy the public URL.

5. **Configure the app** — in Vercel, and in `.env.local` to test locally:

   ```
   USE_OLLAMA=true
   OLLAMA_BASE_URL=https://<your-lightning-url>
   OLLAMA_MODEL=qwen3:30b-a3b
   OLLAMA_AUTH_TOKEN=<the token from step 2>
   ```

6. **Measure it:**

   ```bash
   node scripts/bench-diagnose.mjs
   node scripts/bench-diagnose.mjs --lang hi     # Devanagari costs 2-3x the tokens
   node scripts/bench-diagnose.mjs --cold        # after restarting the Studio
   ```

   If self-hosted is not clearly faster at p50, do not keep it. Set
   `USE_OLLAMA=` and everything reverts with no deploy.

## Why port 8080 and not 11434

Ollama has no authentication. Exposing `:11434` publicly gives anyone who finds
it — and scanners find these within hours — free use of your GPU on your bill.
Caddy sits on 8080, requires `Authorization: Bearer $OLLAMA_AUTH_TOKEN`, and
forwards to Ollama on localhost. Never expose 11434 itself.

## Model choice

Default is **Qwen3 30B-A3B**: 30B total weights, ~3B active per token. It
generates at roughly small-model speed with much better quality than a dense 3B,
which is the right trade here — tokens per second *is* the user experience when
the patient is waiting on six questions in a row.

You asked for "Qwen 3.5". Qwen's Ollama tag naming has shifted between releases
and I could not confirm that tag exists, so `setup.sh` verifies against the
registry and fails with a clear message rather than silently pulling something
else. Check <https://ollama.com/library/qwen3> for current tags and pass
`OLLAMA_MODEL=` if a newer one is available.

Two settings matter more than the model choice:

- **`think: false`** — Qwen3 is a hybrid reasoning model and emits a long
  `<think>` block before answering unless told not to. For "where does it hurt?"
  that reasoning is pure latency. Set in `lib/ai/llm.ts`.
- **`num_ctx: 8192`** — the system prompt alone is several thousand tokens.
  Ollama's default window is smaller and truncates the *front* of the prompt,
  quietly discarding the personalisation and safety rules.

## What did not change

The medical logic is untouched. The prompt, the deterministic red-flag engine,
the escalate-only safety floor, the specialty normalisation and the nurse-routing
rules all still run on every response regardless of which model produced it — a
faster model is not a more trusted one.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Responses tagged `via: "openrouter"` | GPU unreachable or over its 8s budget. Check the Studio is running and the port is exposed. |
| 401 from the proxy | `OLLAMA_AUTH_TOKEN` differs between Vercel and the Studio. |
| First check of the day is slow | Studio slept. Expected without `keepwarm.sh`. |
| `reason: "bad-json"` in responses | Model ignored `format: "json"` — usually too small. Try a larger tag. |
| Answers ignore the patient's profile | `num_ctx` too small; the profile block sits early in the prompt and gets truncated first. |
