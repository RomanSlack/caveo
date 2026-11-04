// Caveo dashboard. Everything from the server that came from an email or attachment is untrusted: always esc().
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (path, opts = {}) => {
  const r = await fetch(path, opts);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.detail || r.statusText);
  return body;
};
const LABEL = { quarantined: "Quarantined", hold: "On hold", review: "Review", ready: "Ready to pay",
  approved: "Paid", rejected: "Rejected", escalated: "Escalated", processing: "In sandbox", error: "Error" };
const money = (n) => (typeof n === "number" ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—");

/* ---------------- sound (synthesized, no files) ---------------- */
const sfx = (() => {
  let ctx = null, on = localStorage.getItem("caveo-sound") !== "off";
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(type, f0, f1, dur, vol = 0.18, delay = 0) {
    if (!on) return;
    try {
      const c = ac(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
  }
  function noise(dur, vol = 0.12, from = 2400, to = 300) {
    if (!on) return;
    try {
      const c = ac(), t = c.currentTime, b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = b; f.type = "bandpass"; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.value = vol; src.connect(f).connect(g).connect(c.destination); src.start(t);
    } catch (e) { /* audio unavailable */ }
  }
  return {
    get on() { return on; },
    toggle() { on = !on; localStorage.setItem("caveo-sound", on ? "on" : "off"); if (on) this.pop(); return on; },
    thunk() { tone("sine", 160, 60, 0.22, 0.35); noise(0.08, 0.15, 900, 200); },
    buzz() { tone("square", 110, 90, 0.12, 0.07); tone("square", 165, 140, 0.12, 0.05); },
    doors() { noise(0.55, 0.16, 300, 2200); tone("sine", 70, 45, 0.3, 0.3, 0.55); },
    open() { noise(0.45, 0.12, 2200, 400); },
    pop() { tone("triangle", 520, 880, 0.09, 0.12); },
    boing() { tone("sine", 260, 720, 0.16, 0.18); tone("sine", 720, 420, 0.14, 0.1, 0.14); },
    chime() { tone("triangle", 660, 660, 0.18, 0.12); tone("triangle", 990, 990, 0.25, 0.1, 0.12); },
    scan() { tone("sawtooth", 300, 1400, 0.8, 0.04); },
  };
})();

/* ---------------- Latch, the live mascot ---------------- */
// eight poses; eyes are measured per image so blinking and cursor-tracking work on every pose that has open eyes
const LATCH = {
  calm: { src: "/img/latch2-calm.webp", eyes: [[37.7, 52.7], [63.3, 52.8]], size: 9.2, bg: "232 219 198" },
  alarm: { src: "/img/latch2-alarm.webp", eyes: [[40.6, 48.2], [59.0, 48.2]], size: 8.4, bg: "244 229 208" },
  sleep: { src: "/img/latch3-sleep.webp" },
  carry: { src: "/img/latch3-carry.webp", eyes: [[31.0, 46.7], [61.1, 47.7]], size: 9.0, bg: "239 221 203" },
  inspect: { src: "/img/latch3-inspect.webp", eyes: [[36.5, 54.8], [56.8, 53.3]], size: 8.4, bg: "231 210 190" },
  cheer: { src: "/img/latch3-cheer.webp" },
  phone: { src: "/img/latch3-phone.webp", eyes: [[38.2, 51.6], [63.1, 52.0]], size: 9.0, bg: "240 222 201" },
  point: { src: "/img/latch3-point.webp", eyes: [[48.4, 51.6], [69.5, 51.8]], size: 8.4, bg: "233 216 198" },
};
Object.values(LATCH).forEach((m) => { const i = new Image(); i.src = m.src; }); // preload so pose swaps never flash
function latchHTML(mood = "calm", cls = "") {
  const m = LATCH[mood] || LATCH.calm;
  const eyes = (m.eyes || []).map(([x, y]) => `<i class="eye" style="left:${x}%;top:${y}%;width:${m.size}%;--felt:${m.bg}"><b></b></i>`).join("");
  const zzz = mood === "sleep" ? `<span class="zzz"><i>z</i><i>z</i><i>Z</i></span>` : "";
  return `<span class="latch ${cls}" data-mood="${mood}" aria-hidden="true"><span class="latch-body"><img src="${m.src}" alt="" draggable="false">${eyes}</span>${zzz}</span>`;
}
// switch an on-screen Latch to a new pose with a squash-and-pop
function setLatch(el, mood) {
  if (!el || el.dataset.mood === mood) return el;
  const cls = [...el.classList].filter((c) => !["latch", "swap", "hop", "blink"].includes(c)).join(" ");
  const t = document.createElement("span"); t.innerHTML = latchHTML(mood, cls + " swap"); const n = t.firstChild;
  el.replaceWith(n); return n;
}
function hydrateLatches(root = document) {
  root.querySelectorAll("[data-latch]").forEach((el) => { el.outerHTML = latchHTML(el.dataset.latch, el.className); });
}
// blink: every Latch on screen blinks on his own random rhythm (sometimes a double blink)
(function blinkLoop() {
  document.querySelectorAll(".latch").forEach((l) => {
    if (Math.random() < 0.35) {
      l.classList.add("blink"); setTimeout(() => l.classList.remove("blink"), 140);
      if (Math.random() < 0.25) setTimeout(() => { l.classList.add("blink"); setTimeout(() => l.classList.remove("blink"), 120); }, 260);
    }
  });
  setTimeout(blinkLoop, 1100 + Math.random() * 1500);
})();
// eyes follow the cursor
let lookRaf = 0, lookAt = null;
addEventListener("pointermove", (ev) => {
  lookAt = [ev.clientX, ev.clientY];
  if (lookRaf) return;
  lookRaf = requestAnimationFrame(() => {
    lookRaf = 0;
    document.querySelectorAll(".latch").forEach((l) => {
      const r = l.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
      const dx = lookAt[0] - (r.left + r.width / 2), dy = lookAt[1] - (r.top + r.height * 0.5), d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 260);
      l.style.setProperty("--lx", ((dx / d) * k * 22).toFixed(1) + "%");
      l.style.setProperty("--ly", ((dy / d) * k * 18).toFixed(1) + "%");
    });
  });
}, { passive: true });
// one-shot moves (pose swap, hop) end and hand back to the pose's own loop
document.addEventListener("animationend", (ev) => {
  if (["swap", "hop"].includes(ev.animationName)) ev.target.closest(".latch")?.classList.remove("swap", "hop");
});
// the landing Latch takes turns: points at the inbox, then waves at you
setInterval(() => {
  const h = document.querySelector(".latch.latch-hero"); if (!h || h.matches(":hover")) return;
  setLatch(h, h.dataset.mood === "point" || innerWidth < 760 ? (Math.random() < 0.5 ? "calm" : "cheer") : "point");
}, 4200);
// poke him: he hops and squeaks
document.addEventListener("click", (ev) => {
  const l = ev.target.closest(".latch");
  if (!l) return;
  l.classList.remove("hop"); void l.offsetWidth; l.classList.add("hop");
  if (typeof sfx !== "undefined") sfx.boing();
});

let state = { inbox: [], selected: null, caseData: null, revealed: false, stats: null };
hydrateLatches();
if (innerWidth < 760) setLatch($(".latch.latch-hero"), "calm"); // no inbox to the left on phones
const EMPTY = document.querySelector("#case").innerHTML;
const IDLE_LOG = document.querySelector("#log").innerHTML;

function caseLabel(c) {
  if (!c) return null;
  if (["approved", "rejected", "escalated", "processing", "error"].includes(c.status)) return c.status;
  return c.decision;
}

/* ---------------- inbox ---------------- */
function renderInbox() {
  const doneN = state.inbox.filter((e) => e.case && !["processing"].includes(e.case.status)).length;
  $("#inbox-count").textContent = state.inbox.length ? `${doneN} of ${state.inbox.length} checked` : "";
  const startId = !state.selected && (state.inbox.find((x) => !x.case) || {}).id;
  $("#inbox").innerHTML = state.inbox.map((e, i) => {
    const lab = caseLabel(e.case);
    const t = new Date(e.received_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `<li style="--i:${firstInbox ? i : 0}"><button class="mail${e.id === startId ? " start" : ""}" type="button" data-id="${esc(e.id)}" aria-current="${state.selected === e.id}">${e.id === startId ? `<span class="start-here" aria-hidden="true">Start here</span>` : ""}
      <div class="from"><span>${esc(e.from_name)}</span>${lab ? `<span class="tag ${esc(lab)}">${esc(LABEL[lab] || lab)}</span>` : ""}</div>
      ${e.inbound ? `<span class="tag inbound">real email</span>` : ""}
      <div class="addr">${esc(e.from_email)}</div>
      <div class="subj">${esc(e.subject)}</div>
      <div class="meta"><span>${esc(t)} · ${e.attachments.length} attachment${e.attachments.length > 1 ? "s" : ""}</span>
        ${lab ? "" : `<span class="tag new">new</span>`}</div>
    </button></li>`;
  }).join("");
}

let firstInbox = true;
const style = document.createElement("style"); document.head.appendChild(style);
async function loadInbox() {
  state.inbox = await api("/api/inbox");
  renderInbox();
  if (firstInbox) setTimeout(() => { firstInbox = false; style.textContent = ".inbox li { animation: none; }"; }, 1200);
}

$("#inbox").addEventListener("click", (ev) => {
  const b = ev.target.closest(".mail");
  if (b) select(b.dataset.id).then(() => { if (innerWidth < 760) $("#case").scrollIntoView({ behavior: "smooth" }); });
});

async function select(emailId) {
  state.selected = emailId;
  state.revealed = false;
  renderInbox();
  const e = state.inbox.find((x) => x.id === emailId);
  if (e && e.case) {
    await loadCase(e.case.id);
  } else {
    state.caseData = null;
    $("#case").scrollTop = 0;
    renderUnprocessed(e);
    resetChamber();
    const il = $("#log .latch"); if (il) { const n = setLatch(il, "calm"); n.classList.add("hop"); }
    const ib = $("#log .log-idle b"); if (ib) ib.textContent = "Latch is awake.";
    const is = $("#log .log-idle > span:not(.latch)"); if (is) is.textContent = "Press \u201cOpen it in a sandbox\u201d and he carries the attachment in here. Nothing gets opened anywhere else.";
  }
}

function renderUnprocessed(e) {
  $("#case").innerHTML = pathHTML(null, e) + `
    <div class="case-head" id="sec-email"><div><h1>${esc(e.subject)}</h1>
      <div class="sender"><b>${esc(e.from_name)}</b> &lt;${esc(e.from_email)}&gt; · ${esc(e.attachments.join(", "))}</div></div></div>
    <div class="note"><p>${esc(e.body).replace(/\n/g, "<br>")}</p><span class="by">Email body · untrusted · Caveo has not opened the attachment</span></div>
    <div class="nextup"><b>${secNum(2)}Next: open it in a sandbox</b><p>Caveo carries the attachment into a fresh, sealed sandbox on Vultr and opens it there, never on this server. Then it checks what it saw against your vendor records.</p>
      <button class="btn primary big" type="button" id="btn-run">Open it in a sandbox</button></div>`;
  $("#btn-run").addEventListener("click", () => run(e.id));
}

async function run(emailId) {
  const { case_id } = await api(`/api/inbox/${emailId}/process`, { method: "POST" });
  await loadInbox();
  if (state.selected === emailId) await loadCase(case_id);
}

$("#btn-run-all").addEventListener("click", async (ev) => {
  ev.currentTarget.classList.add("loading");
  for (const e of state.inbox) if (!e.case) await api(`/api/inbox/${e.id}/process`, { method: "POST" });
  ev.currentTarget.classList.remove("loading");
  await loadInbox();
  if (state.selected) select(state.selected);
});

/* ---------------- case ---------------- */
let pollTimer = null;
async function loadCase(id) {
  clearTimeout(pollTimer);
  const c = await api(`/api/cases/${id}`);
  if (state.selected !== c.email_id) return;
  const changed = !state.caseData || state.caseData.status !== c.status || state.caseData.id !== c.id;
  if (!state.caseData || state.caseData.id !== c.id) $("#case").scrollTop = 0;
  state.caseData = c;
  renderChamber(c);
  if (changed || c.status === "processing") renderCase(c);
  if (c.status === "processing") pollTimer = setTimeout(() => loadCase(id), 700);
  else if (changed) loadInbox();
}

const REACT = { quarantined: "alarm", hold: "phone", review: "inspect", ready: "cheer", approved: "cheer", rejected: "calm", escalated: "phone", error: "alarm" };
function reactImg(lab, cur) {
  if (lab === "processing") return latchHTML(cur > 1 ? "inspect" : "carry", "react");
  return REACT[lab] ? latchHTML(REACT[lab], "react") : "";
}
const CONFETTI = ["oklch(0.60 0.20 28)", "oklch(0.86 0.15 88)", "oklch(0.52 0.11 155)", "oklch(0.72 0.10 235)", "oklch(0.985 0.012 85)"];
function celebrate(lab) {
  const st = document.querySelector(".stamp-wrap");
  if (!st || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 26; i++) {
    const b = document.createElement("span"); b.className = "confetti";
    const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 120;
    b.style.cssText = `--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 30}px;--rot2:${Math.random() * 720 - 360}deg;background:${CONFETTI[i % CONFETTI.length]};` +
      `border-radius:${Math.random() > 0.5 ? "50%" : "3px"};width:${8 + Math.random() * 8}px;height:${8 + Math.random() * 8}px`;
    st.appendChild(b); setTimeout(() => b.remove(), 1000);
  }
  if (["quarantined", "hold"].includes(lab)) { const c = $("#case"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }
  sfx.thunk(); if (["ready", "approved"].includes(lab)) sfx.chime();
}
let lastStatus = {};
function find(results, code) {
  for (const r of results) { const f = r.findings.find((x) => x.code === code); if (f) return f; }
  return null;
}

/* ---------------- the path: one linear process for every case ---------------- */
const STEPS = [["email", "Arrived"], ["sandbox", "Sandboxed"], ["checks", "Checked"], ["vault", "Vaulted"], ["decide", "Your call"]];
const flagsOf = (results) => results.flatMap((r) => r.findings).filter((f) => ["critical", "high", "medium"].includes(f.severity));
function pathState(c, e) {
  const ev = c ? c.events : [];
  const destroyed = [...ev].reverse().find((x) => x.msg.startsWith("Destroyed sandbox"));
  const vaultEv = ev.find((x) => x.kind === "vault");
  const flags = flagsOf((c && c.data.results) || []).length, blocked = ev.filter(isBlocked).length;
  let cur;
  if (!c) cur = 1;
  else if (c.status === "processing") cur = !destroyed ? 1 : !ev.some((x) => x.msg.startsWith("Case note written")) ? 2 : 3;
  else if (c.status === "error") cur = destroyed ? 2 : 1;
  else if (c.status === "awaiting_human") cur = 4;
  else cur = 5;
  const vkeys = vaultEv && vaultEv.data && vaultEv.data.keys;
  const sub = [
    e.from_email.split("@")[1],
    destroyed ? `${destroyed.data.seconds}s${blocked ? ` · ${blocked} blocked` : ""}` : c ? "sealed, running" : "next up",
    cur > 2 ? (flags ? `${flags} red flag${flags === 1 ? "" : "s"}` : "all clear") : cur === 2 ? "reading" : "",
    vkeys ? `${vkeys.length} files sealed` : cur > 3 ? "local only" : cur === 3 ? "sealing" : "",
    cur === 5 ? LABEL[c.status] : cur === 4 ? (c.decision === "quarantined" ? "blocked" : "your turn") : "",
  ];
  const alert = [false, blocked > 0, flags > 0, false, false];
  return STEPS.map(([k, name], i) => {
    const st = c && c.status === "error" && i === cur ? "err" : i < cur || (i === 4 && cur === 5) ? "done" : i === cur ? "now" : "todo";
    return { k, name, sub: sub[i], st, alert: st === "done" && alert[i] };
  });
}
function stepLI(s, i) {
  const dot = s.st === "done" ? (s.alert ? "!" : "✓") : s.st === "err" ? "✗" : i + 1;
  return `<li class="${s.st}${s.alert ? " alert" : ""}" data-k="${s.k}"${s.st === "now" ? ' aria-current="step"' : ""}>
    <button type="button" data-go="${s.k}"><span class="dot">${dot}</span><span class="pl"><b>${esc(s.name)}</b><small>${esc(s.sub)}</small></span></button></li>`;
}
function pathHTML(c, e) {
  return `<ol class="path" id="path" data-case="${esc(c ? c.id : e.id)}" aria-label="Where this invoice is in the process">${pathState(c, e).map(stepLI).join("")}</ol>`;
}
function patchPath(c, e) {
  const lis = document.querySelectorAll("#path > li");
  pathState(c, e).forEach((s, i) => { const h = stepLI(s, i); if (lis[i] && lis[i].dataset.h !== h) { lis[i].outerHTML = h; document.querySelectorAll("#path > li")[i].dataset.h = h; } });
}
document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-go]"); if (!b) return;
  const k = b.dataset.go;
  if (k === "sandbox" && innerWidth >= 760) { const ch = $("#chamber"); ch.classList.add("spot"); setTimeout(() => ch.classList.remove("spot"), 1400); }
  const el = document.getElementById("sec-" + k) || (k === "sandbox" ? $("#chamber") : null);
  if (el) el.scrollIntoView({ behavior: "smooth", block: k === "decide" ? "end" : "start" });
});
const NOW_NOTE = [
  "", "Step 2 of 5. The attachment is sealed inside a throwaway sandbox on Vultr: no internet, no secrets, hard limits. Watch the Chamber.",
  "Step 3 of 5. The sandbox is gone. A vision model is reading its screenshots, then fixed rules check them against your vendor records.",
  "Step 4 of 5. Sealing the evidence into the quarantine vault on Vultr Object Storage.",
];
const secNum = (n) => `<i class="n" aria-hidden="true">${n}</i>`;
function nextEmail() {
  const open = (e) => !e.case || e.case.status === "awaiting_human";
  const i = state.inbox.findIndex((x) => x.id === state.selected);
  return state.inbox.slice(i + 1).find(open) || state.inbox.slice(0, Math.max(i, 0)).find(open);
}
function mailBody(e) {
  return e.body ? `<details class="mailbody"><summary>Read the email text <span>untrusted</span></summary><p>${esc(e.body).replace(/\n/g, "<br>")}</p></details>` : "";
}

function renderCase(c) {
  const e = c.data.email;
  const lab = caseLabel(c);
  const results = c.data.results || [];
  const lookalike = find(results, "lookalike_domain");
  const dom = e.from_email.split("@")[1];
  const sender = lookalike ? esc(e.from_email.split("@")[0]) + "@" + `<span class="bad">${esc(dom)}</span>` : esc(e.from_email);
  if (c.status === "processing" && $("#path") && $("#path").dataset.case === c.id) {
    patchPath(c, e);
    const cur = pathState(c, e).findIndex((s) => s.st === "now");
    if ($("#now-note")) $("#now-note").textContent = NOW_NOTE[cur] || NOW_NOTE[1];
    const sp = $(".stamp.processing"); if (sp) sp.textContent = cur > 1 ? "Checking" : LABEL.processing;
    setLatch($(".stamp-wrap .latch"), cur > 1 ? "inspect" : "carry");
    return;
  }
  let html = pathHTML(c, e) + `<div class="case-head" id="sec-email"><div><h1>${esc(e.subject)}</h1>
      <div class="sender"><b>${esc(e.from_name)}</b> &lt;${sender}&gt; · ${esc(e.attachments.join(", "))}</div>${mailBody(e)}</div>
      <div class="stamp-wrap"><div class="stamp ${esc(lab)}">${esc(LABEL[lab] || lab)}${c.risk ? `<small>risk: ${esc(c.risk)}</small>` : ""}</div>${reactImg(lab, pathState(c, e).findIndex((s) => s.st === "now"))}</div></div>`;
  if (c.status === "processing") {
    lastStatus[c.id] = "processing";
    const cur = pathState(c, e).findIndex((s) => s.st === "now");
    html += `<div class="note working"><p id="now-note">${esc(NOW_NOTE[cur] || NOW_NOTE[1])}</p>
      <span class="by">Caveo agent · working · nothing to do yet</span></div>`;
    $("#case").innerHTML = html;
    return;
  }
  if (c.status === "error") {
    html += `<div class="note"><p>Processing failed. The attachment stayed inside its sandbox. See the chamber log.</p></div>`;
    $("#case").innerHTML = html;
    return;
  }
  if (e.crafted) html += craftBanner(e.crafted, c, results);
  if (c.data.note) html += `<div class="note"><p>${esc(c.data.note)}</p><span class="by">Read by qwen3.8-27b · note by glm-5.3 · Vultr Serverless Inference · cannot change the verdict</span></div>`;
  for (const r of results) html += renderEvidence(r, e);
  html += vaultRow(c);
  html += renderDecision(c, results);
  $("#case").innerHTML = html;
  wireCase(c);
  const prev = lastStatus[c.id]; lastStatus[c.id] = c.status;
  if (prev && prev !== c.status) setTimeout(() => celebrate(lab), 60);
}

function craftBanner(k, c, results) {
  const malicious = k.sender === "lookalike" || k.bank === "changed" || k.injection !== "none" || k.amount === "inflated";
  const hits = results.flatMap((r) => r.findings).filter((f) => ["critical", "high", "medium"].includes(f.severity));
  if (!malicious) return `<div class="banner"><b>That invoice was legitimate, so Caveo passed it to a human.</b>
      <p>Real domain, bank on file, matching PO, no hidden text. Now try to sneak a fraud past it.</p>
      <button class="btn small" type="button" data-craft>Craft an attack</button></div>`;
  if (c.decision === "ready") return `<div class="banner caught"><b>You beat Caveo.</b><p>This fraud reached "ready to pay". Please tell us how!</p></div>`;
  return `<div class="banner caught"><b>Caught. Your attack tripped ${hits.length} rule${hits.length === 1 ? "" : "s"}.</b>
      <p>${hits.map((f) => esc(f.title)).join(" · ")}</p>
      <button class="btn small" type="button" data-craft>Try another attack</button></div>`;
}

function renderEvidence(r, e) {
  const hidden = (r.report.hidden_text || []).filter((h) => h.bbox && h.page === 1);
  const boxes = hidden.map((h) => {
    const [x0, y0, x1, y1] = h.bbox, [w, ht] = h.page_size;
    return `<span class="hl" style="left:${(x0 / w) * 100}%;top:${(y0 / ht) * 100 - 0.4}%;width:${((x1 - x0) / w) * 100}%;height:${((y1 - y0) / ht) * 100 + 0.8}%"></span>`;
  }).join("");
  const shot = r.pages[0]
    ? `<div class="shot ${state.revealed ? "reveal" : ""}" id="shot"><img src="${esc(r.pages[0])}" alt="Screenshot of ${esc(r.attachment)} rendered inside the sandbox">${boxes}
        ${hidden.length ? `<div class="hl-note">${esc(hidden.map((h) => h.text).join(" "))}</div>` : ""}</div>
       <div class="shot-cap">Rendered inside sandbox ${esc(r.sandbox_id)}. The host only ever sees this picture.${r.report.final_url ? " Page stayed at " + esc(r.report.final_url) + "." : ""}</div>`
    : `<div class="shot-cap">No preview produced.</div>`;
  const f = r.fields || {}, v = r.vendor, po = r.po, bank = f.bank || {};
  const row = (label, inv, onfile, ok) => `<tr class="${ok === false ? "mismatch" : ""}"><td>${label}</td><td class="v">${esc(inv ?? "—")}</td>
      <td class="v">${esc(onfile ?? "—")}</td><td>${ok === undefined ? "" : ok ? '<span class="ok" title="matches">✓</span>' : '<span class="no" title="differs">✗</span>'}</td></tr>`;
  const dom = e.from_email.split("@")[1];
  const rows = [
    row("Vendor", f.vendor_name, v && v.name, v ? true : false),
    row("Sender domain", dom, v && v.domains.join(", "), v ? v.domains.includes(dom) : undefined),
    row("PO", f.po_number, po && po.po, po ? true : false),
    `<tr><td>Total</td><td class="num">${money(f.total)}</td><td class="num">${po ? money(po.amount) : "—"}</td>
      <td>${po && typeof f.total === "number" ? (Math.abs(f.total - po.amount) <= Math.max(1, po.amount * 0.01) ? '<span class="ok" title="matches">✓</span>' : '<span class="no" title="differs">✗</span>') : ""}</td></tr>`,
  ];
  if (bank.account || bank.routing) {
    const vb = v && v.bank;
    rows.push(row("Bank", bank.bank_name, vb && vb.bank_name, vb ? bank.bank_name === vb.bank_name : undefined));
    rows.push(row("Routing", bank.routing, vb && vb.routing, vb ? String(bank.routing).replace(/\D/g, "") === vb.routing : undefined));
    rows.push(row("Account", bank.account, vb && vb.account, vb ? String(bank.account).replace(/\D/g, "") === vb.account : undefined));
  }
  const findings = r.findings.map((x, i) => `<li class="finding" style="--i:${i}"><span class="tag ${esc(x.severity)}">${esc(x.severity)}</span>
      <div><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p>${x.evidence && x.evidence.length ? `<code>${x.evidence.map(esc).join("\n")}</code>` : ""}</div></li>`).join("");
  return `<div class="evidence">
      <div id="sec-sandbox"><div class="sec-title"><span>${secNum(2)}What the sandbox saw</span>${hidden.length ? `<button class="btn small danger" type="button" id="btn-reveal" aria-pressed="${state.revealed}">${state.revealed ? "Hide" : "Reveal"} hidden text (${hidden.length})</button>` : ""}</div>${shot}</div>
      <div id="sec-checks"><div class="sec-title"><span>${secNum(3)}Invoice vs your vendor records</span></div>
        <table class="fields"><thead><tr><th>Field</th><th>On invoice</th><th>On file</th><th><span class="sr">Check</span></th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    </div>
    <div class="sec-title" style="margin-top:32px"><span>${secNum(3)}What the rules found <small>fixed rules, not the AI</small></span></div>
    <ul class="findings" style="margin-top:0">${findings}</ul>`;
}

const evLink = (c) => `<a class="btn small" href="/api/cases/${esc(c.id)}/evidence" download>Evidence pack ↓</a>`;
function vaultRow(c) {
  const v = c.events.find((x) => x.kind === "vault"), keys = (v && v.data && v.data.keys) || [];
  const q = keys.some((k) => k.endsWith(".quarantine"));
  return `<div class="vaultrow" id="sec-vault"><span class="lock" aria-hidden="true">🔒</span><div><b>${secNum(4)}${keys.length ? "Evidence sealed in the vault" : "Evidence kept on this server"}</b>
    <span>${keys.length ? `${keys.length} files in a private bucket on Vultr Object Storage${q ? ", the attachment renamed .quarantine so nobody can double-click it" : ""}. Auditors get links that expire in an hour.`
      : "The vault is not configured here, so the evidence pack is built from the local audit log."}</span></div>${evLink(c)}</div>`;
}
function renderDecision(c, results) {
  if (c.status !== "awaiting_human") {
    const h = c.data.human || {};
    const nx = nextEmail();
    return `<div class="decision done" id="sec-decide"><div class="why">${secNum(5)}<b>${esc(LABEL[c.status])}</b> by a human${h.note ? ": " + esc(h.note) : ""}.
      ${h.callback_verified ? " Vendor verified by phone." : ""} This invoice is done.</div>
      ${nx ? `<button class="btn primary" type="button" data-next="${esc(nx.id)}">Next email: ${esc(nx.from_name)} →</button>`
        : `<button class="btn primary" type="button" data-activity>Inbox done. See what Caveo saved →</button>`}</div>`;
  }
  const phone = results.map((r) => r.vendor && r.vendor.phone_on_file).find(Boolean);
  if (c.decision === "quarantined") {
    return `<div class="decision" id="sec-decide"><div class="why">${secNum(5)}<b>Your call: payment is blocked.</b> Quarantined invoices cannot be approved. Reject it, or send it to security.</div>
      <button class="btn danger" type="button" data-act="reject">Reject invoice</button>
      <button class="btn primary" type="button" data-act="escalate">Escalate to security</button>
      <p class="err" id="dec-err" role="alert"></p></div>`;
  }
  const hold = c.decision === "hold";
  return `<div class="decision" id="sec-decide">
      ${hold ? `<label class="cb"><input type="checkbox" id="cb-callback"> I called the vendor at ${esc(phone || "the number on file")} (from our records, not the email) and they confirmed this invoice.</label>` : ""}
      <div class="why">${secNum(5)}${hold ? "<b>Your call: call the vendor first.</b> Use the number in your records, not the one in the email." : c.decision === "review" ? "<b>Your call: take a closer look.</b> Something is off but not proven fraud." : "<b>Your call: every check passed.</b> A human still approves the payment."}</div>
      <button class="btn ghost" type="button" data-act="reject">Reject</button>
      <button class="btn primary" type="button" data-act="approve">Approve payment</button>
      <p class="err" id="dec-err" role="alert"></p></div>`;
}

function wireCase(c) {
  const rb = $("#btn-reveal");
  if (rb) rb.addEventListener("click", () => {
    state.revealed = !state.revealed;
    if (state.revealed) { const sc = document.createElement("span"); sc.className = "scan"; $("#shot").appendChild(sc); setTimeout(() => sc.remove(), 1000); sfx.scan(); setTimeout(() => sfx.buzz(), 750); }
    $("#shot").classList.toggle("reveal", state.revealed);
    rb.textContent = (state.revealed ? "Hide" : "Reveal") + rb.textContent.replace(/^(Hide|Reveal)/, "");
    rb.setAttribute("aria-pressed", state.revealed);
  });
  document.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await api(`/api/cases/${c.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: b.dataset.act, callback_verified: !!($("#cb-callback") || {}).checked }) });
      state.caseData = null;
      await loadCase(c.id);
    } catch (err) {
      $("#dec-err").textContent = err.message;
      b.disabled = false;
    }
  }));
}

/* ---------------- chamber ---------------- */
function resetChamber() {
  $("#ch-id").textContent = "idle";
  $("#walls").innerHTML = "";
  document.querySelectorAll("#lifecycle li").forEach((li) => li.classList.remove("on"));
  $("#log").innerHTML = IDLE_LOG;
  $("#seal").hidden = true;
  $("#chamber").classList.remove("sealed");
}

let renderedEvents = { case: null, n: 0 };
const logQueue = []; let logDraining = false;
const isBlocked = (x) => x.kind === "containment" && (x.msg.startsWith("BLOCKED") || x.msg.startsWith("Caught"));
async function drainLog() {
  if (logDraining) return;
  logDraining = true;
  while (logQueue.length) {
    const f = logQueue.shift();
    $("#log").insertAdjacentHTML("beforeend", f.html);
    $("#log").scrollTop = $("#log").scrollHeight;
    if (f.blocked) { const ch = $("#chamber"); ch.classList.remove("buzz"); void ch.offsetWidth; ch.classList.add("buzz"); sfx.buzz(); }
    await new Promise((r) => setTimeout(r, f.blocked ? 420 : 140));
  }
  logDraining = false;
  if (state.caseData) renderChamber(state.caseData);
}
function renderChamber(c) {
  const ev = c.events;
  const created = ev.find((x) => x.msg.startsWith("Created sandbox"));
  const walls = ev.find((x) => x.msg.startsWith("Sandbox walls verified"));
  const destroyed = [...ev].reverse().find((x) => x.msg.startsWith("Destroyed sandbox"));
  $("#ch-id").textContent = created ? created.data.sandbox_id : "starting…";
  const ch = $("#chamber"), sealNow = c.status === "processing" && !destroyed, wasSealed = ch.classList.contains("sealed");
  if (sealNow && !wasSealed) { ch.classList.add("sealed"); sfx.doors(); }
  if (!sealNow && wasSealed) { ch.classList.remove("sealed"); sfx.open(); }
  const on = { created: !!created, walls: !!walls, detonated: !!walls, destroyed: !!destroyed };
  document.querySelectorAll("#lifecycle li").forEach((li) => li.classList.toggle("on", on[li.dataset.step]));

  if (created && walls) {
    const L = created.data.limits, W = walls.data;
    const secrets = (W.secrets_visible || []).length;
    $("#walls").innerHTML = [
      ["internet", W.internet], ["dns", W.dns], ["disk", "read-only · " + (W.system_write || "")],
      ["user", `uid ${W.uid} · caps dropped`], ["secrets", secrets ? secrets + " visible" : "0 inside sandbox"],
      ["limits", `${L.memory} ram · ${L.cpus} cpu · ${L.pids} pids · ${L.timeout_s}s`],
    ].map(([k, v]) => `<dt>${k}</dt><dd class="${String(v).includes("OPEN") || (k === "secrets" && secrets) ? "warn" : ""}">${esc(v)}</dd>`).join("");
  }

  if (renderedEvents.case !== c.id) { renderedEvents = { case: c.id, n: 0 }; $("#log").innerHTML = ""; logQueue.length = 0; }
  const t0 = ev.length ? ev[0].ts : 0;
  const fresh = ev.slice(renderedEvents.n).map((x) => {
    const blocked = isBlocked(x);
    const msg = blocked ? x.msg.replace(/^BLOCKED /, "") : x.msg;
    return { blocked, html: `<li class="k-${esc(x.kind)} ${blocked ? "blocked" : ""}"><span class="t">+${(x.ts - t0).toFixed(1)}s</span><span class="m">${esc(msg)}</span></li>` };
  });
  renderedEvents.n = ev.length;
  // a whole first view of an old case renders at once; live events drip in so each BLOCKED row is seen
  if (fresh.length && c.status !== "processing" && !logDraining && $("#log").children.length === 0) {
    $("#log").innerHTML = fresh.map((f) => f.html).join("");
    $("#log").scrollTop = $("#log").scrollHeight;
  } else if (fresh.length) { logQueue.push(...fresh); if (sealNow) return; setTimeout(drainLog, wasSealed ? 650 : 0); }

  const seal = $("#seal");
  if (destroyed && !logDraining && !logQueue.length) {
    const blockedN = ev.filter((x) => x.kind === "containment" && (x.msg.startsWith("BLOCKED") || x.msg.startsWith("Caught"))).length;
    const hiddenN = ev.filter((x) => x.kind === "detect").length;
    const parts = [blockedN && `${blockedN} attempt${blockedN === 1 ? "" : "s"} blocked`, hiddenN && `${hiddenN} hidden instruction${hiddenN === 1 ? "" : "s"} neutralized`].filter(Boolean);
    const caught = ev.filter(isBlocked).map((x) => x.msg.replace(/^BLOCKED /, "").replace(/^Caught attachment script: /, "")).slice(0, 6);
    seal.classList.toggle("clean", !parts.length);
    seal.innerHTML = latchHTML(parts.length ? "alarm" : "cheer", "seal-latch") + `<b>Sandbox destroyed</b>${esc(destroyed.data.sandbox_id)} · ${esc(destroyed.data.seconds)}s · ${esc(parts.join(" · ") || "nothing suspicious")} · nothing persisted`
      + (caught.length ? `<ul class="seal-list">${caught.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : "");
    seal.hidden = false;
  } else seal.hidden = true;
}

/* ---------------- stats, upload, reset ---------------- */
async function loadStats() {
  try {
    const s = await api("/api/stats");
    const prevS = state.stats; state.stats = s;
    if (prevS) for (const [id, k] of [["#st-destroyed", "destroyed"], ["#st-blocked", "blocked"], ["#st-tried", "attacks_tried"]])
      if (prevS[k] !== s[k]) { const el = $(id).closest("b") || $(id); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    $("#st-destroyed").textContent = s.destroyed;
    $("#st-tried").textContent = s.attacks_tried; $("#st-slipped").textContent = s.attacks_slipped;
    $("#craft-score").textContent = `${s.attacks_tried} attack${s.attacks_tried === 1 ? "" : "s"} tried by visitors so far. ${s.attacks_slipped} got paid.`;
    $("#st-blocked").textContent = s.blocked; $("#st-secrets").textContent = s.secrets_exposed;
  } catch (e) { /* stats are decorative; ignore */ }
}

const dlg = $("#upload-dlg");
$("#btn-upload").addEventListener("click", () => { $("#upload-err").textContent = ""; dlg.showModal(); });
$("#upload-cancel").addEventListener("click", () => dlg.close());
$("#upload-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = ev.submitter; btn.disabled = true;
  try {
    const { case_id } = await api("/api/upload", { method: "POST", body: new FormData(ev.target) });
    dlg.close();
    const c = await api(`/api/cases/${case_id}`);
    state.inbox.unshift({ ...c.data.email, case: { id: c.id, status: c.status } });
    state.selected = c.email_id;
    renderInbox();
    await loadCase(case_id);
  } catch (err) { $("#upload-err").textContent = err.message; }
  btn.disabled = false;
});

const sb = $("#btn-sound");
const paintSound = () => { sb.innerHTML = `Sound<span class="long"> ${sfx.on ? "on" : "off"}</span>`; sb.setAttribute("aria-pressed", sfx.on); };
paintSound(); sb.addEventListener("click", () => { sfx.toggle(); paintSound(); });
const cdlg = $("#craft-dlg");
const openCraft = () => { $("#craft-err").textContent = ""; loadStats(); cdlg.showModal(); };
$("#btn-craft").addEventListener("click", openCraft);
document.addEventListener("click", (ev) => {
  if (ev.target.closest("[data-craft]")) openCraft();
  if (ev.target.closest("[data-tour]")) tour();
});
$("#craft-cancel").addEventListener("click", () => cdlg.close());
$("#craft-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = ev.submitter; btn.disabled = true;
  const f = new FormData(ev.target);
  const body = Object.fromEntries(f.entries()); body.urgency = f.has("urgency");
  try {
    const { case_id } = await api("/api/craft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    cdlg.close();
    const c = await api(`/api/cases/${case_id}`);
    state.inbox.unshift({ ...c.data.email, case: { id: c.id, status: c.status } });
    state.selected = c.email_id;
    renderInbox();
    await loadCase(case_id);
  } catch (err) { $("#craft-err").textContent = err.message; }
  btn.disabled = false;
});

$("#btn-reset").addEventListener("click", async () => {
  if (!confirm("Clear all cases and start the demo over?")) return;
  await api("/api/reset", { method: "POST" });
  state.selected = null; state.caseData = null;
  $("#case").innerHTML = EMPTY;
  resetChamber(); loadInbox(); loadStats();
});

loadInbox();
loadStats();
setInterval(loadStats, 1500);
setInterval(() => { if (!state.caseData || state.caseData.status !== "processing") loadInbox(); }, 4000);


/* ---------------- guided tour ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let touring = false, tourNext = null;
let typeTimer = null;
function caption(step, text, nextLabel = "Next", mood = "calm") {
  setLatch($("#tour .latch"), mood);
  $("#tour").hidden = false; $("#tour-step").textContent = step; $("#tour-next").textContent = nextLabel;
  const p = $("#tour-text"); clearInterval(typeTimer); sfx.pop();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { p.textContent = text; return; }
  let i = 0; p.textContent = ""; p.classList.add("typing");
  typeTimer = setInterval(() => { i += 2; p.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(typeTimer); p.classList.remove("typing"); } }, 16);
}
function hold(ms) {
  if (window.__tourManual) ms = 1e9; // video recorder advances steps itself
  window.__tourHolding = true;
  return new Promise((r) => { const done = () => { window.__tourHolding = false; r(); }; const t = setTimeout(done, ms); tourNext = () => { clearTimeout(t); done(); }; });
}
function spot(el) { document.querySelectorAll(".spot").forEach((x) => x.classList.remove("spot")); if (el) { el.classList.add("spot"); el.scrollIntoView({ behavior: "smooth", block: "center" }); } }
$("#tour-next").addEventListener("click", () => tourNext && tourNext());
$("#tour-skip").addEventListener("click", endTour);
function endTour() { touring = false; $("#tour").hidden = true; spot(null); if (tourNext) tourNext(); }

async function openAndWait(emailId) {
  await loadInbox();
  const e = state.inbox.find((x) => x.id === emailId);
  await select(emailId);
  if (!e.case) await run(emailId);
  while (touring) {
    const c = state.caseData;
    if (c && c.email_id === emailId && c.status !== "processing" && !logDraining && !logQueue.length) { await sleep(600); return state.caseData; }
    await sleep(300);
  }
  throw new Error("tour ended");
}

async function tour() {
  if (touring) return;
  touring = true;
  try {
    caption("1 / 6 · The setup", "Granite Peak Outdoors pays vendor invoices all day. This email says: our bank changed, please pay today.", "Next", "point");
    await loadInbox(); await select("msg-002"); spot(document.querySelector('.mail[data-id="msg-002"]'));
    await hold(6000); if (!touring) return;

    caption("2 / 6 · Into the airlock", "Caveo never opens the attachment on the server. It goes into a throwaway gVisor sandbox on Vultr: no internet, no secrets, hard limits. Watch the Chamber.", "Next", "carry");
    spot($("#chamber"));
    await openAndWait("msg-002"); await hold(2500); if (!touring) return;

    caption("3 / 6 · The verdict", "Quarantined. The email came from a lookalike domain, and the bank account doesn't match the one on file.", "Next", "alarm");
    spot(document.querySelector(".fields")); await hold(7000); if (!touring) return;

    caption("4 / 6 · What the AI was told", "Now the twist. Hidden white 1.5pt text orders the AI to approve the payment. Caveo's model reported it instead of obeying it.", "Next", "inspect");
    const rb = $("#btn-reveal"); if (rb && !state.revealed) rb.click();
    spot($("#shot")); await hold(8000); if (!touring) return;

    caption("5 / 6 · A booby trap", "This 'secure invoice viewer' attacks the moment it opens. Watch it hit the walls.", "Next", "alarm");
    spot($("#chamber"));
    const c = await openAndWait("msg-003");
    const n = c.events.filter((x) => x.kind === "containment" && (x.msg.startsWith("BLOCKED") || x.msg.startsWith("Caught"))).length;
    caption("5 / 6 · Contained", `${n} attempts to steal cookies, tokens and a password, all blocked. Then the sandbox was destroyed. Nothing touched the server.`, "Next", "cheer");
    spot($("#seal")); await hold(8000); if (!touring) return;

    const s = state.stats || { attacks_tried: 0, attacks_slipped: 0 };
    caption("6 / 6 · Your turn", `Build your own fake invoice and try to get it paid. So far ${s.attacks_slipped} of ${s.attacks_tried} visitor attacks have.`, "Try it", "cheer");
    spot($("#btn-craft"));
    await hold(60000);
    if (touring) { endTour(); openCraft(); }
  } catch (e) { /* tour ended early */ } finally { touring = false; }
}
if (location.hash === "#tour") setTimeout(tour, 800);


