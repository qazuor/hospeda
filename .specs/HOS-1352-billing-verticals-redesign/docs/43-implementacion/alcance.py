#!/usr/bin/env python3
"""Mechanical scope check for one leaf: every changed file must match the allow-list.

Reads <worktree>/.hoja/permitidas.txt (one glob per line, relative to the repo root;
blank lines and lines starting with # are ignored) and compares it with every change
in the worktree against HEAD: staged, unstaged and untracked (except .hoja/ itself).

Exit 0: everything inside the allow-list. Exit 1: prints each file outside it, with
its status (A/M/D), so the coordinator can revert it and reject the leaf.

Usage: python3 alcance.py <worktree> [<allow-list file>]
The optional second argument points to a copy of the allow-list kept OUTSIDE the
worktree, so the agent cannot widen its own scope by editing .hoja/permitidas.txt.
"""
import fnmatch
import subprocess
import sys
from pathlib import Path


def changed_files(worktree: Path) -> list[tuple[str, str]]:
    def git(*args: str) -> str:
        return subprocess.run(["git", "-C", str(worktree), *args], check=True,
                              capture_output=True, text=True).stdout
    out: dict[str, str] = {}
    for line in git("diff", "--name-status", "HEAD").splitlines():
        status, _, path = line.partition("\t")
        out[path.split("\t")[-1]] = status[0]
    for path in git("ls-files", "--others", "--exclude-standard").splitlines():
        out.setdefault(path, "A")
    return sorted((p, s) for p, s in out.items() if not p.startswith(".hoja/"))


def main() -> None:
    worktree = Path(sys.argv[1]).resolve()
    allow_file = Path(sys.argv[2]) if len(sys.argv) > 2 else worktree / ".hoja" / "permitidas.txt"
    if not allow_file.exists():
        sys.exit(f"✗ falta {allow_file}")
    globs = [g.strip() for g in allow_file.read_text().splitlines() if g.strip() and not g.startswith("#")]
    changes = changed_files(worktree)
    outside = [(p, s) for p, s in changes if not any(fnmatch.fnmatch(p, g) for g in globs)]
    print(f"cambios: {len(changes)} · fuera de alcance: {len(outside)}")
    for path, status in outside:
        print(f"  FUERA  {status}  {path}")
    sys.exit(1 if outside else 0)


if __name__ == "__main__":
    main()
