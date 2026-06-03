# FDE Cost Lab — LLM napkin-math toolkit

A **pure-static, zero-dependency** single-page site for Forward Deployed Engineers to do the math in front of a customer. Just open `index.html` — no server, no network, no tracking.

## Run

```
open index.html        # macOS
# or drag index.html into any browser
```

## Modules

| Module | What it does |
|---|---|
| 💰 **Token Cost** | Input/output tokens + DAU → per-request / day / month cost across Gemini / Claude / GPT / Llama / Qwen. Sortable, provider filter, **editable price cells**, cache-hit discount, cheapest auto-highlighted. |
| 🔀 **Routing / Model-Mix** | Cheap model for simple requests, big model for hard ones → blended cost and savings %. |
| ⏱️ **Latency** | TTFT (prefill, compute-bound), TPOT (decode, memory-bandwidth-bound: `tok/s ≈ HBM_BW ÷ model_bytes`), end-to-end. |
| 📈 **Capacity & Sizing** | Little's Law (`concurrency = QPS × latency`), QPS/GPU, GPUs needed at a target utilization. |
| ⚖️ **Break-even** | Monthly token volume where self-hosting beats the per-token API. |
| 🔧 **Throughput Levers / Build-vs-Buy** | Toggle continuous batching, quantization, speculative decoding, reserved capacity → self-host $/1M drops live, compared to the managed API. |
| 🧮 **KV-Cache** | `2 × layers × kv_heads × head_dim × seq × bytes` → per-request & total VRAM + single-card recommendation. Presets for Llama 8B/70B/405B, Qwen2.5 72B, Mistral 7B. |
| 🎓 **Training / Fine-tune** | `6 × N × D` FLOPs, GPU-hours, cost, full-FT vs LoRA memory. |
| 🔎 **RAG / Vector DB** | Vector-store size, one-time embedding cost, per-query context-token overhead. |
| 🖥️ **GPU Reference** | A100 / H100 / H200 / B200 — price, VRAM, HBM bandwidth, BF16 TFLOPS. |
| 📐 **Formula Library** | All 12 napkin-math formulas in one place. |

## Pricing (verified 2026-06-03, $/1M tokens, input/output)

| Provider | Source | Notes |
|---|---|---|
| **Gemini** | Vertex AI | **7 text tiers** across 2.5/3.x: 3.1 Pro 2/12, 2.5 Pro 1.25/10, 3.5 Flash 1.5/9, 3 Flash 0.5/3, 2.5 Flash 0.3/2.5, 3.1 Flash-Lite 0.25/1.5, 2.5 Flash-Lite 0.1/0.4. Plus a 🔷 **Google Family** section: embeddings, Imagen, Veo, Gemma, Live, Lyria + pricing levers (caching/batch/grounding/Priority/PT) |
| **Claude** | anthropic.com | Opus 4.8 = **5/25** (price cut since 4.5, not the old 15/75); Sonnet 4.6 = 3/15; Haiku 4.5 = 1/5 |
| **GPT** | OpenAI | GPT-5.5 = 5/30 (current flagship); GPT-5 / mini / nano still live at unchanged prices |
| **Llama** | Together / Fireworks / Groq | Open weights, varies by provider; output usually > input |
| **Qwen** | Alibaba DashScope (intl) | Qwen3.5 Max / Plus / Flash, rises with context length |

> Open-model prices vary a lot by host — values shown are representative averages. **Click any price cell to override with the customer's contract rate.**

## Files

```
index.html   structure + copy
styles.css   styling (dark default, light toggle top-right, remembers choice)
app.js       calculation engine + interactivity (vanilla JS)
```

> KV-cache uses the exact standard formula. Llama-70B (80 layers / 8 KV heads / 128 head_dim) @ 4K / FP16 ≈ **1.34 GB/request**, 200 concurrent ≈ **268 GB** — which is exactly why high concurrency pushes you to H200/B200.
