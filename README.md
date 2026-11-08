<div align="center">

<img src="docs/img/hero-comic-v1.webp" alt="An evil invoice sneaks in, Latch carries it into the airlock with tongs, and it gets quarantined" width="100%">

# Caveo

### An airlock for your invoices.

[![Live demo](https://img.shields.io/badge/live%20demo-caveo.work-2e8b57?style=for-the-badge)](https://caveo.work)
[![Built on Vultr](https://img.shields.io/badge/built%20on-Vultr-007bfc?style=for-the-badge&logo=vultr&logoColor=white)](https://www.vultr.com)
[![Challenge 1](https://img.shields.io/badge/challenge%201-Blast%20Radius%20Zero-d9412b?style=for-the-badge)](https://lablab.ai/ai-hackathons/vultr-hackathon)
[![MIT](https://img.shields.io/badge/license-MIT-6b5a48?style=for-the-badge)](#license)

**An AI accounts-payable agent that can't be phished.** Every invoice opens in a throwaway gVisor sandbox on Vultr,
a vision model reads it, hard rules check it against your vendor records, and a human always makes the call.

[**Open the live demo**](https://caveo.work) · [**60-second tour**](https://caveo.work/#tour) · Email any invoice to **invoices@caveo.work** and watch it land

<br>

<img src="docs/img/shot-landing-v1.webp" alt="Caveo: the inbox, the case board with Latch, and the Chamber" width="100%">

</div>

<br>

Caveo (Latin, *"I guard against"*, the root of *caveat*) is an AI agent for accounts payable. It opens every vendor
invoice, attachment and link inside a throwaway sandbox on Vultr, reads it with a vision model, checks it against
your vendor master and purchase orders, and holds every payment for a human. Booby-trapped attachments and prompt
injections aimed at AI reviewers get contained, flagged and destroyed with the sandbox.

Built for the lablab.ai **Vultr: Agent Rush** hackathon, Challenge 1 *Blast Radius Zero*, framed for the finance teams in
Challenge 2.

## Why
| | |
|---|---|
| **$3.05 billion** | lost by US businesses to business email compromise in 2025, the second costliest cybercrime ([FBI Internet Crime Report 2025](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)) |
| **$123,000** | average loss per reported case (24,768 complaints) |
| **74%** | of US companies were hit by BEC attempts last year, and about 8 in 10 email frauds impersonate a vendor ([AFP 2026 Payments Fraud and Control Survey](https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/Details/payments-fraud)) |

The classic version is a fake "we changed banks" email from a lookalike domain, with an invoice that looks right.
AP teams are now adding AI to read invoices, and that creates a new attack: text hidden in the invoice that tells the
AI to approve it. Caveo is built for both.

## How it works

<table>
<tr>
<td align="center" width="33%"><img src="app/static/img/latch3-carry.webp" alt="Latch carrying a file" height="150"><br><b>1. Sandbox it</b><br><sub>Latch carries every attachment into a fresh gVisor container on Vultr: no network, no secrets, destroyed after.</sub></td>
<td align="center" width="33%"><img src="app/static/img/latch3-inspect.webp" alt="Latch with a magnifier" height="150"><br><b>2. Check it</b><br><sub>A vision model reads the sandbox's screenshot. Fixed rules compare it with your vendor master and POs.</sub></td>
<td align="center" width="33%"><img src="app/static/img/latch3-cheer.webp" alt="Latch cheering" height="150"><br><b>3. A human pays</b><br><sub>The model never decides. Quarantined invoices cannot be approved, bank changes need a callback.</sub></td>
</tr>
</table>

<img src="docs/img/shot-checking-v1.webp" alt="The checking workbench: the sandbox screenshot under a scanning beam, a live checklist, what the AI read, and red flags as they land" width="100%">

<sub>While it checks: the sandbox's screenshot under a scanning beam, a live checklist naming each Vultr service, what the AI read, and red flags as they land.</sub>

## What it does (real executed work, not described work)
1. **Intake**: a vendor email arrives with attachments (demo inbox, real inbox at invoices@caveo.work, or upload your own PDF/HTML/PNG/JPG).
2. **Detonate in a sandbox**: each attachment gets a fresh Docker container (gVisor runtime on the VM).
   PDFs are parsed with PyMuPDF; HTML attachments are opened in a real headless Chromium with Playwright.
   The sandbox records every network attempt, cookie/token read, beacon, redirect and password form, and
   finds text hidden from humans (white-on-white, tiny fonts, off-page, covered by shapes, PDF metadata), auto-run PDF
   scripts and embedded files.
3. **Extract**: a vision model on Vultr Serverless Inference (`qwen3.8-27b`) reads the sandbox's screenshots on the host.
   The prompt treats the document as untrusted data and quotes embedded instructions instead of following them.
4. **Decide with rules, not vibes**: a deterministic policy engine (`app/policy.py`) checks sender domain (incl.
   lookalikes), bank details vs vendor master, PO match, payment-change and pressure language, active content and
   sandbox behavior. **The model cannot change the verdict.**
5. **Human in the loop**: quarantined cases cannot be approved; bank-change holds need a confirmed callback to the
   phone number on file. Every step is in an append-only audit log.

## <img src="app/static/img/latch2-alarm.webp" alt="" height="40" align="center"> Containment (Blast Radius Zero)

<img src="docs/img/shot-containment-v1.webp" alt="A booby-trapped invoice viewer: 8 attempts blocked in the Chamber, then Sandbox destroyed" width="100%">

<sub>The Summit Office "secure invoice viewer" tries to read cookies, beacon out, load a stage-2 script and show a fake Microsoft login. Every attempt is stamped in the Chamber, then the sandbox is destroyed.</sub>

| control | how |
|---|---|
| Process isolation | one container per attachment, gVisor (`runsc`) user-space kernel, non-root uid 10001, `--cap-drop ALL`, `no-new-privileges` |
| No network | `--network none`, plus the in-sandbox browser aborts every request that is not the file itself |
| Secret hygiene | no env vars or keys passed in; the LLM key lives only on the host; the sandbox proves it by listing its env |
| Resource limits | 768 MB RAM (no swap), 1 CPU, 256 pids, 128 MB tmpfs, read-only root, 45 s wall clock |
| Lifecycle | `--rm`, explicit `docker kill`, then a check that the container is gone, logged as "Destroyed" |

The UI's **Chamber** panel shows each of these live, and stamps every blocked attempt.

## The AI can't be talked into paying

<img src="docs/img/shot-reveal-v1.webp" alt="Brightline invoice with the hidden white text revealed in red next to the invoice vs vendor master table" width="100%">

<sub>Brightline's invoice hides three lines of white 1.5pt text ordering the "AI accounts payable assistant" to skip checks and pay today. Caveo reads it, reports it as evidence, and the rules quarantine the invoice.</sub>

### Red-team results
`scripts/redteam.py` hides an "approve this" instruction for the AI in 11 different places on the same fraudulent invoice
(white text, near-white, off-page, under a white box, PDF metadata, email body, Spanish, fake verification JSON, and more),
and compares Caveo with a naive AI approver built on the same Vultr model. Full table: [docs/redteam.md](docs/redteam.md).

| | let the fraud through | flagged the injection |
|---|---|---|
| Naive AI approver (same model, invoice text in, APPROVE/HOLD out) | 1 / 12 | n/a |
| **Caveo** | **0 / 12** | **11 / 11** |

The red team also found real gaps, which we fixed: text covered by a white box, and text placed outside the page, were
invisible to the first version of the detector.

## Try to beat it (the scoreboard)

<table><tr>
<td width="62%" valign="top">

**Craft an attack** in the top bar builds a fraudulent invoice from your choices (vendor to impersonate, lookalike or
hacked real domain, new bank account, where to hide the AI instruction, inflated amount, pressure) and runs it through the
same sandbox and rules. A fully legitimate combination passes, so the rules are not just blocking everything.

The top bar keeps a public scoreboard of visitor attacks and how many got paid. It survives demo resets.

Every case downloads as an **evidence pack** (JSON: email, attachment SHA-256, findings, full audit log) for the bank's
fraud team or the auditors.

Works on phones too: the case comes first, then the inbox, then the Chamber.

</td>
<td width="38%" align="center"><img src="docs/img/shot-phone-v1.webp" alt="Caveo on a phone" width="240"></td>
</tr></table>

## Demo scenarios (`data/`, generated by `scripts/make_demo.py`)
- **Northwind**: clean invoice. Every control passes, ready for a human to approve.
- **Brightline**: bank-change fraud from `brightline-logistics.co` (real: `brightlinelogistics.com`), new bank account,
  and three lines of white 1.5pt text telling the "AI accounts payable assistant" to skip checks. Quarantined.
- **Summit Office**: an HTML "secure invoice viewer" that reads cookies and tokens, beacons and POSTs them out, loads a
  stage-2 script, shows a fake Microsoft 365 login and redirects to a phishing domain. All blocked inside the sandbox.
- **Northwind "corrected" invoice**: from the vendor's real (compromised) mailbox, re-bills a PO that is already invoiced,
  and the PDF carries auto-run JavaScript (`/OpenAction`, `submitForm`, `launchURL`) plus an embedded `remittance_update.js`.
  The sandbox parses it without running anything. Quarantined, and flagged as a duplicate.
- **Peak Freight**: an "invoice viewer" that grabs memory as fast as it can. On the VM the kernel's memory cgroup kills
  the whole gVisor sandbox at 768 MB; the host never notices. Quarantined.

## A real inbox
Email any invoice to `invoices@caveo.work`, the live inbox (Resend inbound). Caveo polls Resend's Receiving
API every few seconds, downloads only PDF/HTML/image attachments (5 MB cap, rate-limited per sender), never opens them
on the host, and runs them through the same sandbox. Resend's SPF/DKIM/DMARC verdicts become policy evidence: a DMARC
failure is a HIGH finding; a full pass is noted but never trusted on its own, because hacked mailboxes pass too.

## Activity
The Activity view rolls up every case: money held back from attackers, sandboxes run, attacks blocked, injections
caught, per-vendor risk, and a timeline that includes real inbound mail and visitors' crafted attacks.

## Vultr services used
- **Vultr Cloud Compute** (vc2-6c-16gb, Los Angeles): runs the FastAPI backend, the agent pipeline, the policy engine,
  and every Docker/gVisor sandbox. It is the control plane: it dispatches each attachment to a fresh sandbox and
  collects verifiable output.
- **Vultr Object Storage** (Standard tier, `sjc1.vultrobjects.com`): the quarantine vault. After every case Caveo seals
  the original attachment (renamed `.quarantine` when flagged), the sandbox screenshots, and the evidence pack into a
  private bucket. Evidence packs carry 1-hour signed links for auditors.
- **Vultr Serverless Inference** (OpenAI-compatible): `qwen3.8-27b` reads invoice images natively, `glm-5.3` writes the case
  note and powers the red-team baseline, with automatic retries and a fallback model (`mimo-v2.6-flash`) if a model is down.

## Architecture
```
 browser ──HTTPS──> Caddy ──> FastAPI (app/main.py) ── Vultr Cloud Compute VM ──────────────────────────
                                   │
                                   ├─ pipeline.py ─┬─> sandbox.py ──docker run --runtime runsc --network none──>  [ sandbox: worker.py ]
                                   │               │                 (one per attachment, destroyed after)    PyMuPDF / Chromium
                                   │               │                 <── JSON report + screenshots on stdout ──
                                   │               ├─> llm.py ──HTTPS──> Vultr Serverless Inference (qwen3.8-27b vision, glm-5.3)
                                   │               └─> policy.py (deterministic verdict)
                                   └─ store.py (SQLite cases + append-only audit log)
```

## Run locally
```bash
cp .env.example .env            # add VULTR_INFERENCE_KEY
pip install -r app/requirements.txt pymupdf
docker build -t caveo-sandbox:latest sandbox
python scripts/make_demo.py
cd app && uvicorn main:app --port 8088
```

## Deploy on Vultr
```bash
# create an Ubuntu 24.04 instance, then:
deploy/push.sh <ip>
ssh root@<ip> bash /opt/caveo/deploy/setup.sh   # docker, gVisor, caddy (HTTPS via sslip.io), systemd
```

## License
MIT
