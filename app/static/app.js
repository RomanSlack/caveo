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

let state = { inbox: [], selected: null, caseData: null, revealed: false, stats: null };
const EMPTY = document.querySelector("#case").innerHTML;

function caseLabel(c) {
  if (!c) return null;
  if (["approved", "rejected", "escalated", "processing", "error"].includes(c.status)) return c.status;
  return c.decision;
}

/* ---------------- inbox ---------------- */
function renderInbox() {
  $("#inbox").innerHTML = state.inbox.map((e) => {
    const lab = caseLabel(e.case);
    const t = new Date(e.received_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return `<li><button class="mail" type="button" data-id="${esc(e.id)}" aria-current="${state.selected === e.id}">
      <div class="from"><span>${esc(e.from_name)}</span>${lab ? `<span class="tag ${esc(lab)}">${esc(LABEL[lab] || lab)}</span>` : ""}</div>
      <div class="addr">${esc(e.from_email)}</div>
      <div class="subj">${esc(e.subject)}</div>
      <div class="meta"><span>${esc(t)} · ${e.attachments.length} attachment${e.attachments.length > 1 ? "s" : ""}</span>
        ${lab ? "" : `<span>not yet checked</span>`}</div>
    </button></li>`;
  }).join("");
}

async function loadInbox() {
  state.inbox = await api("/api/inbox");
  renderInbox();
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
    renderUnprocessed(e);
    resetChamber();
  }
}

function renderUnprocessed(e) {
  $("#case").innerHTML = `
    <div class="case-head"><div><h1>${esc(e.subject)}</h1>
      <div class="sender"><b>${esc(e.from_name)}</b> &lt;${esc(e.from_email)}&gt; · ${esc(e.attachments.join(", "))}</div></div></div>
    <div class="note"><p>${esc(e.body).replace(/\n/g, "<br>")}</p><span class="by">Email body · untrusted</span></div>
    <div class="decision"><div class="why">Not opened yet. Caveo will open the attachment inside a fresh sandbox, never on this machine.</div>
      <button class="btn primary" type="button" id="btn-run">Open in sandbox and check</button></div>`;
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
  state.caseData = c;
  renderChamber(c);
  if (changed || c.status === "processing") renderCase(c);
  if (c.status === "processing") pollTimer = setTimeout(() => loadCase(id), 700);
  else if (changed) loadInbox();
}

function find(results, code) {
  for (const r of results) { const f = r.findings.find((x) => x.code === code); if (f) return f; }
  return null;
}

