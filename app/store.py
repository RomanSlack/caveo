"""Tiny SQLite store: cases and an append-only audit log."""
import json, os, sqlite3, threading, time

DB = os.environ.get("CAVEO_DB", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "caveo.db"))
_lock = threading.Lock()


def _conn():
    c = sqlite3.connect(DB, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def init():
    with _lock, _conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, email_id TEXT, created REAL, status TEXT,
                                          risk TEXT, decision TEXT, data TEXT);
        CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, ts REAL,
                                           kind TEXT, msg TEXT, data TEXT);""")


def create_case(cid, email_id, data):
    with _lock, _conn() as c:
        c.execute("INSERT INTO cases VALUES (?,?,?,?,?,?,?)", (cid, email_id, time.time(), "processing", None, None, json.dumps(data)))


def update_case(cid, **kw):
    with _lock, _conn() as c:
        row = c.execute("SELECT data FROM cases WHERE id=?", (cid,)).fetchone()
        data = json.loads(row["data"])
        data.update(kw.pop("data", {}))
        sets = {"data": json.dumps(data), **kw}
        c.execute(f"UPDATE cases SET {', '.join(k + '=?' for k in sets)} WHERE id=?", (*sets.values(), cid))


def log(cid, kind, msg, data=None):
    with _lock, _conn() as c:
        c.execute("INSERT INTO events (case_id, ts, kind, msg, data) VALUES (?,?,?,?,?)",
                  (cid, time.time(), kind, msg, json.dumps(data) if data is not None else None))


def _case(row):
    d = dict(row); d["data"] = json.loads(d["data"]); return d


def get_case(cid):
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM cases WHERE id=?", (cid,)).fetchone()
        if not row:
            return None
        case = _case(row)
        case["events"] = [{**dict(e), "data": json.loads(e["data"]) if e["data"] else None}
                          for e in c.execute("SELECT * FROM events WHERE case_id=? ORDER BY id", (cid,))]
        return case


def list_cases():
    with _lock, _conn() as c:
        return [_case(r) for r in c.execute("SELECT * FROM cases ORDER BY created DESC")]


def reset():
    with _lock, _conn() as c:
        c.executescript("DELETE FROM cases; DELETE FROM events;")


def stats():
    with _lock, _conn() as c:
        q = lambda sql: c.execute(sql).fetchone()[0]
        secrets = 0
        for (d,) in c.execute("SELECT data FROM events WHERE msg LIKE 'Sandbox walls verified%'"):
            secrets += len((json.loads(d) or {}).get("secrets_visible") or [])
        return {"destroyed": q("SELECT COUNT(*) FROM events WHERE msg LIKE 'Destroyed sandbox%'"),
                "blocked": q("SELECT COUNT(*) FROM events WHERE kind='containment' AND (msg LIKE 'BLOCKED%' OR msg LIKE 'Caught%')"),
                "secrets_exposed": secrets}
