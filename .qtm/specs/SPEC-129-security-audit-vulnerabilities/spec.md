---
spec-id: SPEC-129
title: Security Audit — Dependency Vulnerabilities Remediation
type: security
complexity: medium
status: draft
created: 2026-05-15T17:50:00Z
effort_estimate_hours: 4-8
tags: [security, dependencies, supply-chain, ci, vulnerability]
extracted_from: SPEC-117 PR #1106 audit (2026-05-15)
priority: high
---

# SPEC-129: Security Audit — Dependency Vulnerabilities Remediation

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Resolve the dependency vulnerabilities surfaced by `pnpm audit --prod --audit-level=high` so the CI Security job goes green and stays green. Specifically, eliminate the 1 critical and 1 high finding that block the gate today, and triage the remaining 26 moderate + 5 low findings into "fix now" vs "track separately" buckets.

**Why now:** Surfaced during the SPEC-117 PR #1106 audit on 2026-05-15. The Security job has been failing on every CI run on `staging` for at least 5 consecutive runs (well before SPEC-117). It is NOT a regression introduced by SPEC-117 — `pnpm-lock.yaml` is unchanged in that PR. But while billing-blocked CI jobs hide the issue today, they will become visible the moment GitHub Actions billing is restored, and the gate will then block every subsequent merge.

**Audience:** Solo developer (qazuor). Touches dependency upgrades across all apps and packages.

---

### 2. Out of Scope

- Adding new SAST tooling (Semgrep is already wired in CI).
- Hardening application code beyond what is required to consume the upgraded packages.
- Migrating away from any of the affected libraries (e.g., replacing `sanitize-html` with a different sanitizer).
- License audit, SBOM generation, or supply-chain attestation work — separate concerns.

---

### 3. Vulnerabilities Inventory

Snapshot taken with `pnpm audit --prod --json` on 2026-05-15 (HEAD `7e41cd750`, branch `fix/admin-pages-audit`).

**Totals:** 33 advisories — 1 critical, 1 high, 26 moderate, 5 low.

#### Blockers (CI gate `--audit-level=high`)

