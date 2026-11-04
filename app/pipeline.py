"""The Caveo agent: email in, decision-ready case out.

  1. detonate every attachment in its own throwaway sandbox (no network, no secrets)
  2. vision model extracts invoice fields from the sandbox's screenshots (host side, untrusted-data prompt)
  3. deterministic policy engine checks vendor master, bank details, PO, sender, behavior
  4. model writes the case note; a human makes the payment decision
"""
import base64, hashlib, json, os, pathlib, uuid
import llm, policy, sandbox, store, vault

ROOT = pathlib.Path(__file__).resolve().parent.parent / "data"
RUNS = ROOT / "runs"


def load_json(name):
    return json.loads((ROOT / name).read_text())


def new_case(email):
    cid = "case-" + uuid.uuid4().hex[:8]
    store.create_case(cid, email["id"], {"email": email})
    return cid


def process(cid, email, att_dir):
    log = lambda kind, msg, data=None: store.log(cid, kind, msg, data)
    try:
        _process(cid, email, att_dir, log)
    except Exception as e:
        log("error", f"Pipeline error: {e.__class__.__name__}: {e}"[:400])
        store.update_case(cid, status="error")


def _process(cid, email, att_dir, log):
    vendors, pos = load_json("vendors.json"), load_json("purchase_orders.json")
    history = [{"case_id": c["id"], "status": c["status"], **{k: r["fields"].get(k) for k in ("po_number", "invoice_number", "total")}}
               for c in store.list_cases() if c["id"] != cid and c["decision"] in ("ready", "review", "hold")
               and c["status"] in ("awaiting_human", "approved") for r in c["data"].get("results", [])]
    log("intake", f"Email from {email['from_name']} <{email['from_email']}>: \"{email['subject']}\"",
        {"attachments": email["attachments"]})
    out_dir = RUNS / cid
    out_dir.mkdir(parents=True, exist_ok=True)
    results = []
    for att in email["attachments"]:
        digest = hashlib.sha256((att_dir / att).read_bytes()).hexdigest()  # hashing reads bytes; it never parses the file
        log("sandbox", f"Opening {att} inside a throwaway sandbox. The host never opens it.", {"sha256": digest})
        sb = sandbox.run_attachment(str(att_dir / att), log)
        rep = sb["report"] or {}
        probes = rep.get("probes", {})
        if probes:
            log("containment", "Sandbox walls verified from inside", {
                "internet": probes.get("egress"), "dns": probes.get("dns"),
                "system_write": probes.get("system_write"), "uid": probes.get("uid"),
                "secrets_visible": probes.get("secret_like_env"), "env_vars": probes.get("env_vars")})
        for n in rep.get("network_attempts", []):
            log("containment", f"BLOCKED {n['method']} {n['url'][:120]}", n)
        for b in rep.get("behaviors", []):
            if b["kind"] != "console":
                log("containment", f"Caught attachment script: {b['kind']} ({b['detail'][:80]})", b)
        for h in rep.get("hidden_text", []):
            log("detect", f"Hidden text on page {h['page']}: \"{h['text'][:90]}\"", h)
        pages = []
        for i, b64 in enumerate(rep.get("pages", [])):
            p = out_dir / f"{att}.p{i + 1}.png"
            p.write_bytes(base64.b64decode(b64))
            pages.append(f"/runs/{cid}/{p.name}")

        fields = {}
        if rep.get("pages") or rep.get("text"):
            log("model", f"Vision model reading {att} (screenshots from the sandbox, treated as untrusted data)", {"pages": pages[:1]})
            text = rep.get("text", "") + ("\n\nPDF METADATA (untrusted): " + json.dumps(rep["metadata"]) if rep.get("metadata") else "")
            ex = llm.extract_invoice(rep.get("pages", []), text, email, rep.get("hidden_text", []))
            fields = ex["fields"]
            log("model", f"Extracted fields with {ex['model']} in {ex['seconds']}s", {"fields": fields, "usage": ex["usage"]})
        verdict = policy.evaluate(email, sb, fields, vendors, pos, history)
        for f in verdict["findings"]:
            log("policy", f"[{f['severity'].upper()}] {f['title']}", f)
        slim = {k: v for k, v in rep.items() if k != "pages"}
        results.append({"attachment": att, "sha256": digest, "sandbox_id": sb["sandbox_id"], "sandbox_status": sb["status"],
                        "pages": pages, "report": slim, "fields": fields, **verdict})

    order = policy.SEV_ORDER
    worst = max(results, key=lambda r: max([order[f["severity"]] for f in r["findings"]] or [0]))
    note = llm.explain({"email": {k: email[k] for k in ("from_name", "from_email", "subject")},
                        "risk": worst["risk"], "decision": worst["decision"],
                        "findings": [{k: f[k] for k in ("severity", "title", "detail")} for f in worst["findings"]],
                        "vendor_phone_on_file": (worst.get("vendor") or {}).get("phone_on_file")})
    log("model", "Case note written", {"seconds": note["seconds"]})
    if email.get("crafted"):
        store.attack_verdict(cid, worst["decision"])
    store.update_case(cid, data={"results": results, "note": note["content"].strip()})
    if vault.enabled():
        try:
            keys = []
            flagged = worst["decision"] in ("quarantined", "hold")
            for r in results:
                raw = (att_dir / r["attachment"]).read_bytes()
                keys.append(vault.put(f"cases/{cid}/{'quarantine' if flagged else 'original'}/{r['attachment']}" + (".quarantine" if flagged else ""), raw))
                for pth in r["pages"]:
                    keys.append(vault.put(f"cases/{cid}/screens/{pth.rsplit('/', 1)[1]}", (RUNS / cid / pth.rsplit('/', 1)[1]).read_bytes(), "image/png"))
            c = store.get_case(cid)
            keys.append(vault.put_json(f"cases/{cid}/evidence.json", {"case_id": cid, "email": email, "decision": worst["decision"],
                                       "risk": worst["risk"], "note": note["content"].strip(),
                                       "attachments": [{k: r.get(k) for k in ("attachment", "sha256", "sandbox_id", "findings")} for r in results],
                                       "audit_log": c["events"]}))
            store.update_case(cid, data={"vault": keys})
            log("vault", f"Sealed {len(keys)} objects into the quarantine vault on Vultr Object Storage"
                + (" (attachment renamed .quarantine)" if flagged else ""), {"bucket": vault.BUCKET, "host": vault.HOST, "keys": keys})
        except Exception as e:
            log("vault", f"Vault upload failed: {e.__class__.__name__}")
    # only now is the case ready for a human: the evidence is already sealed, so the UI never sees a half-finished case
    log("decision", {"quarantined": "Payment BLOCKED and attachment quarantined. Security review required.",
                     "hold": "Payment ON HOLD until the vendor is verified by phone.",
                     "review": "Needs a human look before approval.",
                     "ready": "All controls passed. Waiting for a human to approve payment."}[worst["decision"]])
    store.update_case(cid, status="awaiting_human", risk=worst["risk"], decision=worst["decision"])
