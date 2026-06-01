---
spec-id: SPEC-120
title: OAuth Cancel/Error Observability — UI Feedback and Sentry Capture
type: feature
complexity: medium
status: in-progress
created: 2026-05-14T10:00:00Z
started: 2026-05-15T00:00:00Z
worktree: hospeda-spec-120-oauth-cancel-observability
branch: spec/SPEC-120-oauth-cancel-observability
renumbered_from: SPEC-117
renumbered_reason: collision with SPEC-117-admin-pages-stabilization (created in worktree before staging assignment was known)
effort_estimate_hours: 4-7
tags: [auth, oauth, observability, ux, sentry, i18n]
extracted_from: SPEC-103 operator OAuth smokes (session-finding-32) — 2026-05-14
priority: medium
---

# SPEC-120: OAuth Cancel/Error Observability

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Make OAuth flow failures (user-cancelled consent, provider error, callback rejection, redirect-uri misconfiguration) **visible** to both the end user (UI feedback) and the operator (Sentry event with proper tags).

**Why now:** Discovered during SPEC-103 T-024 operator smoke pass on 2026-05-14. When the user cancels Google OAuth consent (or it fails for any provider-side reason), the browser is redirected back to `/es/auth/signin/` cleanly — but:

- **Zero UI feedback**: no banner, no toast, no inline message. The user sees the signin form exactly as they left it; the entire failed OAuth round trip looks like a no-op.
- **Zero Sentry visibility**: there is no event captured with `environment:staging` (or `:production`) for the cancellation. Filtering Sentry by recent OAuth-related events in the 5-minute window after the cancel returns nothing. Operators have no signal that users are abandoning OAuth flows.

The recovery flow is otherwise sane (no crash, no error page) — but "silent and invisible" is unacceptable for a primary auth path that we expect users to debug their own way through. Especially with auto-linking and account-cascade flows where a single failed click on a single provider can leave the user confused about which login state they are in.

**Audience:** Solo developer (qazuor). Should ship before the public launch alongside SPEC-112 (OAuth per-env separation) and SPEC-113 (profile completion flow).

---

### 2. Out of Scope

