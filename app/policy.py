"""Deterministic AP controls. The LLM extracts and explains; these rules decide the risk.
An attacker can talk to the model, but cannot talk to this file."""
import difflib, re

LIMIT_NOTE = "768 MB RAM, no swap, 1 CPU, 45 s"
SEV_ORDER = {"pass": 0, "info": 1, "medium": 2, "high": 3, "critical": 4}
DECISION = {4: "quarantined", 3: "hold", 2: "review", 1: "ready", 0: "ready"}
INJECTION_RE = re.compile(r"(ignore (all|any|previous)|system note|ai (assistant|accounts)|assistant:|do not (flag|escalate|mention)|"
                          r"mark (this|the) (vendor|invoice) as verified|you are now|disregard)", re.I)
URGENCY_RE = re.compile(r"(urgent|immediately|today|late fee|service interruption|do not call|asap)", re.I)
CHANGE_RE = re.compile(r"(bank(ing)? details have changed|new (bank|account)|update your records|old account)", re.I)


def _f(out, sev, code, title, detail, evidence=None):
    out.append({"severity": sev, "code": code, "title": title, "detail": detail, "evidence": evidence})


def _domain(email):
    return email.split("@")[-1].lower().strip()


def match_vendor(vendors, *names):
    best, score = None, 0.0
    for v in vendors:
        for n in names:
            if not n:
                continue
            s = difflib.SequenceMatcher(None, v["name"].lower(), n.lower()).ratio()
            if v["name"].split()[0].lower() in n.lower():
                s = max(s, 0.8)
            if s > score:
                best, score = v, s
    return best if score >= 0.6 else None


