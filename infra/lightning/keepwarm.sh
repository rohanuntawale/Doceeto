#!/usr/bin/env bash
#
# Keep the GPU awake and the weights resident.
#
#   nohup bash keepwarm.sh > keepwarm.log 2>&1 &
#
# Two different problems, one loop:
#
#   1. Ollama unloads a model after its keep_alive expires. We set -1 so it
#      never should, but a crash-restart of `ollama serve` resets that, and the
#      next patient pays a 20-60s cold load. A periodic touch re-pins it.
#
#   2. Lightning Studios stop themselves when idle. A stopped Studio means the
#      public URL is dead and every symptom check silently falls through to the
#      slow OpenRouter path — the exact problem this whole setup exists to fix.
#      Generating a token or two on a schedule reads as activity.
#
# THE COST: this deliberately prevents the machine from going to sleep, so you
# are billed for a GPU around the clock, not just while patients are using it.
# That is the actual price of a fast first response. If the bill matters more
# than cold-start latency, do not run this — let the Studio sleep, and accept
# that the first check after an idle period is slow.

set -uo pipefail

MODEL="${OLLAMA_MODEL:-qwen3:30b-a3b}"
INTERVAL="${KEEPWARM_INTERVAL:-240}"   # seconds; comfortably under any idle timer

while true; do
  # num_predict 1 is enough to count as real GPU work without burning tokens.
  curl -sf http://127.0.0.1:11434/api/chat -d "{
    \"model\": \"$MODEL\",
    \"stream\": false,
    \"think\": false,
    \"keep_alive\": -1,
    \"messages\": [{\"role\":\"user\",\"content\":\"hi\"}],
    \"options\": {\"num_predict\": 1}
  }" >/dev/null 2>&1 \
    && echo "$(date -Is) warm" \
    || echo "$(date -Is) WARM PING FAILED — is ollama serve running?"
  sleep "$INTERVAL"
done
