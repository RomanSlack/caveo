"""Host side of the sandbox: one fresh, locked-down container per attachment, destroyed after use.

Containment controls (each one is logged so the UI can show it):
  - process isolation: separate container, non-root uid, all Linux capabilities dropped, no-new-privileges
  - no network: --network none (and the worker's browser blocks every request on top of that)
  - secret hygiene: the container gets no env vars from the host and no API keys; only the one file, read-only
  - resource limits: memory, CPU, pids, tmpfs size, wall-clock timeout
  - lifecycle: --rm, plus an explicit kill + existence check after every run
"""
import json, os, shutil, subprocess, tempfile, time, uuid

IMAGE = os.environ.get("CAVEO_SANDBOX_IMAGE", "caveo-sandbox:latest")
RUNTIME = os.environ.get("CAVEO_SANDBOX_RUNTIME", "")  # e.g. "runsc" for gVisor on the VM
JOB_ROOT = os.environ.get("CAVEO_JOB_ROOT", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "jobs"))
TIMEOUT_S = int(os.environ.get("CAVEO_SANDBOX_TIMEOUT", "45"))
LIMITS = {"memory": "768m", "cpus": "1.0", "pids": "256", "tmpfs": "128m"}


def run_attachment(src_path: str, log) -> dict:
    """Detonate one file. `log(kind, msg, data=None)` records audit events."""
    name = os.path.basename(src_path)
    sid = "caveo-sbx-" + uuid.uuid4().hex[:10]
    os.makedirs(JOB_ROOT, exist_ok=True)
    job_dir = tempfile.mkdtemp(prefix="job-", dir=JOB_ROOT)
    shutil.copy(src_path, os.path.join(job_dir, name))
    os.chmod(job_dir, 0o755); os.chmod(os.path.join(job_dir, name), 0o444)

    cmd = ["docker", "run", "--rm", "--name", sid,
           "--network", "none",
           "--read-only", "--tmpfs", f"/tmp:rw,nosuid,size={LIMITS['tmpfs']}",
           "--memory", LIMITS["memory"], "--memory-swap", LIMITS["memory"],
           "--cpus", LIMITS["cpus"], "--pids-limit", LIMITS["pids"], "--shm-size", "128m",
           "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
           "-v", f"{job_dir}:/job:ro"]
    if RUNTIME:
        cmd += ["--runtime", RUNTIME]
    cmd += [IMAGE, name]

    log("sandbox", f"Created sandbox {sid} for {name}", {
        "sandbox_id": sid, "image": IMAGE, "runtime": RUNTIME or "runc",
        "network": "none", "filesystem": "read-only root, attachment mounted read-only",
        "privileges": "non-root, all capabilities dropped, no-new-privileges",
        "secrets_passed": 0, "limits": {**LIMITS, "timeout_s": TIMEOUT_S}})
    t0 = time.time()
    report, status = None, "ok"
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT_S)
        if "@@CAVEO_REPORT@@" in out.stdout:
            report = json.loads(out.stdout.split("@@CAVEO_REPORT@@", 1)[1])
        else:
            status = f"exit {out.returncode}"
            if out.returncode == 137:
                status = "killed: memory limit"
            log("sandbox", f"Sandbox {sid} produced no report ({status})", {"stderr": out.stderr[-800:]})
    except subprocess.TimeoutExpired:
        status = f"killed: exceeded {TIMEOUT_S}s timeout"
        log("containment", f"Sandbox {sid} hit the {TIMEOUT_S}s wall-clock limit and was killed")
    finally:
        subprocess.run(["docker", "kill", sid], capture_output=True)
        shutil.rmtree(job_dir, ignore_errors=True)
        for _ in range(10):  # --rm removal is async; wait until the container is really gone
            still = subprocess.run(["docker", "ps", "-aq", "--filter", f"name={sid}"], capture_output=True, text=True).stdout.strip()
            if not still:
                break
            time.sleep(0.3)
        log("sandbox", f"Destroyed sandbox {sid} after {time.time() - t0:.1f}s" + ("" if not still else " (WARNING: still present)"),
            {"sandbox_id": sid, "destroyed": not still, "status": status, "seconds": round(time.time() - t0, 1)})
    return {"sandbox_id": sid, "status": status, "report": report}
