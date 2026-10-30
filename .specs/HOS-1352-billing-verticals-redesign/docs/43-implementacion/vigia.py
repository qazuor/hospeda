#!/usr/bin/env python3
"""Watchdog for one running implementer agent. It does not trust the agent.

Every minute it looks at the worktree and the agent's process, and stops early when:
  - a file outside .hoja/permitidas.txt changes   -> exit 2 (FUERA DE ALCANCE)
  - nothing changed in the worktree for --idle min -> exit 3 (QUIETO: colgado o en loop)
  - the run exceeded --tope minutes                -> exit 4 (TOPE)
  - the agent process ended                        -> exit 0 (TERMINÓ)
With --matar it kills the agent's process group on 2, 3 and 4.

Every --cada minutes it appends one status line to <worktree>/.hoja/vigia.log and prints it:
time, elapsed, files changed so far, minutes since the last change, the agent's last
line in .hoja/progreso.md, and CPU of the process. Anyone can `tail -f` that log.

Usage: python3 vigia.py <worktree> <pid> [--tope 90] [--idle 20] [--cada 5] [--matar]
"""
import argparse
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent


def alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def cpu(pid: int) -> str:
    out = subprocess.run(["ps", "-o", "pcpu=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return out or "-"


def changes(worktree: Path) -> list[str]:
    def git(*a: str) -> list[str]:
        return subprocess.run(["git", "-C", str(worktree), *a], capture_output=True, text=True).stdout.splitlines()
    files = {l.split("\t")[-1] for l in git("diff", "--name-only", "HEAD")}
    files |= set(git("ls-files", "--others", "--exclude-standard"))
    return sorted(f for f in files if not f.startswith(".hoja/"))


def newest_mtime(worktree: Path, files: list[str]) -> float:
    times = [(worktree / f).stat().st_mtime for f in files if (worktree / f).exists()]
    return max(times, default=0.0)


def last_progress(worktree: Path) -> str:
    p = worktree / ".hoja" / "progreso.md"
    lines = [l.strip() for l in p.read_text().splitlines() if l.strip()] if p.exists() else []
    return lines[-1][:160] if lines else "(sin progreso escrito)"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("worktree"); ap.add_argument("pid", type=int)
    ap.add_argument("--tope", type=int, default=90); ap.add_argument("--idle", type=int, default=20)
    ap.add_argument("--cada", type=int, default=5); ap.add_argument("--matar", action="store_true")
    a = ap.parse_args()
    wt = Path(a.worktree).resolve(); log = wt / ".hoja" / "vigia.log"; log.parent.mkdir(exist_ok=True)
    start = last_change = time.time(); seen: set[str] = set(); last_report = 0.0
    # Fail closed: no allow-list means no run. Snapshot it OUTSIDE the worktree so the
    # agent cannot widen its own scope; any edit to the in-tree copy is a violation.
    allow_in_tree = wt / ".hoja" / "permitidas.txt"
    if not allow_in_tree.exists():
        print("✗ falta .hoja/permitidas.txt: no se vigila sin lista blanca", file=sys.stderr)
        sys.exit(2)
    allow_text = allow_in_tree.read_text()
    snapshot = Path(tempfile.mkstemp(prefix="vigia-permitidas-", suffix=".txt")[1])
    snapshot.write_text(allow_text)
    own_pgid = os.getpgid(0)

    def emit(msg: str) -> None:
        line = f"[{time.strftime('%H:%M')}] {msg}"
        print(line, flush=True)
        with log.open("a") as fh:
            fh.write(line + "\n")

    def stop(code: int, why: str) -> None:
        emit(why)
        if a.matar and code in (2, 3, 4) and alive(a.pid):
            try:
                pgid = os.getpgid(a.pid)
                # Never take down our own process group (the coordinator lives there).
                if pgid != own_pgid:
                    os.killpg(pgid, signal.SIGTERM)
                else:
                    os.kill(a.pid, signal.SIGTERM)
            except OSError:
                os.kill(a.pid, signal.SIGTERM)
            emit(f"proceso {a.pid} terminado por el vigía")
        sys.exit(code)

    emit(f"vigilando pid {a.pid} en {wt} · tope {a.tope} min · quieto {a.idle} min")
    while True:
        now = time.time()
        files = changes(wt)
        if set(files) != seen or newest_mtime(wt, files) > last_change:
            last_change = max(now if set(files) != seen else last_change, newest_mtime(wt, files))
            seen = set(files)
        if not allow_in_tree.exists() or allow_in_tree.read_text() != allow_text:
            stop(2, "FUERA DE ALCANCE: el agente modificó o borró .hoja/permitidas.txt")
        # argv list, no shell: wt and snapshot are operator-supplied paths to a local worktree, not untrusted input
        # nosemgrep: python.lang.security.audit.dangerous-subprocess-use-tainted-env-args.dangerous-subprocess-use-tainted-env-args
        r = subprocess.run([sys.executable, str(HERE / "alcance.py"), str(wt), str(snapshot)],
                           capture_output=True, text=True)
        if r.returncode != 0:  # any failure of the check counts as a violation (fail closed)
            stop(2, "FUERA DE ALCANCE (o el chequeo falló)\n" + (r.stdout + r.stderr).strip())
        if not alive(a.pid):
            stop(0, f"TERMINÓ · {len(files)} archivos cambiados · último progreso: {last_progress(wt)}")
        elapsed = (now - start) / 60; quiet = (now - last_change) / 60
        if elapsed > a.tope:
            stop(4, f"TOPE de {a.tope} min alcanzado · último progreso: {last_progress(wt)}")
        if quiet > a.idle:
            stop(3, f"QUIETO hace {quiet:.0f} min · cpu {cpu(a.pid)}% · último progreso: {last_progress(wt)}")
        if now - last_report >= a.cada * 60:
            emit(f"{elapsed:.0f} min · {len(files)} archivos · último cambio hace {quiet:.0f} min · "
                 f"cpu {cpu(a.pid)}% · {last_progress(wt)}")
            last_report = now
        time.sleep(60)


if __name__ == "__main__":
    main()