| Severity | Package | Vulnerable | Patched | Advisory |
|---|---|---|---|---|
| **CRITICAL** | `sanitize-html` | `<=2.17.3` | (no patch yet — see notes) | [GHSA-rpr9-rxv7-x643](https://github.com/advisories/GHSA-rpr9-rxv7-x643) — XSS via `xmp` raw-text passthrough |
| **HIGH** | `devalue` (via Astro) | `>=5.6.3 <=5.8.0` | `>=5.8.1` | [GHSA-77vg-94rm-hx3p](https://github.com/advisories/GHSA-77vg-94rm-hx3p) — DoS via sparse array deserialization |

#### Moderate (selection — full list lives in pnpm audit output)

| Package | Patched | Advisory summary |
|---|---|---|
| `@astrojs/node` | `>=10.0.5` | Memory exhaustion DoS via missing request body size limits + cache poisoning |
| `@tanstack/start-server-core` | `>=1.167.30` | Inbound server-function request smuggling vector |
| `astro` | `>=6.1.6` | XSS in `define:vars` via incomplete `</script>` tag sanitization |
| `better-auth` | `>=1.6.2` | OAuth callback accepts mismatched `state` parameter |
| `brace-expansion` | `>=5.0.5` | Zero-step sequence causes process hang and CPU DoS |
| `dompurify` | `>=3.4.0` | 7 separate findings: ADD_TAGS bypass, prototype pollution, mutation-XSS, etc. |
| `file-type` | `>=21.3.1` | Infinite loop in ASF parser on malformed input |
| `h3` | `>=2.0.1-rc.18` | SSE event injection + unbounded chunked cookie count in session loop |
| `hono` | `>=4.12.18` | CSS declaration injection in style objects + Cache middleware ignores Vary headers |
| `nitropack` | `>=2.13.4` | Open redirect via protocol-relative URL bypass + proxy scope bypass |
| `postcss` | `>=8.5.10` | XSS via unescaped `</style>` in CSS stringify |
| `serialize-javascript` | `>=7.0.5` | CPU exhaustion DoS |
| `smol-toml` | `>=1.6.1` | DoS via TOML documents |
| `yaml` | `>=2.8.3` | Stack overflow via deeply nested YAML |

The 5 lows are not enumerated here; treat them as "look at it during the moderate sweep" and decide individually.

---

### 4. Investigation Approach

#### Phase 0 — Reconcile reality

- Re-run `pnpm audit --prod --json` against latest `staging` and confirm the counts above are still accurate.
- For each high+critical, check if a patch was published since 2026-05-15 (`pnpm view <pkg> versions --json`).
- For `sanitize-html` specifically: GHSA-rpr9-rxv7-x643's "patched_versions" field shows `<0.0.0` (no patched version yet). Verify on the upstream Apostrophe issue tracker. If still no patch, the options are (a) wait for upstream, (b) pin to a previous safe version if one exists, (c) replace with `dompurify` (already a transitive dep) or `xss` library.

#### Phase 1 — Pick fix order

Order by blast radius (smallest first):

1. **`devalue` (high)**: transitive via Astro. Either `pnpm update astro` to a version that pins `devalue >= 5.8.1` OR add a `pnpm.overrides` entry in root `package.json` to force-bump.
2. **Astro family (`@astrojs/node`, `astro`, `nitropack`, `h3`)**: bump together — they version-lock with each other. Read the Astro 6.x changelog for breaking changes that affect `apps/web` and `apps/landing`.
3. **`@tanstack/start-server-core`**: bump TanStack Start in `apps/admin` to a version that resolves to `>=1.167.30`. Watch for routeTree.gen regressions.
4. **`better-auth`**: bump to `>=1.6.2` — security-critical for the OAuth callback path. Validate Google + Facebook + magic-link signups still work end-to-end after upgrade.
5. **`hono` 4.12.18+** in `apps/api`: lighter-weight upgrade; check middleware compatibility.
6. **`dompurify` to 3.4.0+**: 7 advisories collapse into one bump.
7. **Remaining moderates** (`postcss`, `yaml`, `smol-toml`, `file-type`, `serialize-javascript`, `brace-expansion`): mostly transitive; resolve via `pnpm dedupe` after the framework bumps.
8. **`sanitize-html` (critical)**: handled last because the upstream patch may still not exist. If no patch:
   - Option A: file a tracking issue and document the accepted risk in this spec.
   - Option B: wrap calls to `sanitize-html` in our own pre-sanitizer that strips `<xmp>` tags first. This is a thin defense and should be temporary.
   - Option C: migrate to `dompurify` (already in tree at the bumped 3.4.0).

#### Phase 2 — Validate

- `pnpm install` clean, then `pnpm audit --prod --audit-level=high` must exit 0.
- Full local CI replay: `pnpm lint && pnpm typecheck && pnpm build && pnpm test`.
- Smoke test all three apps boot: `pnpm dev:admin`, `pnpm dev:api`, `pnpm dev:web`. No regressions in the auth flow, billing flow, or any critical user path.
- Web app: spot-check a content page that renders sanitized markdown / rich-text (this is where `sanitize-html` and `dompurify` live).

---

## Part 2 — Acceptance Criteria

- [ ] `pnpm audit --prod --audit-level=high` exits 0 from a clean install on `staging`.
- [ ] CI Security job goes green on the SPEC-129 PR.
- [ ] All transitive moderate vulns from the framework bumps are gone (only "true" moderates that have no upstream patch may remain, each documented inline in a `risk-accepted.md` next to this spec).
- [ ] No regression in web/admin/api smoke tests after the upgrades.
- [ ] OAuth signup (Google + Facebook) verified end-to-end on staging after the `better-auth` bump.
- [ ] If `sanitize-html` is not patchable, a follow-up tracking entry is created (separate spec or GitHub issue) AND the accepted risk is documented in `risk-accepted.md`.

---

## Part 3 — Risks & Notes

- **Astro 6.x is a major bump** (currently on 5.x). Likely API breaking changes for content collections, image optimization, or middleware patterns. May require a separate sub-spec if the migration grows beyond ~1 day.
- **Better-auth 1.6.2** patch level upgrade should be safe, but the OAuth state mismatch fix may also tighten validation in ways that surface latent bugs. Validate on staging before prod.
- **TanStack Start ≥1.167.30** is current as of 2026-05-15; verify no breaking changes from whatever version `apps/admin` pins today.
- **`pnpm.overrides`** is the escape hatch when a transitive dep has a patch but the parent hasn't released a new version. Use it sparingly — every override is a maintenance burden.
- **No `pnpm-lock.yaml` change in SPEC-117 (PR #1106)** means SPEC-117's audit failure is purely pre-existing. SPEC-129's first commit must reflect this baseline.

---

## Part 4 — Tasks Outline (to be split via `/task-master:task-from-spec`)

1. Phase 0 reconcile (re-run audit, capture fresh inventory).
2. Bump `devalue` (override or via Astro family).
3. Bump Astro family + nitropack + h3 (single batch).
4. Bump TanStack Start.
5. Bump better-auth + smoke test OAuth.
6. Bump hono.
7. Bump dompurify (collapses 7 advisories).
8. `pnpm dedupe` + clean up remaining moderates.
9. Resolve sanitize-html (decision branch: patch / pre-filter / migrate).
10. Update `apps/api/CLAUDE.md` and root `CLAUDE.md` with any new conventions surfaced during the bumps.
11. Document any accepted risks in `risk-accepted.md`.
12. Verify full CI replay passes locally; open PR.

---

## Provenance

Surfaced during SPEC-117 PR #1106 audit on 2026-05-15. Engram allocation: `spec-registry/hospeda/last-number` updated to 129 (123-128 already taken on other branches not visible from `fix/admin-pages-audit`).
