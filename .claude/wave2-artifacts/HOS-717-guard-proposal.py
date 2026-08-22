#!/usr/bin/env python3
"""
Proposed guard: no module-scope dereference of a @repo/db named import.

Predicate (what it actually proves):
  For each .ts file under the scanned trees, collect the identifiers imported
  from '@repo/db' via a NAMED value import. Then flag any *module-scope*
  binding (`const`/`let`/`var` at column 0, exported or not) whose initializer
  is NOT a function/arrow/class and whose text contains `<imported>.<prop>`.

Such an initializer is evaluated at module IMPORT time, so the property access
runs the moment any consumer imports the module. Under a `vi.mock('@repo/db')`
factory that does not declare that export, Vitest throws on the named-import
binding rather than yielding `undefined`, and every test that transitively
imports the module fails to COLLECT.

Deliberately NOT flagged (these defer the access to call time):
  - initializers that are arrow functions, `function` expressions, or classes
  - anything inside a function/method body
  - type-only positions (`typeof X.y`, `X.$inferSelect`, type annotations),
    which are erased before runtime

Usage:
  python3 HOS-717-guard-proposal.py <ref>     # scan a git ref, e.g. origin/staging
  python3 HOS-717-guard-proposal.py --worktree  # scan the working tree
"""

import re
import subprocess
import sys

REPO = "/home/qazuor/projects/WEBS/hospeda2/.claude/worktrees/agent-a4923ebe51792e11d"

SCAN_PREFIXES = ("apps/", "packages/")
SKIP_MARKERS = ("/node_modules/", "/dist/", "/test/", ".test.ts", ".d.ts", "/migrations/")

IMPORT_RE = re.compile(r"import\s+(type\s+)?\{([^}]*)\}\s*from\s*['\"]@repo/db['\"]", re.S)
BINDING_RE = re.compile(r"^(export\s+)?(const|let|var)\s+(\w+)")
# an initializer that defers evaluation
LAZY_RE = re.compile(r"=\s*(async\s+)?(\(|function\b|class\b|new\s+\w+)")
ARROW_RE = re.compile(r"=>")
# type-only usages we must not flag
TYPE_NOISE_RE = re.compile(r"typeof\s+\w+\.|\.\$infer\w+")


def db_named_imports(src: str) -> set:
    names = set()
    for m in IMPORT_RE.finditer(src):
        if m.group(1):  # `import type { ... }` — erased, never runs
            continue
        for raw in m.group(2).split(","):
            raw = raw.strip()
            if not raw or raw.startswith("type "):
                continue
            names.add(raw.split(" as ")[-1].strip())
    return names


def strip_function_bodies(text: str) -> str:
    """Blank out `){...}` blocks — shorthand methods, `function(){}`, getters.

    Their contents run when CALLED, not when the module is evaluated, so a
    dereference in there is deferred and must not be flagged. Without this the
    predicate reports `const svc = { run() { return table.id; } }`, which is
    correct code — and a guard that fires on correct code is worse than none.
    """
    out = list(text)
    i, n = 0, len(text)
    while i < n:
        if text[i] == ")":
            j = i + 1
            while j < n and text[j] in " \t\r\n":
                j += 1
            if j < n and text[j] == "{":
                depth = 0
                k = j
                while k < n:
                    if text[k] == "{":
                        depth += 1
                    elif text[k] == "}":
                        depth -= 1
                        if depth == 0:
                            break
                    k += 1
                for z in range(j, min(k + 1, n)):
                    out[z] = " "
                i = k + 1
                continue
        i += 1
    return "".join(out)


def scan(path: str, src: str):
    names = db_named_imports(src)
    if not names:
        return []
    lines = src.splitlines()
    findings = []
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        m = BINDING_RE.match(line)
        if not m:
            i += 1
            continue
        # gather the full initializer by bracket depth
        depth, body, j = 0, [], i
        while j < n:
            body.append(lines[j])
            depth += lines[j].count("{") + lines[j].count("(") + lines[j].count("[")
            depth -= lines[j].count("}") + lines[j].count(")") + lines[j].count("]")
            if j > i or depth <= 0:
                if depth <= 0:
                    break
            j += 1
        text = "\n".join(body)
        head = body[0]
        deferred = bool(LAZY_RE.search(head)) or ARROW_RE.search(text)
        if not deferred:
            clean = TYPE_NOISE_RE.sub("", strip_function_bodies(text))
            for name in names:
                if re.search(rf"\b{re.escape(name)}\s*\.\s*\w", clean):
                    findings.append((i + 1, m.group(3), name, head.strip()[:90]))
                    break
        i = j + 1
    return findings


def files_at_ref(ref: str):
    out = subprocess.run(
        ["git", "-C", REPO, "ls-tree", "-r", "--name-only", ref],
        capture_output=True, text=True, check=True).stdout
    for p in out.splitlines():
        if not p.endswith(".ts"):
            continue
        if not p.startswith(SCAN_PREFIXES):
            continue
        if any(mk in ("/" + p) for mk in SKIP_MARKERS):
            continue
        yield p


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else "origin/staging"
    total_files, total_hits = 0, 0
    for p in files_at_ref(ref):
        total_files += 1
        src = subprocess.run(["git", "-C", REPO, "show", f"{ref}:{p}"],
                             capture_output=True, text=True).stdout
        for ln, binding, name, head in scan(p, src):
            total_hits += 1
            print(f"{p}:{ln}  [{binding} <- {name}]  {head}")
    print(f"\nscanned {total_files} files at {ref}; {total_hits} violation(s)")


if __name__ == "__main__":
    main()
