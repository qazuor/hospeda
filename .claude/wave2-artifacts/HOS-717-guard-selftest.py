#!/usr/bin/env python3
"""Self-test for the proposed guard predicate: does it generalize past the one shape it was built from?"""
import importlib.util
import pathlib

# Resolve the guard next to this file. The original version hard-coded an
# absolute path into a throwaway session scratchpad, so the self-test stopped
# running the moment that directory was cleaned up.
_GUARD = pathlib.Path(__file__).resolve().parent / "HOS-717-guard-proposal.py"

spec = importlib.util.spec_from_file_location("g", str(_GUARD))
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

cases = [
    ("A bare const deref", True,
     "import { billingSubscriptions } from '@repo/db';\nconst x = billingSubscriptions.id;\n"),
    ("B object map (the real shape)", True,
     "import { billingPayments } from '@repo/db';\nexport const M = {\n  a: billingPayments.id\n} as const;\n"),
    ("C arrow fn", False,
     "import { billingPayments } from '@repo/db';\nexport const f = () => ({ a: billingPayments.id });\n"),
    ("D function decl", False,
     "import { billingPayments } from '@repo/db';\nexport function f() { return billingPayments.id; }\n"),
    ("E inside a method body", False,
     "import { billingPayments } from '@repo/db';\nexport const svc = {\n  run() { return billingPayments.id; }\n};\n"),
    ("F type-only import", False,
     "import type { billingPayments } from '@repo/db';\nexport const M = { a: billingPayments.id };\n"),
    ("G $inferSelect type usage", False,
     "import { billingPayments } from '@repo/db';\nexport const M: typeof billingPayments.$inferSelect | null = null;\n"),
    ("H aliased import", True,
     "import { billingPayments as bp } from '@repo/db';\nexport const M = { a: bp.id };\n"),
    ("I import from elsewhere", False,
     "import { foo } from 'somewhere-else';\nexport const M = { a: foo.id };\n"),
]

bad = 0
for label, want_flag, src in cases:
    hits = g.scan("synthetic.ts", src)
    got_flag = len(hits) > 0
    ok = (want_flag == got_flag)
    bad += 0 if ok else 1
    print(f"{'ok ' if ok else 'BAD'}  {label:32} expect={'FLAG' if want_flag else 'pass'}  got={len(hits)} hit(s)")
print(f"\n{len(cases) - bad}/{len(cases)} shapes classified correctly")
