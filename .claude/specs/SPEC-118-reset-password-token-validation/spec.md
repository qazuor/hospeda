---
spec-id: SPEC-118
title: Reset-Password Page Validates Token at Load — UX Hardening
type: fix
complexity: low
status: completed
created: 2026-05-14T10:05:00Z
completed: 2026-05-14T00:00:00Z
completionRef: commit dc5bc86de (PR #1098) — feat(auth): validate reset-password token at page load (SPEC-118)
effort_estimate_hours: 2-4
tags: [auth, ux, reset-password, better-auth]
extracted_from: SPEC-103 operator OAuth smokes (session-finding-34) — 2026-05-14
priority: low
---

# SPEC-118: Reset-Password Page Token Validation at Load

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Validate the password-reset token on `GET /es/auth/reset-password/?token=…` BEFORE rendering the "set new password" form. If the token is dead (used, expired, malformed, or unknown), show a clear error state with a "request a new reset link" CTA instead of an input field the user will fill in for nothing.

**Why now:** Discovered during SPEC-103 T-018 operator smoke on 2026-05-14. After completing a happy-path reset (sub-test 1), the operator re-opened the SAME link from the email. Expected: an error like "token already used". Actual: the form rendered again as if the token were valid. Only after submitting a new password did the server return `Invalid token` and reject the request.

This is **security-OK** (Better Auth correctly invalidates the token server-side, so a used / forged token cannot reset anything), but the UX is **wrong**:

- A user who clicks a stale email link sees the form, gets a fresh "what password should I use?" anxiety moment, types a password, submits — and only then learns the link is dead.
- A user who follows a tampered or expired link has the same misleading experience.
- A support-desk debugging the link will spend cycles before realising the issue is at the token layer, not the password layer.

**Audience:** Solo developer (qazuor). Low-priority polish; can ship anytime, but the fix is small and noticeably improves the perceived reliability of the password-reset path.

---

### 2. Out of Scope

- Changes to the password-reset token TTL or rotation policy (Better Auth defaults are fine).
- Reset-email template changes.
- The `request-password-reset` flow (SPEC-114 already covered the endpoint rename and that whole path works correctly).
- Sentry capture for failed reset attempts (could be a follow-up; this spec is purely about the page UX).

---

### 3. Investigation Approach

#### Phase 0 — Identify the load-time validation API

- Better Auth exposes `/api/auth/reset-password` for the POST (set new password). What it does NOT clearly expose is a GET endpoint to *check* if a token is still valid without consuming it.
- Check Better Auth source / docs for an endpoint like `/api/auth/reset-password/verify-token`, `/api/auth/verify-reset-token`, or similar. If none exists, decide between:
  - **(a)** Adding a thin wrapper endpoint on the API side (e.g. `GET /api/auth/reset-password/check?token=…`) that calls Better Auth's internal validate function and returns `{ valid: boolean, reason?: 'used'|'expired'|'unknown' }`.
  - **(b)** Doing a "dry-run" POST with a sentinel marker so Better Auth can return `Invalid token` without performing the reset. Fragile — Better Auth contract may change.
  - **(c)** Validate format only at load (token shape / length / character set) and defer the real validation to submit, but show a clearer error state once submit fails.

Recommendation: **(a)**. Add a tiny GET endpoint that uses Better Auth's internal verification primitive. Cleanest contract, no semantic abuse.

##### Phase 0 — Decision (2026-05-14)

Investigation found Better Auth v1.4.18 does NOT expose any public primitive to verify a reset token without consuming it. Tokens are stored in the `verifications` table (`identifier`, `value`, `expiresAt`). On consume, Better Auth deletes the row — there is no `consumed_at` flag.

Implication: we can only honestly distinguish **2 states**, not 3:

- Row missing → could be "used" OR "unknown" — indistinguishable without instrumenting Better Auth (out of scope for a low-priority fix).
- Row present but past `expiresAt` → `expired`.
- Row present and live → `valid`.

**Decision: contract reduced to 2 reasons.**

```ts
{ valid: true } | { valid: false, reason: 'expired' | 'invalid' }
```

`invalid` covers used + tampered + never-existed with a single generic message. The UX-level CTA is identical for all of these ("Solicitá un enlace nuevo"), so the merged reason does not degrade the user experience. The "ya fue usado" wording from the original spec acceptance criteria is dropped in favor of "ya no es válido".

Implementation note: T-03 queries the `verifications` table directly via Drizzle (`@repo/db`) using the BA identifier prefix for password resets. Confirm exact prefix in dev DB during T-03.

#### Phase 1 — Server-side validation endpoint

- Add `GET /api/v1/public/auth/reset-password/check?token=<t>` returning `{ valid: true }` or `{ valid: false, reason: 'expired' | 'invalid' }` (see Phase 0 decision above for the 2-reason rationale).
- Keep the response constant-time (don't leak whether a token was once valid vs. never existed beyond the categorical reason).
- Apply rate limiting (same bucket as other auth endpoints, see SPEC-110).

#### Phase 2 — Page integration (web)

- `apps/web/src/pages/[lang]/auth/reset-password/index.astro` (or equivalent route file):
  - SSR: read `token` query string, call the validation endpoint, branch on result:
    - `valid: true` → render the existing form.
    - `valid: false, reason: 'expired'` → render "Este enlace expiró" + CTA "Solicitar nuevo enlace" linking to `/auth/forgot-password/`.
    - `valid: false, reason: 'invalid'` → render "Este enlace ya no es válido" + same CTA. (Covers used + tampered + unknown — see Phase 0 decision.)
  - On the happy path, the existing form continues to work unchanged; if the server somehow returns "valid" on load but rejects on submit (race / TTL boundary), the form's existing submit error handler keeps working as a safety net.
- i18n keys for the two error variants in `@repo/i18n` (es / en / pt — full translations).

#### Phase 3 — Tests + smoke

- Unit: page renders form for valid token, error state for each invalid reason.
- Integration: full happy-path reset still works (regression check).
- Manual smoke (mirrors T-018 sub-tests 2 + 3):
  - Used-token: reset once, re-open same link → page loads with "ya fue usado" + CTA, NO form input.
  - Invalid-token: hand-modify the token in the URL → page loads with "inválido" + CTA, NO form input.
- Mark T-018 in `apps/web/docs/auth-smoke-checklist.md` as PASS with no UX caveat.

---

### 4. Tasks

| Task | Title | Status |
|---|---|---|
| T-118-01 | Phase 0: confirm Better Auth has no built-in load-time verify endpoint (or find it) | pending |
| T-118-02 | Phase 1: implement `GET /api/auth/reset-password/check?token=…` with `{valid, reason}` response | pending, blocked by T-118-01 |
| T-118-03 | Phase 2: reset-password page SSR-validates and branches into form / error states | pending, blocked by T-118-02 |
| T-118-04 | Phase 2: add i18n keys for the three error states (used/expired/unknown) in es/en/pt | pending, blocked by T-118-02 |
| T-118-05 | Phase 3: unit + integration tests + manual smoke retest of T-018 | pending, blocked by T-118-03, T-118-04 |

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| Better Auth's internal verify primitive isn't exported, forcing us to copy logic | Worst case: maintain a small mirror that decodes the JWT-ish token Better Auth uses and checks the `verifications` table directly. Document the dependency. |
| The new check endpoint is abused as an oracle to enumerate valid tokens | The endpoint requires the *same* opaque token as the reset itself; an attacker who has the token can already reset. The endpoint doesn't expand the attack surface materially. Rate-limit + same TTL apply. |
| Race condition: token valid at load, used by another tab between load and submit | The existing form's submit-error handler catches the `Invalid token` server response — no degradation vs. today. |
| Adding SSR fetch slows down the page noticeably | The endpoint is local-network (same VPS); expected latency <20 ms. Acceptable. |

---

### 6. Acceptance Criteria

This spec is "done" when:

- [ ] Re-opening a used reset link renders the "ya no es válido" error state with a CTA to request a new link. No password input is shown.
- [ ] Visiting a reset URL with a hand-tampered token renders the same "ya no es válido" error state with the same CTA. No password input. (Phase 0 decision: used + tampered + unknown collapse to a single `invalid` reason.)
- [ ] Visiting a reset URL with an expired token renders the "enlace expiró" error state.
- [ ] Happy-path reset still works end-to-end (regression check via E2E).
- [ ] T-018 in `apps/web/docs/auth-smoke-checklist.md` can be marked PASS without "UX gap noted in session-finding-34".

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-103 T-018 sub-test 2 (used token) on 2026-05-14. The operator (qazuor) completed a happy-path password reset, then re-clicked the SAME link from the original email. The page rendered the form. Submitting it produced `Invalid token` from the server — confirming security is intact, but the UI gave no indication that the link was dead until submit.

Recorded as `session-finding-34` in `.claude/tasks/SPEC-103-vps-migration-post-merge-cleanup/TODOs.md`.

### Sequencing

Independent of:

- SPEC-114 (CLOSED — forgot-password endpoint rename via PR #1075). This spec is the matching UX hardening on the OTHER side of the reset flow.
- SPEC-120 (OAuth cancel observability — originally SPEC-117, renumbered) — same auth surface but distinct concern.
- The PRs that closed the SPEC-103 ops batch (#1077, #1080, #1085) do NOT block this work.

Can ship anytime against the current staging codebase. Worktree-independent.

### Related

- `apps/web/src/pages/[lang]/auth/reset-password/index.astro` (page to modify).
- `apps/api/src/routes/auth/handler.ts` (where to mount the new check endpoint).
- Better Auth source under `node_modules/better-auth/dist/...` (look for the internal `verifyResetToken` or equivalent during Phase 0 investigation).
- SPEC-103 T-018 row (`apps/web/docs/auth-smoke-checklist.md`) — re-run as final acceptance.
- SPEC-114 (CLOSED 2026-05-14 via PR #1075) — sibling spec on the request side of the same flow.
