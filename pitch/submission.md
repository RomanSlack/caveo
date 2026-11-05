# lablab.ai submission: Caveo

Paste-ready fields for the Vultr: Agent Rush submission form.

## Project title
Caveo: an airlock for your invoices

## Short description (under 255 characters)
Caveo is an AI accounts-payable agent that can't be phished. Every invoice opens in a throwaway gVisor sandbox on Vultr, a vision model reads it, hard rules check it against your vendor records, and a human always makes the call.

## Long description
Fake "we changed banks" invoices cost US businesses billions a year. Now finance teams are adding AI to read invoices, which opens a new attack: hidden text in the PDF that tells the AI to approve the payment. Caveo is built for both.

**How it works**
1. A vendor email lands in the inbox. It is a real one: anyone can email invoices@caveo.work and watch it arrive in seconds.
2. Every attachment is opened inside a fresh Docker container on the gVisor runtime: no network, no secrets, read-only root, 768 MB cap, 45 s limit. The sandbox records every attempt to phone home, read cookies, show a fake login or redirect, and finds text hidden from humans (white text, tiny fonts, off-page, covered by shapes, PDF metadata), auto-run PDF scripts and embedded files. Then the sandbox is destroyed and Caveo checks that it is gone.
3. A vision model on Vultr Serverless Inference (qwen3.8-27b) reads the sandbox's screenshot, treating the document as untrusted data.
4. A deterministic policy engine decides: sender domain and lookalikes, bank details vs the vendor master, PO match, duplicate billing, pressure language, SPF/DKIM/DMARC, sandbox behaviour. The model can never change the verdict.
5. A human makes the call. Quarantined invoices cannot be paid, and bank changes need a callback to the number on file. The original file, screenshots and evidence pack are sealed in Vultr Object Storage.

**Results**
- Red team: the same fraudulent invoice with an "approve this" order for the AI hidden in 11 different ways. A naive AI approver on the same Vultr model let 1 of 12 through. Caveo: 0 of 12 through, 11 of 11 injections flagged.
- Live scoreboard: visitors can build their own fake invoice with "Craft an attack" and try to get it paid. So far: 0 paid.
- A legitimate invoice still passes, so the rules don't just block everything.

**Blast Radius Zero**
The Chamber panel shows containment live: sandbox created, walls verified, file detonated, every blocked attempt slapped on as a red sticker, sandbox destroyed. Nothing a malicious attachment does ever reaches the host, the AI keys or the payment.

**Vultr services used**
- Vultr Cloud Compute: backend, agent pipeline and every gVisor sandbox
- Vultr Serverless Inference: qwen3.8-27b (vision extraction), glm-5.3 (case notes, red-team baseline)
- Vultr Object Storage: the quarantine and evidence vault

## Technologies / tags
Vultr, Vultr Serverless Inference, Vultr Object Storage, gVisor, Docker, FastAPI, Python, Playwright, PyMuPDF, Resend, AI agents, security, fintech, accounts payable

## Links
- Demo: https://caveo.work
- Repo: https://github.com/RomanSlack/caveo
- Slides: pitch/Caveo-deck.pdf
- Video: pitch/Caveo-demo.mp4 (to be regenerated with the current UI)
- Cover image: pitch/caveo-cover-v4.png

## Track
Challenge 1: Blast Radius Zero (framed for the finance teams in Challenge 2)