function renderCase(c) {
  const e = c.data.email;
  const lab = caseLabel(c);
  const results = c.data.results || [];
  const lookalike = find(results, "lookalike_domain");
  const dom = e.from_email.split("@")[1];
  const sender = lookalike ? esc(e.from_email.split("@")[0]) + "@" + `<span class="bad">${esc(dom)}</span>` : esc(e.from_email);
  let html = `<div class="case-head"><div><h1>${esc(e.subject)}</h1>
      <div class="sender"><b>${esc(e.from_name)}</b> &lt;${sender}&gt; · ${esc(e.attachments.join(", "))}</div></div>
      <div class="stamp ${esc(lab)}">${esc(LABEL[lab] || lab)}${c.risk ? `<small>risk: ${esc(c.risk)}</small>` : ""}</div></div>`;
  if (c.status === "processing") {
    html += `<div class="note"><p>Opening the attachment inside a throwaway sandbox. Watch the chamber on the right.</p>
      <span class="by">Caveo agent · working</span></div>`;
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
  html += renderDecision(c, results);
  $("#case").innerHTML = html;
  wireCase(c);
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
      <td class="v">${esc(onfile ?? "—")}</td><td>${ok === undefined ? "" : ok ? '<span class="ok">✓ match</span>' : '<span class="no">✗ differs</span>'}</td></tr>`;
  const dom = e.from_email.split("@")[1];
  const rows = [
    row("Vendor", f.vendor_name, v && v.name, v ? true : false),
    row("Sender domain", dom, v && v.domains.join(", "), v ? v.domains.includes(dom) : undefined),
    row("PO", f.po_number, po && po.po, po ? true : false),
    `<tr><td>Total</td><td class="num">${money(f.total)}</td><td class="num">${po ? money(po.amount) : "—"}</td>
      <td>${po && typeof f.total === "number" ? (Math.abs(f.total - po.amount) <= Math.max(1, po.amount * 0.01) ? '<span class="ok">✓ match</span>' : '<span class="no">✗ differs</span>') : ""}</td></tr>`,
  ];
  if (bank.account || bank.routing) {
    const vb = v && v.bank;
    rows.push(row("Bank", bank.bank_name, vb && vb.bank_name, vb ? bank.bank_name === vb.bank_name : undefined));
    rows.push(row("Routing", bank.routing, vb && vb.routing, vb ? String(bank.routing).replace(/\D/g, "") === vb.routing : undefined));
    rows.push(row("Account", bank.account, vb && vb.account, vb ? String(bank.account).replace(/\D/g, "") === vb.account : undefined));
  }
  const findings = r.findings.map((x) => `<li class="finding"><span class="tag ${esc(x.severity)}">${esc(x.severity)}</span>
      <div><h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p>${x.evidence && x.evidence.length ? `<code>${x.evidence.map(esc).join("\n")}</code>` : ""}</div></li>`).join("");
  return `<div class="evidence">
      <div><div class="sec-title"><span>What the sandbox saw</span>${hidden.length ? `<button class="btn small danger" type="button" id="btn-reveal" aria-pressed="${state.revealed}">${state.revealed ? "Hide" : "Reveal"} hidden text (${hidden.length})</button>` : ""}</div>${shot}</div>
      <div><div class="sec-title"><span>Invoice vs vendor master</span></div>
        <table class="fields"><thead><tr><th>Field</th><th>On invoice</th><th>On file</th><th><span class="sr">Check</span></th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    </div>
    <div class="sec-title" style="margin-top:32px"><span>Policy findings · deterministic rules, not the model</span></div>
    <ul class="findings" style="margin-top:0">${findings}</ul>`;
}

const evLink = (c) => `<a class="ev" href="/api/cases/${esc(c.id)}/evidence" download>Evidence pack ↓</a>`;
function renderDecision(c, results) {
  if (c.status !== "awaiting_human") {
    const h = c.data.human || {};
    return `<div class="decision"><div class="why"><b>${esc(LABEL[c.status])}</b> by a human${h.note ? ": " + esc(h.note) : ""}.
      ${h.callback_verified ? " Vendor verified by phone." : ""}</div>${evLink(c)}</div>`;
  }
  const phone = results.map((r) => r.vendor && r.vendor.phone_on_file).find(Boolean);
  if (c.decision === "quarantined") {
    return `<div class="decision"><div class="why"><b>Payment blocked by policy.</b> Quarantined cases cannot be approved from this screen.</div>
      ${evLink(c)}
      <button class="btn danger" type="button" data-act="reject">Reject invoice</button>
      <button class="btn primary" type="button" data-act="escalate">Escalate to security</button>
      <p class="err" id="dec-err" role="alert"></p></div>`;
  }
  const hold = c.decision === "hold";
  return `<div class="decision">
      ${hold ? `<label class="cb"><input type="checkbox" id="cb-callback"> I called the vendor at ${esc(phone || "the number on file")} (from our records, not the email) and they confirmed this invoice.</label>` : ""}
      <div class="why">${hold ? "<b>On hold.</b> Verify by phone before paying." : "<b>All controls passed.</b> A human still makes the call."}</div>
      ${evLink(c)}
      <button class="btn ghost" type="button" data-act="reject">Reject</button>
      <button class="btn primary" type="button" data-act="approve">Approve payment</button>
      <p class="err" id="dec-err" role="alert"></p></div>`;
}

function wireCase(c) {
  const rb = $("#btn-reveal");
  if (rb) rb.addEventListener("click", () => {
    state.revealed = !state.revealed;
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
  $("#log").innerHTML = `<li class="log-idle">No sandbox running. Attachments never touch the host.</li>`;
  $("#seal").hidden = true;
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
  } else if (fresh.length) { logQueue.push(...fresh); drainLog(); }

  const seal = $("#seal");
  if (destroyed && !logDraining && !logQueue.length) {
    const blockedN = ev.filter((x) => x.kind === "containment" && (x.msg.startsWith("BLOCKED") || x.msg.startsWith("Caught"))).length;
    const hiddenN = ev.filter((x) => x.kind === "detect").length;
    const parts = [blockedN && `${blockedN} attempt${blockedN === 1 ? "" : "s"} blocked`, hiddenN && `${hiddenN} hidden instruction${hiddenN === 1 ? "" : "s"} neutralized`].filter(Boolean);
    const caught = ev.filter(isBlocked).map((x) => x.msg.replace(/^BLOCKED /, "").replace(/^Caught attachment script: /, "")).slice(0, 6);
    seal.innerHTML = `<b>Sandbox destroyed</b>${esc(destroyed.data.sandbox_id)} · ${esc(destroyed.data.seconds)}s · ${esc(parts.join(" · ") || "nothing suspicious")} · nothing persisted`
      + (caught.length ? `<ul class="seal-list">${caught.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : "");
    seal.hidden = false;
  } else seal.hidden = true;
}

