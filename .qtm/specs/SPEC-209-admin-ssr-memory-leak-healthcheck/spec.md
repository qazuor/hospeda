---
spec-id: SPEC-209
title: Admin SSR memory leak + cheap healthcheck
type: bugfix
complexity: medium
status: completed
created: 2026-06-08T15:45:33Z
tags: [admin, ssr, memory-leak, billing, qzpay, healthcheck, coolify, nitro, observability]
---

# SPEC-209 — Admin SSR memory leak + cheap healthcheck

## 1. Overview

### Problem

The admin app (`apps/admin`, TanStack Start / Nitro `node-server` preset) leaks memory
under server-side rendering. The production admin container grew to **~986 MB in 2 days
with no real users**; logs show `QZPayBilling initialized {livemode:true}` **~990 times in
48 h**. The container is fed almost entirely by Coolify's healthcheck, which is
`GET /` every 30 s — and `GET /` server-renders the full React root on every probe.

Root cause (confirmed by reading the code, not yet proven by heap snapshot):
`apps/admin/src/routes/__root.tsx` builds two things inside `useState(() => ...)` in
`RootDocument`:

- a `QueryClient` (line ~208), and
- a `QZPayBilling` instance via `createQZPayBilling({ livemode: env.PROD })` (line ~243).

`useState` lazy init is the correct *browser* pattern (one instance per mounted tree).
But on the server **the root component mounts once per request**, so every SSR render
constructs a fresh `QueryClient` + `QZPayBilling`. The repeated
`QZPayBilling initialized` log line is the smoking gun. Something retains those instances
(timers / listeners / provider-sync from the `livemode:true` billing client is the prime
suspect), producing linear growth.

