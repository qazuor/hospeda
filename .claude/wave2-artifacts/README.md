# Wave 2 guard artifacts (HOS-714..721)

Working artifacts rescued from the smoke wave of 2026-08-21. **Nothing here is
wired into CI**, and none of it is an adopted repo guard yet.

## Why they live here and not in `scripts/`

The wave deferred every guard to a separate, final PR, on a rule learned the
hard way: a guard changes the rules retroactively, and one of them broke
`staging` once. Putting these under `scripts/` would read as adoption and would
invite `pnpm check:guards` wiring before that decision is made.

They are committed only so they survive. They were sitting untracked in a
working tree for a day, which is one `git clean` away from being lost.

Note that the repo has no other Python: every adopted guard is `.sh` or `.ts`
under `scripts/`. Whichever PR eventually adopts this one has to decide on the
port, or on an explicit exception.

## What is here

| File | What it is |
| --- | --- |
| `HOS-717-guard-proposal.py` | The proposed guard: no module-scope dereference of a `@repo/db` named import. |
| `HOS-717-guard-selftest.py` | Nine synthetic shapes proving the predicate generalizes past the one case it was built from. |

### The defect the guard is for

A module-scope `const` whose initializer dereferences a table imported from
`@repo/db` is evaluated at **import** time. Under a `vi.mock('@repo/db')`
factory that does not declare that export, Vitest throws on the named-import
binding instead of yielding `undefined`, so every test that transitively imports
the module fails to **collect** — not to assert. That is why the failure reads
as unrelated: it took down 44 files and all 5 shards at once.

### Status as measured during the wave

- Self-test: **9/9** shapes classified correctly.
- Control: 3 known references detected.
- Run against `origin/staging`: **0 hits**, i.e. the tree was clean at the time.

## Running them

```bash
python3 .claude/wave2-artifacts/HOS-717-guard-proposal.py origin/staging  # scan a git ref
python3 .claude/wave2-artifacts/HOS-717-guard-proposal.py --worktree      # scan the working tree
python3 .claude/wave2-artifacts/HOS-717-guard-selftest.py                 # 9 synthetic shapes
```

The self-test resolves the guard next to itself. It originally hard-coded an
absolute path into a throwaway session scratchpad, so it stopped running the
moment that directory was cleaned up — fixed when these were rescued.

## The other three deferred guards

Not written yet, tracked in their own issues: HOS-737 (fixed `livemode`),
HOS-741 (vacuous table-identity assertions), and HOS-715 (test directories with
no config). All four belong in one final PR, opened when nothing else is in
flight.
