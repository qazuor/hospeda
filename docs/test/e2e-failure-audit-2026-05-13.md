# E2E Nightly Failure Audit — 2026-05-13

_Generated as part of SPEC-105 T-105-01 (Phase 0: audit past nightly failures)._

---

## Summary

All 11 nightly E2E runs (2026-05-02 → 2026-05-12) failed with the **same two root causes**. The test suite itself **never executed** — everything was blocked at the build step. This is the best-case scenario from the spec's probability table (~20% — trivial infra drift, not schema drift).

| Run date | Run ID | Failure | Tests ran? |
|---|---|---|---|
| 2026-05-12 | 25712940274 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-11 | 25650170598 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-10 | 25619635234 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-09 | 25591267360 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-08 | 25536002466 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-07 | 25475714739 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-06 | 25416079555 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-05 | 25357150977 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-04 | 25300727419 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-03 | 25269629218 | Build (hospeda-admin) + CI scripts | No |
| 2026-05-02 | 25243325955 | Build (hospeda-admin) + CI scripts | No |

---

## Root Cause 1 — Wrong Turbo filter: `hospeda-admin` (INFRA DRIFT)

**Error message:**

```
x No package found with name 'hospeda-admin' in workspace
```

**Step:** `Build apps`

**Cause:** The admin app package was renamed from `hospeda-admin` to `admin` (see `apps/admin/package.json`). The workflow still referenced the old name via `--filter=hospeda-admin`.

**Status at staging HEAD (b90adbf5a):** Already fixed — the current `e2e-nightly.yml` now uses `--filter=admin`. The fix landed in staging _after_ the cron was disabled on 2026-05-12, so it never ran.

**Fix applied in:** Already in `main`/`staging` as of branch cut. No action needed for this root cause.

---

## Root Cause 2 — Wrong CI script paths: `scripts/ci/` prefix (INFRA DRIFT)

**Error messages:**

```
bash: scripts/ci/check-raw-ilike.sh: No such file or directory
Process completed with exit code 127.
```

**Step:** `Run CI scripts (raw-ilike + SEO + sitemap)`

**Cause:** The scripts were reorganized. The `scripts/ci/` subdirectory no longer exists; scripts were moved/renamed to the root `scripts/` dir:

| Workflow (stale) | Actual path | Status |
|---|---|---|
| `scripts/ci/check-raw-ilike.sh` | `scripts/check-unsafe-ilike.sh` | Renamed |
| `scripts/ci/seo-validator.ts` | `scripts/seo-validator.ts` | Moved |
| `scripts/ci/sitemap-validator.ts` | `scripts/sitemap-validator.ts` | Moved |

Reference: `ci.yml` line 188 uses `bash scripts/check-unsafe-ilike.sh` — that confirms the correct path.

**Status:** NOT yet fixed in `e2e-nightly.yml`. This is the remaining blocker.

**Fix needed:** Update the `Run CI scripts` step in `.github/workflows/e2e-nightly.yml`.

---

## Findings: no credential drift, no schema/API drift detected

- All secrets (`HOSPEDA_BETTER_AUTH_SECRET`, `HOSPEDA_MERCADO_PAGO_*`, `HOSPEDA_CLOUDINARY_*`) were present in the job env (masked by Actions — not empty). No credential expiry evidence.
- `apps/e2e/.env.e2e` — port assignments and URLs look correct; no drift detected.
- Package names `hospeda-api`, `hospeda-web`, `hospeda-e2e` unchanged — only `admin` was renamed.
- The test suite was never reached, so schema/API drift in test assertions is **unknown** and must be verified in Phase 1 (T-105-02 — local repro).

---

## Fixes to apply (T-105-04/T-105-05)

1. Fix `.github/workflows/e2e-nightly.yml` — CI scripts step paths (Root Cause 2).
2. Re-enable the cron schedule (T-105-06) after Phase 1 local repro confirms tests pass.

---

## Next steps

- **T-105-02**: Run the E2E suite locally (`pnpm cli wt:up` + `pnpm --filter hospeda-e2e e2e:test`) to verify no schema/API drift in assertions.
- **T-105-05** (infra drift fix): Patch the `Run CI scripts` step — done in this branch.
- **T-105-06**: Re-enable the cron after 1 clean local run.