This was discovered while diagnosing the 2026-06-06 staging admin deploy that died
**exit 255** mid-build: the 3.8 GB VPS was already in swap thrash partly because of this
accumulated admin RSS. The deploy concurrency fix (PR #1483) is separate; this spec
addresses the leak and the wasteful healthcheck.

### Goal

1. Stop the per-request churn that feeds the leak: give Coolify a **cheap healthcheck
   endpoint** that returns `200` without server-rendering the React root.
2. **Confirm** the exact retained allocation with a heap snapshot, then **fix** it so the
   admin SSR process holds steady RSS over time.
3. **Prevent regression** in `apps/web` (currently clean — it does NOT build a
   `QueryClient`/billing in its root) with a guard test so nobody reintroduces the
   `useState(() => createX())`-in-root pattern on the server.

### Success criteria

- A healthcheck endpoint exists that responds `200` in < 50 ms without invoking React SSR
  or constructing a `QZPayBilling` instance, and Coolify's healthcheck points at it.
- After the fix, `QZPayBilling initialized` no longer appears on healthcheck traffic.
- Admin SSR process RSS stays within a bounded band (defined in T-002) over a sustained
  probe load on staging — no monotonic growth.
- A regression/guard test fails if a `QueryClient` or `QZPayBilling` is constructed during
  a server render of the admin or web root.

## 2. User Stories & Acceptance Criteria

### US-1 — Operator: cheap healthcheck

**As** the platform operator, **I want** the container healthcheck to be cheap **so that**
routine probes don't drive SSR work or memory churn.

- **AC-1.1** — Given the admin container is running, when Coolify probes the healthcheck
  endpoint, then it returns HTTP `200` with a tiny body (e.g. `{"status":"ok"}`).
- **AC-1.2** — Given a healthcheck request, when it is handled, then no React root SSR
  occurs and no `QZPayBilling` instance is created (assert: no
  `QZPayBilling initialized` log line attributable to the probe).
- **AC-1.3** — Given the Dockerfile / Coolify config, when the container is deployed, then
  the healthcheck `Test` targets the cheap endpoint, not `GET /`.

### US-2 — Maintainer: confirmed, fixed leak

**As** a maintainer, **I want** the SSR memory growth root-caused and fixed **so that** the
admin process holds steady RSS.

- **AC-2.1** — Given a heap snapshot taken on staging under sustained probe load, when
  analyzed, then the dominant retained set is identified and documented (billing client,
  QueryClient, or other) with evidence.
- **AC-2.2** — Given the fix is applied, when the admin SSR root handles a request, then it
  does not construct a functional `QZPayBilling` instance on the server (the `QZPayProvider`
  still works client-side, where the real billing calls happen via the HTTP adapter).
- **AC-2.3** — Given sustained probe/navigation load on staging for a defined window, when
  RSS is sampled, then it stays within the bounded band from T-002 (no monotonic climb).

### US-3 — Maintainer: regression guard

**As** a maintainer, **I want** a guard test **so that** the root-level SSR-unsafe
construction pattern cannot silently return.

- **AC-3.1** — Given the admin and web root route files, when the guard test runs, then it
  fails if `createQZPayBilling(` or `new QueryClient(` appears in a code path executed
  during server render without a client-only guard.
- **AC-3.2** — Given CI, when the guard test is part of the suite, then it runs on every PR.

## 3. Technical Approach

**Sequencing is investigate-first** (per owner decision): land the cheap healthcheck and
the heap-snapshot confirmation before committing to the precise fix shape. The fix in §AC-2.2
(client-only billing) is the leading hypothesis but T-002 evidence is the gate.

### Key files

- `apps/admin/src/routes/__root.tsx` — the leak site (`useState(() => ...)` for
  `queryClient` + `billing`, consumed by `<QZPayProvider billing={billing}>` and
  `<QueryClientProvider client={queryClient}>`).
- Healthcheck endpoint — a TanStack Start **server route** (raw HTTP handler, not a React
  route, not an RPC server function) that returns `200` without SSR. Exact mechanism to be
  verified against the installed TanStack Start version (see Internal Review Notes). Likely
  `apps/admin/src/routes/healthz.ts` (or `.tsx` server-route form) responding to `GET`.
- `apps/admin/Dockerfile` — `HEALTHCHECK` / Coolify healthcheck `Test` currently
  `curl -f http://localhost:3000/`; repoint to `/healthz`. Note: the healthcheck may also
  be overridden in the Coolify resource UI — both must agree (operator step, flagged).
- `apps/web/src/routes` (Astro) — no root QueryClient/billing today; the guard test pins
  that.
- Test files for the guard + regression (admin test dir; web test dir).

### Approach notes

- **Healthcheck**: a server route that short-circuits before any React render. Verify the
  installed TanStack Start exposes a server-route/API-route primitive; if not, fall back to
  a Nitro route or a middleware early-return for the `/healthz` path.
- **Leak fix (hypothesis, gated by T-002)**: do not instantiate `QZPayBilling` on the
  server. Options to evaluate with the snapshot in hand:
  - render `<QZPayProvider>` client-only / pass `null` billing on the server and hydrate on
    the client, or
  - lazy-create billing in a `useEffect` (client-only by definition).
  The `QueryClient` per-request on SSR is the *recommended* TanStack pattern, so it is the
  secondary suspect — only change it if the snapshot proves it is the retained set.
- **Verification**: heap snapshot on staging (`node --inspect` / `--heapsnapshot-signal`,
  or `v8.writeHeapSnapshot()` behind an admin-only/staging-only trigger) plus RSS sampling
  under a scripted probe loop. Method finalized in T-002.

## 4. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Heap snapshot inconclusive (leak is native/timer, not JS heap) | Med | Pair snapshot with RSS slope + `QZPayBilling initialized` log count before/after; the log already correlates strongly with the churn. |
| Client-only billing breaks an SSR-time billing read | Med | Audit consumers — billing calls are client-side via the HTTP adapter; provider only needs the value on the client. Smoke admin billing pages after the fix. |
| TanStack Start version lacks a clean server-route primitive | Low | Fall back to Nitro route or middleware early-return for `/healthz`. |
| Coolify UI healthcheck override silently keeps `GET /` | Med | Operator must align Dockerfile + Coolify resource config; flagged as an explicit task + PR note. |
| Same pattern reintroduced later | Low | Guard test (US-3) on both admin and web roots, in CI. |

## 5. Testing Strategy

- **Unit / guard (US-3)**: static-scan test asserting neither admin nor web root constructs
  `QZPayBilling` / `QueryClient` in a server-executed path without a client-only guard.
- **Integration (healthcheck)**: request `/healthz`, assert `200` + body shape + that no
  `QZPayBilling initialized` log is emitted for the probe.
- **Regression (leak)**: a test that renders the admin root in an SSR-like harness N times
  and asserts `createQZPayBilling` is not called on the server (spy/mock), reproducing the
  original bug before the fix.
- **Manual (staging)**: scripted probe loop + RSS sampling over a defined window;
  before/after `QZPayBilling initialized` log counts; admin billing-page smoke to confirm
  client-side billing still works.

No tests = not done. Each AC above maps to at least one automated test except the
staging RSS/heap-snapshot validation, which is a documented manual procedure.

## 6. Tasks (Suggested)

### Setup / Investigate

- T-001: Add cheap `/healthz` server route returning `200` without SSR; verify the
  TanStack Start server-route primitive against installed version.
- T-002: Define + execute the heap-snapshot + RSS-sampling procedure on staging; document
  the retained set and the RSS band. (Decides the T-004 fix shape.)

### Core

- T-003: Repoint admin healthcheck (`apps/admin/Dockerfile` + flag the Coolify UI override
  to the operator) to `/healthz`.
- T-004: Implement the evidence-backed leak fix in `__root.tsx` (leading hypothesis:
  client-only billing; QueryClient only if the snapshot implicates it).

### Testing

- T-005: Integration test for `/healthz` (200 + no `QZPayBilling initialized` on probe).
- T-006: Regression test reproducing the SSR billing-construction bug, passing post-fix.
- T-007: Guard test (admin + web roots) against root-level SSR-unsafe construction.

### Docs / Cleanup

- T-008: Document the fix + the healthcheck contract in `apps/admin/CLAUDE.md`; link engram
  `deploy/vps-memory-pressure`; run the staging manual validation and record before/after
  RSS + log counts.

## Internal Review Notes

- **Strengthened**: scoped the QueryClient as the *secondary* suspect (per-request
  QueryClient is the recommended TanStack SSR pattern), so the fix won't blindly change it.
  Added the Coolify-UI healthcheck-override risk as an explicit operator step.
- **Open questions (need resolution during T-001/T-002)**:
  1. Does the installed TanStack Start version expose a first-class server/API route for a
     non-SSR `200`? If not, Nitro-route or middleware fallback. **Verify against TanStack
     Start docs for the installed version before T-001.**
  2. Exact heap-snapshot trigger on the staging container (signal vs. admin-only route vs.
     `--heapsnapshot-signal` flag in the Nitro start command). Decide in T-002.
  3. RSS acceptance band + probe-load window for AC-2.3 — set concrete numbers in T-002
     from the observed baseline.
- **External docs to verify (not yet done — APIs change)**: TanStack Start server/API route
  API for the installed version; `@qazuor/qzpay-core` `createQZPayBilling` lifecycle (does
  it start timers/intervals/provider-sync that need teardown?). Both must be checked before
  implementation, not from memory.