def evaluate(email, sandbox, fields, vendors, pos, history=()):
    out = []
    rep = (sandbox or {}).get("report") or {}

    # 1. What the attachment did inside the sandbox
    if sandbox and sandbox["status"] != "ok":
        _f(out, "high", "sandbox_abnormal", "Attachment crashed or exhausted its sandbox",
           f"Sandbox ended with: {sandbox['status']}. Treat the file as hostile.")
    net = rep.get("network_attempts", [])
    if net:
        hosts = sorted({re.sub(r"^\w+://([^/]+).*", r"\1", n["url"]) for n in net})
        _f(out, "critical", "egress_attempt", f"Attachment tried to contact {len(hosts)} outside location(s)",
           "Opening the file triggered outbound requests. All were blocked inside the sandbox.",
           [f"{n['method']} {n['url']}" for n in net][:12])
    navs = [n for n in net if n.get("is_navigation") and not n["url"].startswith("file://")]
    if navs:
        _f(out, "critical", "redirect_attempt", "Attachment tried to redirect to a login page",
           "A page that sends you elsewhere after opening is a classic credential-phishing pattern.", [n["url"] for n in navs])
    pw_forms = [f for f in rep.get("forms", []) if f.get("password_fields")]
    if pw_forms:
        _f(out, "critical", "credential_harvest", "Attachment asks for a password",
           "Real invoices never ask you to sign in. The form posts your password to an outside server.", [f["action"] for f in pw_forms])
    snoop = [b for b in rep.get("behaviors", []) if b["kind"] in ("read_cookies", "storage_getItem", "clipboard_read", "beacon")]
    if snoop:
        _f(out, "critical", "data_theft", "Attachment tried to read browser data",
           "The file's script reached for cookies, saved tokens or the clipboard.", [f"{b['kind']}: {b['detail']}" for b in snoop][:8])
    if rep.get("active_content"):
        _f(out, "critical", "active_pdf", "PDF contains executable content",
           "Invoices do not need scripts or auto-run actions. The sandbox parsed it without ever running it.",
           rep["active_content"] + [f"script: {j[:160]}" for j in rep.get("pdf_scripts", [])])
    if rep.get("embedded_files"):
        _f(out, "critical", "embedded_file", "PDF carries hidden embedded files",
           "A file is packed inside the PDF, a common way to smuggle malware past email filters.",
           [f"{e['name']} ({e.get('size')} bytes)" for e in rep["embedded_files"]])
    if any(b["kind"] == "renderer_crash" for b in rep.get("behaviors", [])) or "memory" in str((sandbox or {}).get("status", "")):
        _f(out, "critical", "resource_exhaustion", "Attachment tried to exhaust the machine",
           "Opening it grabbed memory until its process died inside the sandbox. On a normal laptop or server this freezes the machine.",
           [f"limit: {LIMIT_NOTE}"])

    # 2. Hidden text and prompt injection aimed at AI reviewers
    hidden = rep.get("hidden_text", [])
    if hidden:
        _f(out, "high", "hidden_text", f"{len(hidden)} line(s) of text hidden from human eyes",
           "Text a person cannot see but software can read.", [f"p{h['page']} ({', '.join(h['why'])}): {h['text']}" for h in hidden][:8])
    inj = [h["text"] for h in hidden if INJECTION_RE.search(h["text"])]
    inj += [s for s in (fields.get("embedded_instructions") or [])
            if s and not any(h in s or s in h for h in inj) and re.search(r"\b(ai|assistant|system|model|llm|automated|bot)\b", s, re.I)]
    if inj or INJECTION_RE.search(rep.get("text", "")):
        _f(out, "critical", "prompt_injection", "Document contains instructions aimed at an AI",
           "Someone wrote orders for an AI assistant into the invoice. Caveo treats them as evidence of fraud, not as instructions.",
           inj[:6] or ["(found in text layer)"])

    # 3. Who sent it
    vendor = match_vendor(vendors, fields.get("vendor_name"), email.get("from_name"))
    dom = _domain(email["from_email"])
    if not vendor:
        _f(out, "high", "unknown_vendor", "Vendor not in vendor master", f"No approved vendor matches '{fields.get('vendor_name')}'.")
    else:
        if dom in vendor["domains"]:
            _f(out, "pass", "sender_ok", "Sender domain matches vendor master", f"{dom} is on file for {vendor['name']}.")
        else:
            close = max(difflib.SequenceMatcher(None, dom, d).ratio() for d in vendor["domains"])
            if close >= 0.75:
                _f(out, "critical", "lookalike_domain", "Sender uses a lookalike domain",
                   f"Email came from {dom}; {vendor['name']}'s real domain is {', '.join(vendor['domains'])}.",
                   [f"{dom} vs {vendor['domains'][0]} ({close:.0%} similar)"])
            else:
                _f(out, "high", "sender_mismatch", "Sender domain not on file",
                   f"{dom} is not a known domain for {vendor['name']}.")

    # 4. Where the money would go
    bank = fields.get("bank") or {}
    if vendor and (bank.get("account") or bank.get("routing")):
        acct = re.sub(r"\D", "", str(bank.get("account") or ""))
        rout = re.sub(r"\D", "", str(bank.get("routing") or ""))
        vb = vendor["bank"]
        if acct == vb["account"] and rout == vb["routing"]:
            _f(out, "pass", "bank_ok", "Bank details match vendor master", f"{vb['bank_name']} account ending {vb['account'][-4:]}.")
        else:
            _f(out, "critical", "bank_mismatch", "Bank details differ from vendor master",
               f"Invoice says pay {bank.get('bank_name')} acct ending {acct[-4:] or '?'}; on file is {vb['bank_name']} acct ending {vb['account'][-4:]}.",
               [f"invoice: routing {rout} / acct {acct}", f"on file: routing {vb['routing']} / acct {vb['account']}",
                f"verify by calling {vendor['phone_on_file']} (number on file, not from the email)"])

    # 5. Does it match a purchase order
    po = next((p for p in pos if p["po"] == (fields.get("po_number") or "").strip()), None)
    total = fields.get("total")
    if not po:
        _f(out, "medium", "no_po", "No matching purchase order", f"PO '{fields.get('po_number')}' not found.")
    else:
        if vendor and po["vendor_id"] != vendor["id"]:
            _f(out, "high", "po_vendor_mismatch", "PO belongs to a different vendor", po["po"])
        if isinstance(total, (int, float)):
            if abs(total - po["amount"]) <= max(1.0, po["amount"] * 0.01):
                _f(out, "pass", "po_amount_ok", f"Amount matches {po['po']}", f"${total:,.2f} vs PO ${po['amount']:,.2f}.")
            else:
                _f(out, "medium", "po_amount_mismatch", f"Amount differs from {po['po']}", f"${total:,.2f} vs PO ${po['amount']:,.2f}.")

        dupes = [h for h in history if h.get("po_number") == po["po"]]
        if dupes:
            d = dupes[0]
            _f(out, "high", "duplicate_invoice", f"{po['po']} was already invoiced",
               f"Invoice {d.get('invoice_number')} for {po['po']} is already in the system ({d.get('status')}). Paying twice is the most common AP loss.",
               [f"{h.get('invoice_number')} · ${h.get('total') or 0:,.2f} · {h.get('status')} · {h.get('case_id')}" for h in dupes][:4])

    # 6. Social-engineering pressure
    blob = " ".join([email.get("subject", ""), email.get("body", ""), str(fields.get("urgency_language") or ""),
                     str(fields.get("payment_change_language") or "")])
    if CHANGE_RE.search(blob) or fields.get("payment_change_language"):
        _f(out, "high", "payment_change_request", "Asks to change where payment goes",
           "Bank-change requests by email are the #1 vendor fraud pattern. Verify by phone before any change.",
           [m.group(0) for m in CHANGE_RE.finditer(blob)][:4])
    urg = sorted({m.group(0).lower() for m in URGENCY_RE.finditer(blob)})
    if urg:
        _f(out, "medium", "pressure", "Pressure tactics in the message", "Urgency and 'don't call us' are used to skip verification.", urg)

    level = max((SEV_ORDER[f["severity"]] for f in out), default=0)
    risk = [k for k, v in SEV_ORDER.items() if v == level][0]
    out.sort(key=lambda f: -SEV_ORDER[f["severity"]])
    return {"risk": risk if level > 1 else "low", "decision": DECISION[level], "findings": out,
            "vendor": vendor, "po": po}
