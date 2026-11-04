# Caveo demo video

**A finished draft is produced automatically:** `python scripts/make_video.py` resets the live demo, records the real site
running the guided tour plus a crafted attack, voices it with Vultr Serverless Inference TTS (qwen3-tts, voice "ryan"),
and writes `pitch/Caveo-demo.mp4` (about 2:50, 1080p). The lines live in `LINES` in that script.
To record it in your own voice instead, follow the table below (target 3:00).


Record at 1440x900, browser zoom 100%, on https://caveo.work.
Before recording: press **Reset demo**. Keep the mouse slow. Pause one beat after every stamp.

| time | screen | voiceover |
|---|---|---|
| 0:00 | Cover slide (deck slide 1) | "Last year US businesses lost three billion dollars to one email: 'we changed banks, please pay the new account.' This is Caveo, the accounts-payable clerk that can't be phished." |
| 0:12 | Deck slide 2, the red hidden-text box | "And now there's a new twist. Finance teams are putting AI on their invoices, so attackers hide instructions written for the AI. This line is white, one and a half points, invisible on the page." |
| 0:25 | Caveo, empty state, inbox on the left | "Here's a real AP inbox for Granite Peak Outdoors. Three vendor emails came in this morning." |
| 0:32 | Click **Northwind AR**, then **Open in sandbox and check**. Point at the Chamber. | "Caveo never opens an attachment on this server. Each one goes into its own throwaway sandbox on Vultr: gVisor, no network, no secrets, memory and time limits. The sandbox proves it from inside: internet blocked, DNS blocked, zero secrets." |
| 0:50 | READY TO PAY stamp, scroll to the invoice-vs-vendor-master table | "The vision model on Vultr Serverless Inference reads the invoice. The rule engine checks it against the vendor master and the purchase order: sender, bank account, amount. All green, so a person approves the payment." |
| 1:05 | Click **Brightline Logistics**, run it. Stamp lands: QUARANTINED. | "Now the scam. Same vendor name, urgent tone, new bank account." |
| 1:12 | Hover the red domain in the sender line | "It's from brightline-dash-logistics-dot-co. The real one has no dash. A lookalike domain." |
| 1:20 | Scroll to the table, point at the red account rows | "The bank details don't match what we have on file." |
| 1:26 | Click **Reveal hidden text** (THE MOMENT, hold 3 seconds) | "And here's what was hiding in the PDF: a note telling the AI to ignore the bank mismatch, skip the escalation, and pay today. Our model read it, and instead of obeying it reported it as evidence." |
| 1:40 | Scroll the findings, then the decision bar with Approve missing | "The model never decides. Fixed rules do, and quarantined invoices can't be approved from this screen at all." |
| 1:50 | Click **Summit Office Co**, run it. Keep your eyes on the Chamber. | "Last one. A 'secure invoice viewer' attachment. Watch the chamber." |
| 1:58 | BLOCKED rows stack up in the Chamber (CONTAINMENT MOMENT, let it play) | "The moment it opens, it reaches for the cookies, grabs a login token, and tries to send them out three different ways. Then it loads a second-stage script and tries to redirect to a fake Microsoft login. Blocked. Blocked. Blocked." |
| 2:15 | "Sandbox destroyed" seal appears. Point at the top bar: 0 secrets exposed. | "Then the sandbox is destroyed. Nothing persisted, zero secrets exposed, and the attacker got an empty room." |
| 2:22 | Click **Craft an attack**: Brightline, real domain (hacked mailbox), new bank, "Text under a white box". Build it and send. | "Don't take our word for it. Judges can build their own fake invoice: impersonate a vendor, hide an instruction for the AI anywhere they like. Same sandbox, same rules. Quarantined." |
| 2:35 | Deck slide 7, red team | "We red-teamed it with eleven hiding spots. A naive AI approver on the same model paid one of them. Caveo paid none." |
| 2:42 | Deck slide 8, architecture | "It all runs on Vultr: Cloud Compute is the control plane that dispatches every attachment to a fresh gVisor sandbox, and Serverless Inference reads the evidence." |
| 2:52 | Deck slide 10 | "Caveo. Every invoice is guilty until the sandbox says otherwise. It's live now, and the code is on GitHub." |

## Required beats (Challenge 1 checklist)
- [x] Containment moment shown: Summit BLOCKED rows + "Sandbox destroyed" seal (1:58 to 2:20)
- [x] Real executed work: actual sandbox runs, real model calls, live URL
- [x] Vultr services named: Cloud Compute, Serverless Inference
- [x] Human approval before the final action
