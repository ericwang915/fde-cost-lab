/* ============================================================
   FDE Cost Lab — LLM napkin-math engine (vanilla JS)
   Token prices: $ per 1,000,000 tokens (input / output).
   Verified 2026-06-03: Gemini=Vertex, Claude=anthropic.com,
   GPT=OpenAI official; Llama/Qwen=representative hosted averages.
   ============================================================ */

const MODELS = [
  // Gemini = 2026 Vertex / AI Studio official, Standard+global, ≤200k context tier
  { model: "Gemini 3.1 Pro",        provider: "Gemini", inPrice: 2.00,  outPrice: 12.00, note: "Flagship reasoning · >200k: $4/$18" },
  { model: "Gemini 2.5 Pro",        provider: "Gemini", inPrice: 1.25,  outPrice: 10.00, note: "Prev-gen Pro (live ≥Oct'26) · >200k: $2.50/$15" },
  { model: "Gemini 3.5 Flash",      provider: "Gemini", inPrice: 1.50,  outPrice: 9.00,  note: "Newest Flash (GA, May'26)" },
  { model: "Gemini 3 Flash",        provider: "Gemini", inPrice: 0.50,  outPrice: 3.00,  note: "Workhorse value (audio in $1)" },
  { model: "Gemini 2.5 Flash",      provider: "Gemini", inPrice: 0.30,  outPrice: 2.50,  note: "Prev-gen Flash (live ≥Oct'26)" },
  { model: "Gemini 3.1 Flash-Lite", provider: "Gemini", inPrice: 0.25,  outPrice: 1.50,  note: "Cheapest 3.x tier" },
  { model: "Gemini 2.5 Flash-Lite", provider: "Gemini", inPrice: 0.10,  outPrice: 0.40,  note: "Cheapest overall (prev-gen)" },

  // Claude = anthropic.com official (global tier)
  { model: "Claude Opus 4.8",       provider: "Claude", inPrice: 5.00,  outPrice: 25.00, note: "Top reasoning · price cut since 4.5" },
  { model: "Claude Sonnet 4.6",     provider: "Claude", inPrice: 3.00,  outPrice: 15.00, note: "Workhorse · 1M context" },
  { model: "Claude Haiku 4.5",      provider: "Claude", inPrice: 1.00,  outPrice: 5.00,  note: "Light & fast" },

  // GPT = OpenAI official
  { model: "GPT-5.5",               provider: "GPT",    inPrice: 5.00,  outPrice: 30.00, note: "Current flagship (2026-04)" },
  { model: "GPT-5",                 provider: "GPT",    inPrice: 1.25,  outPrice: 10.00, note: "GPT-5 gen · still live, good value" },
  { model: "GPT-5 mini",            provider: "GPT",    inPrice: 0.25,  outPrice: 2.00,  note: "Workhorse" },
  { model: "GPT-5 nano",            provider: "GPT",    inPrice: 0.05,  outPrice: 0.40,  note: "Ultra-light" },

  // Llama = open weights, hosted averages (Together/Fireworks/Groq/DeepInfra), vary by provider
  { model: "Llama 4 Maverick",      provider: "Llama",  inPrice: 0.20,  outPrice: 0.70,  note: "Open flagship · 400B MoE / 17B active" },
  { model: "Llama 3.3 70B",         provider: "Llama",  inPrice: 0.40,  outPrice: 0.60,  note: "Open workhorse (hosted)" },
  { model: "Llama 3.1 8B",          provider: "Llama",  inPrice: 0.05,  outPrice: 0.08,  note: "Edge / small" },

  // Qwen = Alibaba DashScope international tier, rises with context
  { model: "Qwen3.5 Max",           provider: "Qwen",   inPrice: 1.20,  outPrice: 6.00,  note: "Flagship · Max-tier" },
  { model: "Qwen3.5 Plus",          provider: "Qwen",   inPrice: 0.40,  outPrice: 1.20,  note: "Workhorse (non-thinking)" },
  { model: "Qwen3.5 Flash",         provider: "Qwen",   inPrice: 0.10,  outPrice: 0.40,  note: "Small / fast" },
];

const PROVIDER_COLORS = {
  Gemini: "#4f8cff", Claude: "#d97757", GPT: "#10a37f", Llama: "#7c5cff", Qwen: "#e3a008",
};

// GPU specs: vramGB, HBM bandwidth (GB/s), BF16 dense TFLOPS, $/hr midpoint, price range,
// tf = rough relative inference throughput vs H100 (workload-dependent heuristic), role
const GPUS = [
  { gpu: "A100", vram: "80 GB",  vramGB: 80,  bwGBs: 2039, tflops: 312,  hr: 1.8, tf: 0.5, price: "$1.3–2.5", note: "Budget batch processing" },
  { gpu: "H100", vram: "80 GB",  vramGB: 80,  bwGBs: 3352, tflops: 990,  hr: 3.0, tf: 1.0, price: "$2–4",     note: "70B training value king (pre-Blackwell)" },
  { gpu: "H200", vram: "141 GB", vramGB: 141, bwGBs: 4800, tflops: 990,  hr: 3.8, tf: 1.5, price: "$3–4.5",   note: "Long-context / high-concurrency inference (more VRAM → bigger batch)" },
  { gpu: "B200", vram: "192 GB", vramGB: 192, bwGBs: 8000, tflops: 2250, hr: 6.0, tf: 4.0, price: "$2–3.5 spot · $5–14 on-demand", note: "~4× H100 throughput; cost/token down to ~1/7 of H100 when saturated" },
];
// reference static-batch throughput for an H100 (tf=1.0); scaled by GPU tf
const REF_TPUT_STATIC = 1000;   // build-vs-buy baseline (pre-batching)
const REF_TPUT_SUSTAINED = 2500; // break-even sustained (with continuous batching)