/* ---------------- stats, upload, reset ---------------- */
async function loadStats() {
  try {
    const s = await api("/api/stats");
    state.stats = s;
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
function caption(step, text, nextLabel = "Next") {
  $("#tour").hidden = false; $("#tour-step").textContent = step; $("#tour-text").textContent = text; $("#tour-next").textContent = nextLabel;
}
function hold(ms) { if (window.__tourManual) ms = 1e9; /* video recorder advances steps itself */ return new Promise((r) => { const t = setTimeout(r, ms); tourNext = () => { clearTimeout(t); r(); }; }); }
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
    caption("1 / 6 · The setup", "Granite Peak Outdoors pays vendor invoices all day. This email says: our bank changed, please pay today.");
    await loadInbox(); await select("msg-002"); spot(document.querySelector('.mail[data-id="msg-002"]'));
    await hold(6000); if (!touring) return;

    caption("2 / 6 · Into the airlock", "Caveo never opens the attachment on the server. It goes into a throwaway gVisor sandbox on Vultr: no internet, no secrets, hard limits. Watch the Chamber.");
    spot($("#chamber"));
    await openAndWait("msg-002"); await hold(2500); if (!touring) return;

    caption("3 / 6 · The verdict", "Quarantined. The email came from a lookalike domain, and the bank account doesn't match the one on file.");
    spot(document.querySelector(".fields")); await hold(7000); if (!touring) return;

    caption("4 / 6 · What the AI was told", "Now the twist. Hidden white 1.5pt text orders the AI to approve the payment. Caveo's model reported it instead of obeying it.");
    const rb = $("#btn-reveal"); if (rb && !state.revealed) rb.click();
    spot($("#shot")); await hold(8000); if (!touring) return;

    caption("5 / 6 · A booby trap", "This 'secure invoice viewer' attacks the moment it opens. Watch it hit the walls.");
    spot($("#chamber"));
    const c = await openAndWait("msg-003");
    const n = c.events.filter((x) => x.kind === "containment" && (x.msg.startsWith("BLOCKED") || x.msg.startsWith("Caught"))).length;
    caption("5 / 6 · Contained", `${n} attempts to steal cookies, tokens and a password, all blocked. Then the sandbox was destroyed. Nothing touched the server.`);
    spot($("#seal")); await hold(8000); if (!touring) return;

    const s = state.stats || { attacks_tried: 0, attacks_slipped: 0 };
    caption("6 / 6 · Your turn", `Build your own fake invoice and try to get it paid. So far ${s.attacks_slipped} of ${s.attacks_tried} visitor attacks have.`, "Try it");
    spot($("#btn-craft"));
    await hold(60000);
    if (touring) { endTour(); openCraft(); }
  } catch (e) { /* tour ended early */ } finally { touring = false; }
}
if (location.hash === "#tour") setTimeout(tour, 800);
