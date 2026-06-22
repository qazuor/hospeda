# SPEC-129 — Accepted Risks (remaining dependency advisories)

**Date:** 2026-06-22
**Author:** qazuor
**Gate status at close:** `pnpm audit --prod --audit-level=high` exits **0**; CI `Security` job is **green** on `staging`.

## Context

SPEC-129 was written on 2026-05-15 against an audit snapshot showing **1 critical**
(`sanitize-html`) and **1 high** (`devalue`) blocking the CI Security gate. By the time
the spec was picked up (2026-06-22) both blockers had already been resolved by intervening
work:

- **`devalue` (HIGH, GHSA-77vg-94rm-hx3p)** — now resolves to `5.8.1` (patched) transitively
  via the Astro 5.x → 6.4.7 bump landed in PR #1700 (SSRF fix).
- **`sanitize-html` (CRITICAL, GHSA-rpr9-rxv7-x643)** — the tree is still on `2.17.0`, but the
  advisory is no longer reported as critical/high by `pnpm audit` (re-classified / no longer
  matching). It does not appear at any severity in the current `--prod` audit.

The Phase-0 re-baseline therefore found the gate **already green**. Per owner decision
(2026-06-22), SPEC-129 was scoped down to **low-risk hardening only**:

- Bumped `dompurify` `3.3.1 → 3.4.11` in `apps/admin` (same major, stable `.sanitize()` API)
  — cleared **16 advisories**.
- Ran `pnpm dedupe` — cleared the transitive duplicates `brace-expansion`, `postcss`, `yaml`,
  `smol-toml`, `markdown-it`, `@babel/core`.

Net result: **51 → 20** advisory hits (`1 low | 19 moderate`), **0 critical / 0 high**.

### Side effect of `pnpm dedupe`: `zod` pinned to 4.3.6

`pnpm dedupe` had an unintended side effect: it collapsed the duplicate `zod` instances and
promoted `zod` from `4.3.6` to `4.4.3` (the root range is `"zod": "^4.0.8"`, which permits
both). `zod 4.4.3` introduced a breaking runtime guard that throws
`.merge() cannot be used on object schemas containing refinements` — and
`packages/schemas/src/api/api.schema.ts` builds `ExtendedQuerySchema` via `.merge()` on refined
schemas (`DateRangeQuerySchema`, `LocationQuerySchema`). This broke the `Build`, `Guards`, and
`E2E` jobs (the error is a **runtime** throw at schema-evaluation time, so `typecheck` did not
catch it).

This also revealed a **latent repo-wide risk**: `"zod": "^4.0.8"` lets any future
`pnpm install`/`update` promote `zod` to 4.4.x and break the build, independent of this PR.

Fix applied here: a `pnpm.overrides` entry **`"zod": "4.3.6"`** in the root `package.json`,
pinning `zod` to the version the codebase currently supports (the same version `staging`
resolved to). This is intentionally **not** the `.safeExtend()` migration — adopting the zod
4.4.x API is owned by **SPEC-132 (Zod 4 migration)**, which the owner deferred to post-launch.
The override should be **removed as part of SPEC-132** once `api.schema.ts` is migrated off
`.merge()` on refined schemas.

## Remaining advisories (accepted for now)

None of the following block the CI gate (all moderate/low). Each requires either a
**framework-level bump** (risk of build/SSR/routing regression) or an **override** on a deep
transitive (maintenance burden + risk of breaking the parent), so they are explicitly
**out of scope** for the low-risk pass and tracked under the follow-up spec **SPEC-262**.

| Severity | Package | Patched | Why deferred |
|---|---|---|---|
| moderate | `better-auth` | `>=1.6.2` | OAuth callback `state` fix. Touches the auth callback path; requires end-to-end Google/Facebook OAuth smoke on staging before merging. |
| moderate | `@tanstack/start-server-core` | `>=1.167.30` | Server-function deserialization. Bumping TanStack Start risks `routeTree.gen` / routing regressions in admin. |
| moderate | `h3` (3 advisories) | `>=2.0.1-rc.17/18` | SSE injection + cookie-loop DoS + mount path-boundary. Transitive via Astro/nitro; needs a coordinated framework bump. |
| moderate | `nitropack` (2 advisories) | `>=2.13.4` | Open redirect + proxy scope bypass. Transitive via Astro; coordinated framework bump. |
| moderate | `@opentelemetry/core` | `>=2.8.0` | Unbounded memory in W3C Baggage propagation. Deep transitive; override only. |
| moderate | `file-type` | `>=21.3.1` | Infinite loop in ASF parser. Deep transitive; override only. |
| moderate | `serialize-javascript` | `>=7.0.5` | CPU-exhaustion DoS. Deep transitive (build tooling); override only. |
| moderate | `tar` | `>=7.5.16` | PAX size-override parser differential. Deep transitive (tooling); override only. |
| moderate | `ua-parser-js` | `>=2.0.10` | ReDoS in `withClientHints()`. Deep transitive; override only. |
| moderate | `uuid` | `>=11.1.1` | Missing buffer bounds check in v3/v5/v6 with `buf`. Deep transitive; override only. |

## Follow-up

Tracked by **SPEC-262 — Security deps moderate remediation (framework bumps + overrides)**
(`draft`). That spec owns the higher-risk work: the `better-auth` + TanStack Start bumps
(each with the required regression smoke) and the Astro/nitro/h3 framework bump, plus a
deliberate evaluation of `pnpm.overrides` for the deep transitives that have no patched
parent release.

The `sanitize-html` 2.17.0 status should also be re-confirmed under SPEC-262: although the
advisory no longer matches, it is worth verifying against the upstream Apostrophe tracker
whether a 2.17.x patch or a clean upgrade path exists.