// Google specialized models (NOT per-token text) — interview reference
const GOOGLE_MODELS = [
  { m: "Gemini Embedding 2",     cat: "Embedding",        price: "$0.20 / 1M tok (text)", note: "Multimodal · 3072 dims (MRL 128–3072) · 8k input" },
  { m: "Gemini Embedding 001",   cat: "Embedding",        price: "$0.15 / 1M tok",        note: "1st-gen, legacy" },
  { m: "Imagen 4",               cat: "Image gen",        price: "$0.02 fast · $0.04 std · $0.06 ultra / image", note: "Dedicated image model" },
  { m: "Gemini 3 Pro Image",     cat: "Image gen (native)", price: "~$0.13 / image",      note: "Image output billed $120 / 1M tok" },
  { m: "Veo 3.1",                cat: "Video gen",        price: "$0.40/s std · $0.10/s fast", note: "720p–4K · newest Veo (preview)" },
  { m: "Veo 3",                  cat: "Video gen",        price: "$0.40 / second",        note: "GA" },
  { m: "Gemma 4 (open weights)", cat: "Open / self-host", price: "Free (Apache 2.0) · hosted 26B $0.15/$0.60", note: "E2B / E4B / 26B MoE / 31B dense · multimodal" },
  { m: "Gemini 3.1 Flash Live",  cat: "Realtime audio",   price: "in $0.75 txt / $3 audio · out $4.50 txt / $12 audio (/1M)", note: "Live API (preview)" },
  { m: "Lyria 3",                cat: "Music gen",        price: "$0.04 / 30s clip · $0.08 / song", note: "Preview" },
];

// Google pricing levers an FDE would pitch
const GOOGLE_LEVERS = [
  { l: "Context caching",            v: "~90% off input",      note: "Cached input ≈ 10% of input price (3.1 Pro $2 → $0.20/1M). Vertex storage ~$1 / 1M-tok / hr." },
  { l: "Batch / async mode",         v: "−50% in & out",       note: "Non-realtime jobs. 3.1 Pro $2/$12 → $1/$6." },
  { l: "Grounding w/ Google Search", v: "$14 / 1k prompts (3.x)", note: "5k/mo free, then $14/1k (Gemini 3.x); 2.5 is $35/1k. 1 prompt = 1 charge." },
  { l: "Priority tier (Vertex)",     v: "~1.8× standard",      note: "Lower-latency lane for the same model." },
  { l: "Provisioned Throughput",     v: "Reserved GSUs",       note: "Committed capacity for guaranteed QPS; quote-based, not per-token." },
];

// Architecture presets: layers, KV heads, head_dim, FP16 weight GB, params (B)
const ARCH = {
  "Llama 8B":     { layers: 32,  heads: 8, headDim: 128, weights: 16,  params: 8 },
  "Llama 70B":    { layers: 80,  heads: 8, headDim: 128, weights: 140, params: 70 },
  "Llama 405B":   { layers: 126, heads: 8, headDim: 128, weights: 810, params: 405 },
  "Qwen2.5 72B":  { layers: 80,  heads: 8, headDim: 128, weights: 145, params: 72 },
  "Mistral 7B":   { layers: 32,  heads: 8, headDim: 128, weights: 14,  params: 7 },
  "Custom":       null,
};

// Interactive throughput levers (self-hosted cost)
const LEVERS = [
  { id: "Batch", rank: "1", name: "Continuous batching (vLLM)", gain: "throughput ×2–4", on: true,
    ctrl: `<input type="range" id="lvBatchVal" min="2" max="4" step="0.1" value="2.5"><span class="v" id="lvBatchV">×2.5</span>`,
    desc: "vs static batching. Free lunch — do it first." },
  { id: "Quant", rank: "2", name: "Quantization", gain: "VRAM −50%~75%", on: false,
    ctrl: `<select id="lvQuantMode"><option value="fp8">FP8 · VRAM−50% · tput ~×1.5</option><option value="int4">INT4 · VRAM−75% · tput ~×1.8</option></select>`,
    desc: "Less VRAM → fewer/cheaper GPUs. Validate accuracy loss with an eval set." },
  { id: "Spec", rank: "3", name: "Speculative decoding", gain: "tok/s ×2–3", on: false,
    ctrl: `<input type="range" id="lvSpecVal" min="2" max="3" step="0.1" value="2"><span class="v" id="lvSpecV">×2.0</span>`,
    desc: "Small draft model proposes, big model verifies." },
  { id: "Reserved", rank: "4", name: "Reserved / committed capacity", gain: "hourly −30~50%", on: false,
    ctrl: `<input type="range" id="lvReservedVal" min="30" max="50" step="1" value="40"><span class="v" id="lvReservedV">−40%</span>`,
    desc: "For steady load, committed use is far cheaper than on-demand." },
  { id: "Right", rank: "5", name: "Right-sizing the card", gain: "avoid waste", on: false,
    ctrl: "",
    desc: "Don't run a 7B on an H200 (an L4 suffices), or two H100s for a 70B that fits one H200." },
];
const QUANT_TPUT = { fp8: 1.5, int4: 1.8 };

/* ----------------------- helpers ----------------------- */
const $ = (id) => document.getElementById(id);
const num = (id) => parseFloat($(id).value) || 0;
const chk = (id) => $(id).checked;
const gpuByName = (n) => GPUS.find((g) => g.gpu === n) || GPUS[1];

const fmtMoney = (v) => {
  if (!isFinite(v)) return "—";
  if (v === 0) return "$0";
  if (v < 0.01) return "$" + v.toPrecision(2);
  if (v < 1000) return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
};
const fmtCompact = (v) => {
  if (!isFinite(v)) return "—";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "k";
  return fmtMoney(v);
};
const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
const fmtNumC = (v) => {
  if (!isFinite(v)) return "—";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "k";
  return fmtInt(v);
};
const fmtGB = (v) => v >= 1000 ? (v / 1000).toFixed(2) + " TB" : (v < 10 ? v.toFixed(2) : Math.round(v)) + " GB";
const fmtMs = (ms) => ms >= 1000 ? (ms / 1000).toFixed(2) + " s" : Math.round(ms) + " ms";
const fmtDur = (h) => h < 1 ? Math.round(h * 60) + " min" : (h < 48 ? h.toFixed(1) + " h" : (h / 24).toFixed(1) + " days");