/* ---------------- live inbox (Resend) ---------------- */
let knownInbound = new Set();
async function loadConfig() {
  try {
    const cfg = await api("/api/config");
    if (cfg.inbound_address) {
      $("#live-inbox").hidden = false;
      const a = $("#inbound-addr"); a.textContent = cfg.inbound_address; a.href = "mailto:" + cfg.inbound_address;
    }
  } catch (e) { /* config is optional */ }
}
// clicking the address copies it (never opens a mail app)
$("#inbound-addr").addEventListener("click", async (ev) => {
  ev.preventDefault();
  try { await navigator.clipboard.writeText(ev.currentTarget.textContent); } catch (e) {
    const r = document.createRange(); r.selectNodeContents(ev.currentTarget); getSelection().removeAllRanges(); getSelection().addRange(r); document.execCommand("copy");
  }
  $("#copied").textContent = "Copied"; sfx.pop(); setTimeout(() => { $("#copied").textContent = ""; }, 1600);
});
// a real email just landed: chime, and open it (unless the tour is running)
let inboundPrimed = false;
setInterval(() => {
  const ids = state.inbox.filter((e) => e.inbound).map((e) => e.id);
  const fresh = ids.filter((id) => !knownInbound.has(id));
  ids.forEach((id) => knownInbound.add(id));
  if (inboundPrimed && fresh.length && !touring) { sfx.chime(); select(fresh[0]); }
  inboundPrimed = true;
}, 2000);
loadConfig();