- **OAuth credential rotation / per-env separation**: SPEC-112 owns that. This spec assumes credentials and redirect URIs are correct; it only instruments the failure modes.
- **Email/password error UX**: this spec touches only OAuth flows. Email-signin errors (wrong password, unverified email, lockout) have their own UI banners already.
- **Sign-out events**: only failed sign-in attempts via OAuth are in scope. Successful sign-out is well understood.
- **Provider-specific deep-links**: do not chase per-provider edge cases (e.g. Facebook's data-deletion callback). Focus on the generic `?error=...` query string contract.

---

### 3. Investigation Approach

#### Phase 0 — Confirm the error path Better Auth surfaces

- The OAuth handler in `apps/api/src/routes/auth/handler.ts` (or wherever Better Auth's `/api/auth/callback/<provider>` is wrapped) is the right place to start. Better Auth typically appends `?error=<code>&error_description=<msg>` to the redirect when the provider returns an error or the user cancels.
- Capture the exact query strings that arrive for: user cancel on Google, user cancel on Facebook, redirect-uri mismatch, expired authorization code. Use the staging env and the same techniques that surfaced session-finding-32 (revoke app access, then re-trigger OAuth + cancel).
- Document the canonical error codes Better Auth emits (e.g. `access_denied`, `oauth_provider_error`, `oauth_state_mismatch`, etc.).

#### Phase 1 — Decide the contract

- **(a) Query string contract**: the signin page (`apps/web/src/pages/[lang]/auth/signin.astro`) reads `?error=<code>` on render and renders a banner via the `SignIn.client.tsx` island. This keeps the UI piece SSR-rendered + locale-aware.
- **(b) Cookie / localStorage flash message**: write a one-shot flash on the API side, consume on the next page. More flexibility but introduces an extra side channel.
- **(c) Status-only redirect to a dedicated `/auth/error/` page**: cleaner separation but adds a route and another navigation step.

Recommended: **(a)** for the user-facing piece + Sentry capture at the API layer where the error is first observed. (c) is overkill for a recoverable error; (b) introduces cookie state we don't otherwise need.

#### Phase 2 — Implement UI feedback (web)

- Wire the signin page to read the query string and pass the error code to the React island.
- Add i18n keys to `@repo/i18n/locales/{es,en,pt}/auth.json` for each known error code, with a generic fallback. Use the i18n best practice of `t('auth.errors.oauth.access_denied')` style namespacing.
- Render a dismissable banner above the form. Use existing toast / banner primitives in `apps/web` — do NOT build a new component for this.
- Clear the query string from the URL after render (history.replaceState) so a reload does not re-show the error.

#### Phase 3 — Implement Sentry capture (api)

- In the Better Auth callback handler (or the lockout wrapper that already shadows `/sign-in/email` etc.), catch error returns from Better Auth and call `Sentry.captureMessage` or `Sentry.captureException` with structured context:
  - `tags`: `provider` (google / facebook), `error_code` (access_denied / …), `environment` (already auto-tagged by SPEC-103 T-076).
  - `extra`: redirect target, user-agent, request ID.
  - `level`: `'warning'` for user-cancel (`access_denied`); `'error'` for provider/system errors.
- Make sure the capture path runs even when the response is a 302 redirect (Sentry's automatic instrumentation may skip 3xx).

#### Phase 4 — Tests + smoke

- Unit: signin page renders the right banner key for each `?error=` value.
- Integration: simulate the Better Auth error redirect on the API side, assert that a Sentry event was queued (use Sentry's test transport).
- Manual smoke: re-run T-024 from `apps/web/docs/auth-smoke-checklist.md` after deploy; the previously-silent cancellation should now produce both a UI banner and a Sentry event.

---

### 4. Tasks

| Task | Title | Status |
|---|---|---|
| T-120-01 | Phase 0: catalogue Better Auth error redirect query strings for google + facebook cancel/error | pending |
| T-120-02 | Phase 1: decide UI + Sentry contract (recommendation: query string + API-side capture) | pending, blocked by T-120-01 |
| T-120-03 | Phase 2: signin page reads `?error=`, passes to island, renders i18n banner | pending, blocked by T-120-02 |
| T-120-04 | Phase 2: add i18n keys for known OAuth error codes (es/en/pt) | pending, blocked by T-120-02 |
| T-120-05 | Phase 3: Sentry capture in OAuth callback handler with tags (provider, error_code, environment) | pending, blocked by T-120-02 |
| T-120-06 | Phase 4: unit + integration tests + manual smoke against staging | pending, blocked by T-120-03, T-120-04, T-120-05 |

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| Better Auth's error redirect format changes between versions | Pin the exact version in the spec's investigation phase and document the contract in the runbook so a future Better Auth bump can be regression-tested |
| Sentry quota spike if a provider has an outage and 1000s of users cancel | Use `level: 'warning'` for `access_denied` (rate-limited by Sentry plan) and rely on Sentry's de-duplication / fingerprinting on `error_code` |
| Banner shows on legitimate page loads if the query string is not cleared | `history.replaceState` clear after render; covered by E2E test |
| i18n keys ship without proper translation (Spanish is canonical, EN/PT fall back) | Acceptable per project convention; new keys land in es first, en/pt fall back until translated |

---

### 6. Acceptance Criteria

This spec is "done" when:

- [ ] Cancelling the Google consent screen produces a visible banner on `/es/auth/signin/` with an i18n message like "Cancelaste el inicio de sesión con Google. Intentá de nuevo o usá otro método.".
- [ ] Same flow for Facebook (and any other configured provider).
- [ ] A Sentry event with `environment:staging`, `provider:google`, `error_code:access_denied` (or the canonical code Better Auth emits) appears within 30s of the cancellation.
- [ ] No banner shows on a clean signin page load (no `?error=` query string).
- [ ] No regression in successful OAuth signin (still lands on `/es/mi-cuenta/`).
- [ ] T-024 in `apps/web/docs/auth-smoke-checklist.md` can be marked PASS (not PARTIAL) after this ships.

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-103 T-024 operator smoke pass on 2026-05-14. The operator (qazuor) revoked the existing Google OAuth grant for the Hospeda app from `https://myaccount.google.com/permissions`, re-attempted Google signin from `/es/auth/signin/`, and clicked "Cancel" on the consent screen. The browser redirected back to `/es/auth/signin/` with no visible change; DevTools console clean; Sentry filter on `environment:staging` returned no event for the cancel.

Recorded as `session-finding-32` in `.qtm/tasks/SPEC-103-vps-migration-post-merge-cleanup/TODOs.md`.

### Sequencing

Independent of:

- SPEC-112 (per-env OAuth credentials) — that spec rotates secrets; this one instruments errors. They can ship in either order.
- SPEC-113 (profile completion flow) — same auth surface but different concern (post-success vs failure).
- SPEC-111 (Astro server islands) — completely orthogonal.

Can ship anytime against the current staging codebase. The PRs that closed SPEC-103 ops batch (#1077, #1080, #1085) do NOT block this work.

### Related

- `apps/api/src/routes/auth/handler.ts` (Better Auth wrapper — where Sentry capture should land).
- `apps/web/src/pages/[lang]/auth/signin.astro` (entry point that reads the query string).
- `apps/web/src/components/auth/SignIn.client.tsx` (island that renders the banner).
- `packages/i18n/src/locales/es/auth.json` (and `en`, `pt`) — new error code keys.
- SPEC-103 T-024 row (`apps/web/docs/auth-smoke-checklist.md`) — will be re-run as the final acceptance check.