/* ----------------------- state ----------------------- */
let sortKey = "perMonth";
let sortDir = 1;
const activeProviders = new Set(Object.keys(PROVIDER_COLORS));

/* ============================================================
   TOKEN COST
   ============================================================ */
function costRow(m) {
  const inTok = num("inTok"), outTok = num("outTok");
  const cacheHit = Math.min(100, Math.max(0, num("cacheHit"))) / 100;
  const effInPrice = m.inPrice * (1 - cacheHit) + m.inPrice * 0.25 * cacheHit;
  const perReq = (inTok * effInPrice + outTok * m.outPrice) / 1e6;
  const perDay = perReq * num("reqs");
  const perMonth = perDay * num("days");
  return { ...m, perReq, perDay, perMonth };
}

function renderCostTable() {
  const tbody = $("costTable").querySelector("tbody");
  const baselineModel = $("baseline").value;
  const onlyShown = $("onlyShown").checked;

  let rows = MODELS.filter((m) => !onlyShown || activeProviders.has(m.provider)).map(costRow);
  const baseRow = rows.find((r) => r.model === baselineModel) || costRow(MODELS[0]);
  rows.forEach((r) => (r.vsBase = baseRow.perMonth > 0 ? (r.perMonth - baseRow.perMonth) / baseRow.perMonth : 0));

  rows.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  const cheapest = Math.min(...rows.map((r) => r.perMonth));

  tbody.innerHTML = rows.map((r) => {
    const isCheap = r.perMonth === cheapest && rows.length > 1;
    const dot = `<span class="prov-dot" style="background:${PROVIDER_COLORS[r.provider]}"></span>`;
    let vs = "—";
    if (r.model !== baselineModel) {
      const pct = r.vsBase * 100;
      vs = `<span class="${pct <= 0 ? "delta-pos" : "delta-neg"}">${pct > 0 ? "+" : ""}${pct.toFixed(0)}%</span>`;
    }
    return `<tr class="${isCheap ? "cheapest" : ""}">
      <td>${dot}<b>${r.model}</b>${isCheap ? '<span class="pill tag-cheapest">cheapest</span>' : ""}<br><span class="sub">${r.note}</span></td>
      <td>${r.provider}</td>
      <td class="num editable" data-model="${r.model}" data-field="inPrice">${r.inPrice.toFixed(2)}</td>
      <td class="num editable" data-model="${r.model}" data-field="outPrice">${r.outPrice.toFixed(2)}</td>
      <td class="num">${fmtMoney(r.perReq)}</td>
      <td class="num">${fmtCompact(r.perDay)}</td>
      <td class="num"><b>${fmtCompact(r.perMonth)}</b></td>
      <td class="num">${vs}</td>
    </tr>`;
  }).join("");

  attachEditable();
}