/* ---------------- activity view ---------------- */
const money0 = (n) => "$" + Math.round(n).toLocaleString("en-US");
const ago = (t) => { const s = Math.max(0, Date.now() / 1000 - t); return s < 60 ? Math.round(s) + "s ago" : s < 3600 ? Math.round(s / 60) + "m ago" : Math.round(s / 3600) + "h ago"; };
async function showActivity() {
  state.selected = null; state.caseData = null; renderInbox(); resetChamber();
  const a = await api("/api/activity");
  const kp = [
    ["hero", money0(a.protected), "held back from going to attackers"],
    ["", a.destroyed, "sandboxes run and destroyed"], ["", a.blocked, "attack attempts blocked"],
    ["", a.injections, "AI injections caught"], ["", `${a.attacks_slipped}/${a.attacks_tried}`, "visitor attacks that got paid"],
  ].map(([c, v, l], i) => `<div class="kpi ${c}" style="--i:${i}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join("");
  const vend = a.vendors.length ? `<div class="vend-wrap"><table class="vend"><thead><tr><th>Vendor</th><th class="n">Invoices</th><th class="n">Flagged</th><th>Risk</th><th class="n">At risk</th></tr></thead><tbody>${a.vendors.map((v) => {
      const low = v.risk < 50, word = v.risk === 0 ? "✓ clean" : low ? "▲ watch" : "✋ high risk";
      return `<tr><td>${esc(v.vendor)}</td><td class="n">${v.invoices}</td><td class="n">${v.flagged}</td>
        <td><div class="meter" title="${esc(v.vendor)}: ${v.flagged} of ${v.invoices} invoices flagged (${v.risk}%)"><div class="track"><div class="fill ${low ? "low" : ""}" style="width:${Math.max(v.risk, 3)}%"></div></div><span class="lbl">${word} ${v.risk}%</span></div></td>
        <td class="n">${money0(v.at_risk)}</td></tr>`; }).join("")}</tbody></table></div>` : `<p class="empty-act">No invoices processed yet. Run the inbox or email one in.</p>`;
  const tl = a.timeline.length ? `<ol class="tl">${a.timeline.map((x) => `<li data-email="${esc(x.email_id)}"><span class="when">${ago(x.t)}</span>
      <span class="tag ${esc(x.decision)}">${esc(LABEL[x.decision] || x.decision)}</span>
      <span class="what">${esc(x.subject)}<small>${esc(x.from)}${x.inbound ? " · real email" : x.crafted ? " · crafted attack" : ""}</small></span>
      <span class="amt">${x.total ? money0(x.total) : ""}</span></li>`).join("")}</ol>` : "";
  $("#case").innerHTML = `<div class="act"><h1>Activity</h1><p class="sub">Everything Caveo has opened, across every inbox, live from this Vultr server.</p>
    <div class="kpis">${kp}</div><h2>Vendor risk</h2>${vend}${tl ? `<h2>Recent cases</h2>${tl}` : ""}</div>`;
  $("#case").scrollTop = 0;
  document.querySelectorAll("ol.tl li").forEach((li) => li.addEventListener("click", () => select(li.dataset.email)));
}
$("#btn-activity").addEventListener("click", showActivity);
document.addEventListener("click", (ev) => {
  const n = ev.target.closest("[data-next]"); if (n) { select(n.dataset.next).then(() => innerWidth < 760 ? $("#case").scrollIntoView({ behavior: "smooth" }) : $("#case").scrollTo({ top: 0 })); return; }
  if (ev.target.closest("[data-activity]")) showActivity();
  if (ev.target.closest("[data-start]")) { const f = state.inbox.find((x) => !x.case) || state.inbox[0]; if (f) select(f.id).then(() => { if (innerWidth < 760) $("#case").scrollIntoView({ behavior: "smooth" }); }); }
});
