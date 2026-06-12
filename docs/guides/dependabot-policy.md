# Dependabot Policy — Triage & Merge Strategy

> How dependency-update PRs flow through CI, how to triage them, and how
> migration-gated majors are routed. Established by **SPEC-219**.

## TL;DR

- Dependabot opens grouped version-update PRs against **`staging`** (never `main`),
  weekly on Monday.
- A safe patch/minor PR should go **fully green** with no manual intervention. If
  the **Build** job is the only red, it is almost always the secrets caveat below,
  not the bump.
- Breaking updates that arrive as **minor** bumps (currently `zod` and
  `@tanstack/react-router`) are **ignored** in `dependabot.yml` and owned by a
  dedicated migration spec. They never ride in on a grouped PR.

## Why Dependabot Build failures are usually NOT the bump

Dependabot-triggered workflow runs execute **without access to repository
secrets** (a GitHub security boundary). In `.github/workflows/ci.yml` the build
URL env vars (`HOSPEDA_API_URL`, `VITE_API_URL`, `VITE_SITE_URL`, `VITE_ADMIN_URL`,
`PUBLIC_*`) are sourced from `secrets.*`. In a Dependabot run they arrive empty.

The admin build (`apps/admin`) validates these as URLs at build time
(`z.string().url()` in `apps/admin/src/env.ts`, executed during `vite build` via
`__root.tsx`). Empty strings fail validation and abort `admin#build`.

This used to fail on **every** Dependabot PR regardless of content. It is fixed
(SPEC-219 T-002): when a secret is empty, the workflow falls back to a
syntactically-valid placeholder (`https://example.invalid`, RFC 2606 reserved TLD)
so the build passes. The build never dereferences these URLs.

> **Note on "why only Dependabot":** on push to `staging`, `admin#build` is a
> Turbo remote-cache HIT (admin source unchanged), so `vite build` never re-runs
> and validation never fires. Dependabot changes dependency versions → cache key
> changes → cache MISS → `vite build` re-runs → it would fail without the
> placeholder fallback.

### The placeholder guard

The placeholder must never reach a real/deploy build. `apps/admin/src/env.ts`
rejects any `*.invalid` URL **unless** `ALLOW_PLACEHOLDER_ENV_URLS=true`, which is
set **only** in the CI Build step (`ci.yml`). Deploy builds (Coolify) never set
it, so a production build misconfigured with a placeholder fails loudly. The
test job does not set it either, so the rejection path stays covered
(`apps/admin/test/env.test.ts`).

## The three CI job classes a Dependabot PR must satisfy

| Class | Jobs | "Green" means |
|-------|------|---------------|
| Build | `Build` | All apps/packages compile; admin env validation passes (placeholder fallback in effect). |
| Quality | `Guards`, `Typecheck`, `Lint`, unit/integration test shards | No type, lint, or test regressions from the bump. |
| E2E | `E2E P0 Suite` | Critical user flows still pass against the bumped deps. |

`CI Pass` is the aggregator. It is the merge gate: it must be `SUCCESS` (skipped
jobs are OK; failed/cancelled are not).

## Triage flow

1. **Open the PR's checks.** If everything is green → it is a safe patch/minor
   group. Review the changelog highlights Dependabot lists, then merge with
   `gh pr merge --merge` (preserves history).
2. **If only `Build` is red** and the log shows the admin env URL validation
   error → this is the secrets caveat and the fix is already in `ci.yml`. Rebase
   the PR onto current `staging` (`@dependabot rebase`) so it picks up the fix.
3. **If `Guards` / `Typecheck` / tests / E2E are red** → the bump carries a real
   breaking change. Do NOT merge mechanically. Either:
   - peel the offending package out of the group (see below), or
   - route it to its migration spec and close the PR until that lands.

## Majors and migration-gated packages

- **Majors** open their own PRs (the group rules only batch `minor`/`patch`), so a
  breaking major never rides in on an otherwise-green grouped PR. Review each on
  its own and link a migration spec if it needs code changes.
- **Breaking minors** cannot be isolated by update-type grouping. The known ones
  are pinned via `ignore` in `.github/dependabot.yml`:

  | Package | Why gated | Owner spec |
  |---------|-----------|------------|
  | `zod` | 4.4 made `.merge()` throw on schemas with refinements (use `.safeExtend()`); breaks admin env cross-validation + E2E. | SPEC-132 (Zod 4 migration) |
  | `@tanstack/react-router` | `1.131 → 1.170` risks the documented `/healthz` path-intercept behavior. | SPEC-045 (Vite/TanStack migration) |

  These are **fully ignored** (including patch) until their migration spec lands.
  **Removing an `ignore` entry is the deliberate trigger** to take on that
  migration: do it on a branch owned by the migration spec, run the full suite
  (and, for the router, re-validate `/healthz` per `apps/admin/CLAUDE.md`), and
  only then let Dependabot resume bumping it.

### Security updates caveat

Because `dependabot.yml` sets `target-branch: staging` (a non-default branch),
GitHub **disables automated security-update PRs for the whole npm ecosystem** —
not just the `ignore`-listed packages. Security ALERTS still fire, and most
patches still arrive through the weekly grouped version-update PRs. The
compensating control is the **`pnpm audit` gate in CI** (the `security` job),
which fails any PR that introduces a high-severity advisory. For an out-of-cycle
CVE, apply the bump by hand on a `staging` branch.

## Adding a new migration-gated package

When a future bump breaks the build/tests and the fix is a non-trivial code
migration:

1. Add an `ignore` entry for it in `.github/dependabot.yml` with a comment
   stating *why* and which spec owns it.
2. Create (or reuse) a migration spec and reference this guide from it.
3. Add a row to the table above.

## References

- `.github/workflows/ci.yml` — placeholder fallback + `ALLOW_PLACEHOLDER_ENV_URLS`.
- `.github/dependabot.yml` — grouping + `ignore` entries.
- `apps/admin/src/env.ts` — URL validation + placeholder guard.
- `apps/admin/CLAUDE.md` — `/healthz` / router caveat.
- SPEC-219 — this policy's origin; SPEC-132 / SPEC-045 — the gated migrations.