function attachEditable() {
  document.querySelectorAll(".editable").forEach((cell) => {
    cell.onclick = () => {
      if (cell.querySelector("input")) return;
      const cur = cell.textContent;
      cell.innerHTML = `<input type="number" step="0.01" min="0" value="${cur}" style="width:70px;padding:2px 6px;font-size:13px;text-align:right" />`;
      const inp = cell.querySelector("input");
      inp.focus(); inp.select();
      const commit = () => {
        const v = parseFloat(inp.value);
        const m = MODELS.find((x) => x.model === cell.dataset.model);
        if (m && !isNaN(v) && v >= 0) m[cell.dataset.field] = v;
        renderAll();
      };
      inp.onblur = commit;
      inp.onkeydown = (e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") renderCostTable(); };
    };
  });
}

/* ============================================================
   SELECTS / CHIPS
   ============================================================ */
function buildSelects() {
  const modelOpts = MODELS.map((m) => `<option value="${m.model}">${m.model} — $${m.inPrice}/$${m.outPrice}</option>`).join("");
  const gpuOpts = GPUS.map((g) => `<option value="${g.gpu}">${g.gpu} (${g.vram})</option>`).join("");
  const archOpts = Object.keys(ARCH).map((k) => `<option value="${k}">${k}</option>`).join("");

  $("baseline").innerHTML = modelOpts; $("baseline").value = "Gemini 3.1 Pro";
  $("rtSimple").innerHTML = modelOpts; $("rtSimple").value = "Gemini 2.5 Flash-Lite";
  $("rtComplex").innerHTML = modelOpts; $("rtComplex").value = "Gemini 3.1 Pro";
  $("beModel").innerHTML = modelOpts; $("beModel").value = "Llama 3.3 70B";
  $("lvModel").innerHTML = modelOpts; $("lvModel").value = "Llama 3.3 70B";

  $("kvPreset").innerHTML = archOpts; $("kvPreset").value = "Llama 70B";
  $("latPreset").innerHTML = archOpts; $("latPreset").value = "Llama 70B";
  $("trPreset").innerHTML = archOpts; $("trPreset").value = "Llama 8B";

  $("latGpu").innerHTML = gpuOpts; $("latGpu").value = "H100";
  $("beGpu").innerHTML = gpuOpts; $("beGpu").value = "H100"; $("beHr").value = GPU_HR("H100");
  $("trGpu").innerHTML = gpuOpts; $("trGpu").value = "H100"; $("trHr").value = GPU_HR("H100");
  $("lvGpu").innerHTML = gpuOpts; $("lvGpu").value = "H100"; $("lvHr").value = GPU_HR("H100");
}
const GPU_HR = (n) => gpuByName(n).hr;

function buildProviderChips() {
  const wrap = $("providerFilter");
  wrap.innerHTML = Object.keys(PROVIDER_COLORS).map((p) =>
    `<span class="chip active" data-prov="${p}"><span class="prov-dot" style="background:${PROVIDER_COLORS[p]}"></span>${p}</span>`
  ).join("");
  wrap.querySelectorAll(".chip").forEach((c) => {
    c.onclick = () => {
      const p = c.dataset.prov;
      if (activeProviders.has(p)) { activeProviders.delete(p); c.classList.remove("active"); }
      else { activeProviders.add(p); c.classList.add("active"); }
      applyChipStyle(c);
      if ($("onlyShown").checked) renderCostTable();
    };
    applyChipStyle(c);
  });
}
function applyChipStyle(c) {
  if (c.classList.contains("active")) { c.style.background = PROVIDER_COLORS[c.dataset.prov]; c.style.color = "#fff"; c.style.borderColor = "transparent"; }
  else { c.style.background = ""; c.style.color = ""; c.style.borderColor = ""; }
}

/* ============================================================
   ROUTING MIX
   ============================================================ */
function renderRouting() {
  const simple = costRow(MODELS.find((m) => m.model === $("rtSimple").value));
  const complex = costRow(MODELS.find((m) => m.model === $("rtComplex").value));
  const pct = num("rtPct") / 100;
  $("rtPctLabel").textContent = Math.round(pct * 100) + "%";

  const blendedMonth = simple.perMonth * pct + complex.perMonth * (1 - pct);
  const allComplex = complex.perMonth, allSimple = simple.perMonth;
  const saveVsComplex = allComplex > 0 ? (allComplex - blendedMonth) / allComplex : 0;
  const reqMonth = num("reqs") * num("days") || 1;

  $("routingResult").innerHTML = `
    <div class="rcard"><div class="rlabel">All "${complex.model}"</div><div class="rval">${fmtCompact(allComplex)}</div><div class="rsub">/month</div></div>
    <div class="rcard accent"><div class="rlabel">Blended (${Math.round(pct * 100)}% cheap)</div><div class="rval">${fmtCompact(blendedMonth)}</div><div class="rsub">/month · ${fmtMoney(blendedMonth / reqMonth)}/req</div></div>
    <div class="rcard good"><div class="rlabel">Saved vs all-big-model</div><div class="rval">${(saveVsComplex * 100).toFixed(0)}%</div><div class="rsub">≈ ${fmtCompact(allComplex - blendedMonth)}/month</div></div>
    <div class="rcard"><div class="rlabel">All "${simple.model}" (floor)</div><div class="rval">${fmtCompact(allSimple)}</div><div class="rsub">/month</div></div>`;
}

/* ============================================================
   LATENCY
   ============================================================ */
function applyArchPreset(presetId, paramsId, weightsId) {
  const p = ARCH[$(presetId).value];
  if (!p) return;
  if (paramsId) $(paramsId).value = p.params;
  if (weightsId) $(weightsId).value = p.weights;
}

function renderLatency() {
  const params = num("latParams"), bytes = parseFloat($("latPrec").value);
  const g = gpuByName($("latGpu").value);
  const prompt = num("latPrompt"), out = num("latOut"), mfu = num("latMfu") / 100 || 0.4;

  const modelBytes = params * 1e9 * bytes;
  const decodeTokS = (g.bwGBs * 1e9) / modelBytes;     // memory-bound, batch=1
  const tpotMs = 1000 / decodeTokS;
  const prefillFlops = 2 * params * 1e9 * prompt;      // compute-bound prefill
  const ttftS = prefillFlops / (g.tflops * 1e12 * mfu);
  const e2eS = ttftS + out * (tpotMs / 1000);

  $("latResult").innerHTML = `
    <div class="rcard"><div class="rlabel">Decode speed (batch=1)</div><div class="rval">${decodeTokS.toFixed(0)}<span style="font-size:14px"> tok/s</span></div><div class="rsub">${fmtGB(modelBytes / 1e9)} ÷ ${(g.bwGBs / 1000).toFixed(2)} TB/s</div></div>
    <div class="rcard"><div class="rlabel">TPOT (per token)</div><div class="rval">${tpotMs.toFixed(1)}<span style="font-size:14px"> ms</span></div><div class="rsub">inter-token latency</div></div>
    <div class="rcard accent"><div class="rlabel">TTFT (prefill)</div><div class="rval">${fmtMs(ttftS * 1000)}</div><div class="rsub">${prompt.toLocaleString()} prompt tok @ ${(mfu * 100).toFixed(0)}% MFU</div></div>
    <div class="rcard good"><div class="rlabel">End-to-end latency</div><div class="rval">${fmtMs(e2eS * 1000)}</div><div class="rsub">TTFT + ${out.toLocaleString()} × TPOT on ${g.gpu}</div></div>`;
}

/* ============================================================
   CAPACITY & SIZING (Little's Law)
   ============================================================ */
function renderCapacity() {
  const qps = num("capQps"), out = num("capOut") || 1, tokGpu = num("capTokGpu") || 1;
  const lat = num("capLat"), util = num("capUtil") / 100 || 0.7;

  const concurrency = qps * lat;             // Little's Law
  const qpsPerGpu = tokGpu / out;            // decode-bound QPS one GPU sustains
  const gpusNeeded = Math.max(1, Math.ceil(qps / qpsPerGpu / util));
  const effCap = gpusNeeded * qpsPerGpu * util;

  $("capResult").innerHTML = `
    <div class="rcard accent"><div class="rlabel">In-flight concurrency</div><div class="rval">${concurrency.toFixed(0)}</div><div class="rsub">= ${qps} QPS × ${lat}s (Little's Law)</div></div>
    <div class="rcard"><div class="rlabel">QPS per GPU</div><div class="rval">${qpsPerGpu.toFixed(1)}</div><div class="rsub">${fmtInt(tokGpu)} tok/s ÷ ${out} out-tok</div></div>
    <div class="rcard good"><div class="rlabel">GPUs needed</div><div class="rval">${gpusNeeded}</div><div class="rsub">@ ${(util * 100).toFixed(0)}% target utilization</div></div>
    <div class="rcard"><div class="rlabel">Provisioned capacity</div><div class="rval">${effCap.toFixed(0)}<span style="font-size:14px"> QPS</span></div><div class="rsub">headroom above ${qps} peak</div></div>`;
}

/* ============================================================
   BREAK-EVEN: self-host vs API
   ============================================================ */
function blendedPer1M(model) {
  const inTok = num("inTok"), outTok = num("outTok");
  return (inTok * model.inPrice + outTok * model.outPrice) / ((inTok + outTok) || 1);
}
function renderBreakeven() {
  const hr = num("beHr"), n = num("beN"), tokGpu = num("beTokGpu") || 1;
  const m = MODELS.find((x) => x.model === $("beModel").value) || MODELS[0];
  const per1M = blendedPer1M(m), perToken = per1M / 1e6;
  const SEC_MO = 30 * 86400; // 2,592,000 s/month

  const selfMonthly = n * hr * 24 * 30;                 // fixed
  const ceiling = n * tokGpu * SEC_MO;                  // max tokens/mo this rig can serve
  const satPer1M = ceiling > 0 ? (selfMonthly * 1e6) / ceiling : Infinity; // best-case self-host rate
  const beThroughput = per1M > 0 ? (hr * 1e6) / (3600 * per1M) : Infinity; // tok/s/GPU to match API
  const beTokens = perToken > 0 ? selfMonthly / perToken : Infinity;       // pure cost crossover
  const reachable = beTokens <= ceiling;               // === satPer1M <= per1M === tokGpu >= beThroughput
  const yourTokens = num("beTokens") * 1e6;
  const apiMonthly = yourTokens * perToken;

  // verdict accounts for throughput feasibility
  let vClass, vTitle, vSub;
  if (!reachable) {
    vClass = "warn"; vTitle = "API wins at any volume";
    vSub = `need ≥ ${fmtInt(beThroughput)} tok/s/GPU (you set ${fmtInt(tokGpu)})`;
  } else if (yourTokens >= beTokens) {
    vClass = "good"; vTitle = "Self-host cheaper now";
    vSub = `saturated ${fmtMoney(satPer1M)}/1M < API ${fmtMoney(per1M)}/1M`;
  } else {
    vClass = "warn"; vTitle = "API cheaper now";
    vSub = `self-host wins above ${fmtNumC(beTokens)} tok/mo`;
  }

  $("beResult").innerHTML = `
    <div class="rcard"><div class="rlabel">Self-host (fixed)</div><div class="rval">${fmtCompact(selfMonthly)}</div><div class="rsub">${n}× ${$("beGpu").value} · caps at ${fmtNumC(ceiling)} tok/mo</div></div>
    <div class="rcard"><div class="rlabel">API @ your volume</div><div class="rval">${fmtCompact(apiMonthly)}</div><div class="rsub">${num("beTokens").toLocaleString()}M × ${fmtMoney(per1M)}/1M</div></div>
    <div class="rcard ${satPer1M <= per1M ? "good" : "warn"}"><div class="rlabel">Self-host $/1M (saturated)</div><div class="rval">${fmtMoney(satPer1M)}</div><div class="rsub">best case vs API ${fmtMoney(per1M)}/1M</div></div>
    <div class="rcard accent"><div class="rlabel">Break-even throughput</div><div class="rval">${fmtInt(beThroughput)}<span style="font-size:13px"> tok/s/GPU</span></div><div class="rsub">to beat API · you set ${fmtInt(tokGpu)}</div></div>
    <div class="rcard ${vClass}"><div class="rlabel">Verdict</div><div class="rval" style="font-size:18px;line-height:1.25">${vTitle}</div><div class="rsub">${vSub}</div></div>`;

  let note = reachable
    ? `Break-even volume ${fmtNumC(beTokens)} tok/mo is within this rig's ${fmtNumC(ceiling)} tok/mo ceiling — above it, self-host wins.`
    : `⚠ Break-even volume ${fmtNumC(beTokens)} tok/mo exceeds the ${fmtNumC(ceiling)} tok/mo throughput ceiling — unreachable, so self-host can't beat the API at ${fmtInt(tokGpu)} tok/s no matter the volume. Raise throughput (quantize / spec-decode / bigger batch) or use a cheaper card.`;
  if (yourTokens > ceiling) note += ` ⚠ Your volume ${fmtNumC(yourTokens)} tok/mo exceeds capacity — you'd need ${Math.ceil(yourTokens / ceiling)}× the GPUs to serve it.`;
  $("beNote").innerHTML = note;
}

/* ============================================================
   THROUGHPUT LEVERS / BUILD-VS-BUY
   ============================================================ */
function buildLeverCards() {
  $("leverToggles").innerHTML = LEVERS.map((l) =>
    `<div class="lever toggle ${l.on ? "on" : ""}">
       <span class="rank">${l.rank}</span>
       <div class="lever-head"><input type="checkbox" id="lv${l.id}" ${l.on ? "checked" : ""}><h4>${l.name}</h4></div>
       <span class="gain">${l.gain}</span>
       ${l.ctrl ? `<div class="ctrl">${l.ctrl}</div>` : ""}
       <p>${l.desc}</p>
     </div>`
  ).join("");

  LEVERS.forEach((l) => {
    const cb = $("lv" + l.id);
    cb.addEventListener("change", () => { cb.closest(".lever").classList.toggle("on", cb.checked); renderLeverResult(); });
  });
  bindRange("lvBatchVal", "lvBatchV", (v) => "×" + (+v).toFixed(1));
  bindRange("lvSpecVal", "lvSpecV", (v) => "×" + (+v).toFixed(1));
  bindRange("lvReservedVal", "lvReservedV", (v) => "−" + v + "%");
  $("lvQuantMode").addEventListener("change", renderLeverResult);
}
function bindRange(id, dispId, fmt) {
  const e = $(id), d = $(dispId);
  if (!e || !d) return;
  e.addEventListener("input", () => { d.textContent = fmt(e.value); renderLeverResult(); });
}

function renderLeverResult() {
  const hr = num("lvHr"), n = num("lvN"), baseTok = num("lvTok") || 1;
  const inTok = num("inTok"), outTok = num("outTok");
  const base = (hr * n / 3600) / baseTok * 1e6;

  let tput = 1, vramNote = "";
  if (chk("lvBatch")) tput *= num("lvBatchVal");
  if (chk("lvSpec")) tput *= num("lvSpecVal");
  if (chk("lvQuant")) {
    const q = $("lvQuantMode").value;
    tput *= QUANT_TPUT[q];
    vramNote = q === "int4"
      ? "INT4: ~75% less VRAM (weights halved again); validate accuracy with an eval set."
      : "FP8: ~50% less VRAM (e.g. 70B weights ~140GB → fits one H200, or one H100 quantized).";
  }
  const effTok = baseTok * tput;
  const effHr = hr * n * (chk("lvReserved") ? (1 - num("lvReservedVal") / 100) : 1);
  const opt = (effHr / 3600) / effTok * 1e6;

  const m = MODELS.find((x) => x.model === $("lvModel").value) || MODELS[0];
  const managed = blendedPer1M(m);
  const save = base > 0 ? (base - opt) / base : 0;
  const selfCheaper = opt < managed;
  const gap = managed > 0 ? Math.abs(managed - opt) / managed : 0;

  $("leverResult").innerHTML = `
    <div class="rcard"><div class="rlabel">Self-host baseline $/1M</div><div class="rval">${fmtMoney(base)}</div><div class="rsub">${fmtInt(baseTok)} tok/s · ${fmtMoney(hr * n)}/hr</div></div>
    <div class="rcard accent"><div class="rlabel">Optimized $/1M</div><div class="rval">${fmtMoney(opt)}</div><div class="rsub">↓ ${(save * 100).toFixed(0)}% · effective ${fmtInt(effTok)} tok/s</div></div>
    <div class="rcard"><div class="rlabel">Managed API $/1M</div><div class="rval">${fmtMoney(managed)}</div><div class="rsub">${m.model} · blended by in/out</div></div>
    <div class="rcard ${selfCheaper ? "good" : "warn"}"><div class="rlabel">Build vs Buy</div><div class="rval" style="font-size:19px;line-height:1.25">${selfCheaper ? "Self-host" : "Managed API"} −${(gap * 100).toFixed(0)}%</div><div class="rsub">${selfCheaper ? "if GPUs stay saturated" : "no idle GPUs to pay for"}</div></div>`;

  $("leverNote").innerHTML =
    (vramNote ? "🧮 " + vramNote + "<br>" : "") +
    (chk("lvRight") ? "🎯 Right-sizing: pick the card that just fits weights + KV-cache — don't run an oversized GPU half-empty." : "");
}

/* ============================================================
   KV-CACHE
   ============================================================ */
function applyKvPreset() {
  const p = ARCH[$("kvPreset").value];
  if (!p) return;
  $("kvLayers").value = p.layers; $("kvHeads").value = p.heads;
  $("kvHeadDim").value = p.headDim; $("kvWeights").value = p.weights;
}
function renderKv() {
  const layers = num("kvLayers"), heads = num("kvHeads"), headDim = num("kvHeadDim");
  const seq = num("kvSeq"), bytes = parseFloat($("kvBytes").value), conc = num("kvConc");
  const weights = num("kvWeights");

  const kvPerReqGB = (2 * layers * heads * headDim * seq * bytes) / 1e9;
  const totalKvGB = kvPerReqGB * conc;
  const totalGB = weights + totalKvGB;

  const cards = [{ n: "A100/H100", cap: 80 }, { n: "H200", cap: 141 }, { n: "B200", cap: 192 }];
  let rec = Math.ceil(totalGB / 192) + "× B200 (>192GB, multi-GPU)";
  for (const c of cards) { if (totalGB <= c.cap) { rec = "Fits one " + c.n + " (" + c.cap + "GB)"; break; } }
  const kvBeatsWeights = totalKvGB > weights && weights > 0;

  $("kvResult").innerHTML = `
    <div class="rcard"><div class="rlabel">KV / request</div><div class="rval">${kvPerReqGB.toFixed(2)} GB</div><div class="rsub">@ ${seq.toLocaleString()} ctx</div></div>
    <div class="rcard warn"><div class="rlabel">KV total (${conc} concurrent)</div><div class="rval">${totalKvGB.toFixed(0)} GB</div><div class="rsub">${kvBeatsWeights ? "⚠ exceeds model weights" : "still below weights"}</div></div>
    <div class="rcard accent"><div class="rlabel">Total VRAM = weights + KV</div><div class="rval">${totalGB.toFixed(0)} GB</div><div class="rsub">weights ${weights}GB + KV ${totalKvGB.toFixed(0)}GB</div></div>
    <div class="rcard good"><div class="rlabel">GPU recommendation</div><div class="rval" style="font-size:18px;line-height:1.3">${rec}</div></div>`;
}

/* ============================================================
   TRAINING / FINE-TUNE
   ============================================================ */
function renderTraining() {
  const params = num("trParams"), tokensB = num("trTokens");
  const g = gpuByName($("trGpu").value);
  const n = num("trN"), mfu = num("trMfu") / 100 || 0.4, hr = num("trHr");

  const flops = 6 * params * 1e9 * tokensB * 1e9;          // 6ND
  const aggFlops = n * g.tflops * 1e12 * mfu;
  const seconds = aggFlops > 0 ? flops / aggFlops : 0;
  const hours = seconds / 3600;
  const cost = hours * n * hr;
  const pfDays = flops / (1e15 * 86400);
  const fullMemGB = params * 18;          // ~18 bytes/param (weights+grads+Adam, mixed precision)
  const loraMemGB = params * 2 * 1.2;     // ~weights + small adapter/activations

  $("trResult").innerHTML = `
    <div class="rcard"><div class="rlabel">Training compute</div><div class="rval">${pfDays.toFixed(1)}<span style="font-size:13px"> PF-days</span></div><div class="rsub">6 × ${params}B × ${tokensB}B tok</div></div>
    <div class="rcard accent"><div class="rlabel">Wall-clock time</div><div class="rval">${fmtDur(hours)}</div><div class="rsub">${fmtInt(hours * n)} GPU-hours · ${n}× ${g.gpu} @ ${(mfu * 100).toFixed(0)}% MFU</div></div>
    <div class="rcard good"><div class="rlabel">Estimated cost</div><div class="rval">${fmtCompact(cost)}</div><div class="rsub">${fmtInt(hours * n)} GPU-hr × ${fmtMoney(hr)}</div></div>
    <div class="rcard warn"><div class="rlabel">Training memory</div><div class="rval">${fmtGB(fullMemGB)}</div><div class="rsub">full FT · LoRA ≈ ${fmtGB(loraMemGB)}</div></div>`;
}

/* ============================================================
   RAG / VECTOR DB
   ============================================================ */
function renderRag() {
  const N = num("ragN"), dim = num("ragDim"), bytes = parseFloat($("ragPrec").value), overhead = num("ragOverhead") || 1;
  const chunkTok = num("ragChunkTok"), price = num("ragEmbedPrice"), topk = num("ragTopk"), queries = num("ragQueries");

  const storeGB = (N * dim * bytes * overhead) / 1e9;
  const embedCost = (N * chunkTok * price) / 1e6;        // one-time
  const addPerQuery = topk * chunkTok;                   // input tokens added each query
  const monthlyAddTokens = queries * addPerQuery;        // tokens/month

  $("ragResult").innerHTML = `
    <div class="rcard accent"><div class="rlabel">Vector store size</div><div class="rval">${fmtGB(storeGB)}</div><div class="rsub">${fmtNumC(N)} × ${dim}d × ${bytes}B × ${overhead}</div></div>
    <div class="rcard good"><div class="rlabel">Embedding cost (one-time)</div><div class="rval">${fmtCompact(embedCost)}</div><div class="rsub">${fmtNumC(N)} chunks × ${chunkTok} tok</div></div>
    <div class="rcard"><div class="rlabel">Added input / query</div><div class="rval">${fmtInt(addPerQuery)}<span style="font-size:13px"> tok</span></div><div class="rsub">top-${topk} × ${chunkTok} tok</div></div>
    <div class="rcard warn"><div class="rlabel">Monthly RAG input tokens</div><div class="rval">${fmtNumC(monthlyAddTokens)}</div><div class="rsub">feed into the Cost tab as input</div></div>`;
}

/* ============================================================
   STATIC TABLES / CHEAT SHEET
   ============================================================ */
function renderGoogle() {
  $("gSpecial").querySelector("tbody").innerHTML = GOOGLE_MODELS.map((x) =>
    `<tr><td><b>${x.m}</b></td><td>${x.cat}</td><td>${x.price}</td><td><span class="sub">${x.note}</span></td></tr>`
  ).join("");
  $("gLevers").querySelector("tbody").innerHTML = GOOGLE_LEVERS.map((x) =>
    `<tr><td><b>${x.l}</b></td><td><span class="pill tag-good">${x.v}</span></td><td><span class="sub">${x.note}</span></td></tr>`
  ).join("");
}

function renderGpu() {
  $("gpuTable").querySelector("tbody").innerHTML = GPUS.map((g) =>
    `<tr><td><b>${g.gpu}</b></td><td class="num">${g.vram}</td><td class="num">${(g.bwGBs / 1000).toFixed(2)} TB/s</td><td class="num">${fmtInt(g.tflops)}</td><td class="num">~${g.tf}×</td><td class="num">${g.price}</td><td>${g.note}</td></tr>`
  ).join("");
}

const CHEAT = [
  { t: "① Token cost", f: "monthly = req/day × days × (in·in$ + out·out$) ÷ 1e6",
    d: "100k req/day, 2k in + 500 out on Gemini Pro → $0.01/req = $30k/mo. Same on Flash ≈ $7.5k/mo. Route simple→cheap, complex→big to cut 60–70%." },
  { t: "② Token estimation", f: "tokens ≈ chars ÷ 4 ≈ words × 1.3  (English)",
    d: "Quick way to turn a document size into a token (and dollar) estimate before you have real logs." },
  { t: "③ Inference FLOPs / decode", f: "≈ 2N per output token  ·  decode tok/s ≈ HBM_BW ÷ model_bytes",
    d: "Decode is memory-bandwidth-bound: every token reads all weights once. 70B FP16 (140GB) on H100 (3.35TB/s) → ~24 tok/s single-stream." },
  { t: "④ Latency", f: "TTFT ≈ 2N·prompt ÷ (FLOPS·MFU)  ·  TPOT = 1 ÷ decode_tok/s  ·  E2E = TTFT + out·TPOT",
    d: "Prefill is compute-bound (TTFT), decode is bandwidth-bound (TPOT). Batching raises aggregate throughput, not single-request latency." },
  { t: "⑤ KV-cache", f: "KV/req = 2 × layers × kv_heads × head_dim × seq_len × bytes",
    d: "Grows linearly with concurrency AND context. At 32K it often exceeds the weights — that dictates the GPU, not param count." },
  { t: "⑥ Max concurrent batch", f: "max_batch ≈ (VRAM − weights) ÷ KV_per_request",
    d: "How many requests fit alongside the weights. This caps your real throughput on a given card." },
  { t: "⑦ Capacity (Little's Law)", f: "concurrency = QPS × latency  ·  GPUs = ⌈ QPS ÷ (QPS/GPU) ÷ util ⌉",
    d: "QPS/GPU = aggregate_tok/s ÷ out_tokens. Always leave utilization headroom for bursts." },
  { t: "⑧ Self-host $/token & break-even", f: "$/token = ($/hr ÷ 3600) ÷ tok/s  ·  break-even/mo = (#GPU·$/hr·720) ÷ $/token",
    d: "Cost-per-run beats cost-per-hour. Above the break-even volume self-host wins — below it, the per-token API wins (no idle GPUs)." },
  { t: "⑨ Training (6ND) & memory", f: "FLOPs = 6·N·D  ·  time = FLOPs ÷ (#GPU·FLOPS·MFU)  ·  full-FT mem ≈ 16–20 B/param",
    d: "Optimizer state (Adam) dominates training memory, not weights. LoRA fine-tune ≈ weights only + a tiny adapter." },
  { t: "⑩ RAG / vector DB", f: "store = vectors × dim × bytes × overhead  ·  added input/query = top-k × chunk_tokens",
    d: "1M × 1536d × 4B × 1.5 ≈ 9.2GB. And every retrieved chunk is billed as input tokens on every single query." },
  { t: "⑪ Discounts", f: "Batch API −50%  ·  cached input ~−90%  ·  reserved/committed −30~50%",
    d: "Stack these where the workload allows: async → batch; repeated prompts → cache; steady load → reserved." },
  { t: "⑫ Throughput levers", f: "batching ×2–4 · quant VRAM−50~75% · spec-decode ×2–3 · reserved −30~50%",
    d: "Ordered by bang-for-buck. Continuous batching is the free lunch; quantization needs an eval to prove accuracy held." },
];
function renderCheat() {
  $("cheatGrid").innerHTML = CHEAT.map((c) =>
    `<div class="cheat-card"><h3>${c.t}</h3><div class="formula-box" style="margin:0 0 10px 0">${c.f}</div><p>${c.d}</p></div>`
  ).join("");
}

/* ============================================================
   WIRING
   ============================================================ */
function renderAll() {
  renderCostTable();
  renderRouting();
  renderLatency();
  renderCapacity();
  renderBreakeven();
  renderLeverResult();
  renderKv();
  renderTraining();
  renderRag();
}

function init() {
  buildSelects();
  buildProviderChips();
  renderGoogle();
  renderGpu();
  renderCheat();
  buildLeverCards();
  renderAll();

  // sort handlers
  document.querySelectorAll("#costTable th[data-sort]").forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.sort;
      if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
      renderCostTable();
    };
  });

  // input listeners — token-cost inputs feed the whole page
  ["inTok", "outTok", "reqs", "days", "cacheHit", "baseline", "onlyShown"].forEach((id) => $(id).addEventListener("input", renderAll));
  ["rtSimple", "rtComplex", "rtPct"].forEach((id) => $(id).addEventListener("input", renderRouting));
  ["latParams", "latPrec", "latGpu", "latPrompt", "latOut", "latMfu"].forEach((id) => $(id).addEventListener("input", renderLatency));
  ["capQps", "capOut", "capTokGpu", "capLat", "capUtil"].forEach((id) => $(id).addEventListener("input", renderCapacity));
  ["beHr", "beN", "beModel", "beTokens", "beTokGpu"].forEach((id) => $(id).addEventListener("input", renderBreakeven));
  ["lvHr", "lvN", "lvTok", "lvModel"].forEach((id) => $(id).addEventListener("input", renderLeverResult));
  ["kvLayers", "kvHeads", "kvHeadDim", "kvSeq", "kvBytes", "kvConc", "kvWeights"].forEach((id) => $(id).addEventListener("input", renderKv));
  ["trParams", "trTokens", "trGpu", "trN", "trMfu", "trHr"].forEach((id) => $(id).addEventListener("input", renderTraining));
  ["ragN", "ragDim", "ragPrec", "ragOverhead", "ragChunkTok", "ragEmbedPrice", "ragTopk", "ragQueries"].forEach((id) => $(id).addEventListener("input", renderRag));

  // preset + GPU-select handlers
  $("kvPreset").addEventListener("change", () => { applyKvPreset(); renderKv(); });
  $("latPreset").addEventListener("change", () => { applyArchPreset("latPreset", "latParams", null); renderLatency(); });
  $("trPreset").addEventListener("change", () => { applyArchPreset("trPreset", "trParams", null); renderTraining(); });
  $("latGpu").addEventListener("change", renderLatency);
  $("beGpu").addEventListener("change", () => { const g = gpuByName($("beGpu").value); $("beHr").value = g.hr; $("beTokGpu").value = Math.round(REF_TPUT_SUSTAINED * g.tf); renderBreakeven(); });
  $("trGpu").addEventListener("change", () => { $("trHr").value = GPU_HR($("trGpu").value); renderTraining(); });
  $("lvGpu").addEventListener("change", () => { const g = gpuByName($("lvGpu").value); $("lvHr").value = g.hr; $("lvTok").value = Math.round(REF_TPUT_STATIC * g.tf); renderLeverResult(); });

  // theme toggle
  const tt = $("themeToggle");
  tt.onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "light" ? "" : "light";
    if (next) document.documentElement.setAttribute("data-theme", next);
    else document.documentElement.removeAttribute("data-theme");
    tt.textContent = next === "light" ? "☀️" : "🌙";
    try { localStorage.setItem("fde-theme", next); } catch (e) {}
  };
  try {
    if (localStorage.getItem("fde-theme") === "light") {
      document.documentElement.setAttribute("data-theme", "light"); tt.textContent = "☀️";
    }
  } catch (e) {}
}

document.addEventListener("DOMContentLoaded", init);
