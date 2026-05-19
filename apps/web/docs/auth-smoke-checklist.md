# Auth Smoke Checklist

> Status: SHIPPED 2026-05-14 (SPEC-103 T-025)
> Last full execution: 2026-05-13 → 2026-05-14, staging tier
> Re-run trigger: after any change in `apps/api/src/routes/auth/**`, `apps/api/src/lib/auth.ts`, `apps/web/src/components/auth/**`, `apps/web/src/lib/auth-client.ts`, or any Better Auth / @repo/auth-ui upgrade.

This checklist is the operator's runbook to verify Hospeda's authentication paths end-to-end. Each row maps to a SPEC-103 T-0XX task. Run every row against staging first; promote to prod (manual signin only — no destructive flows) after staging is fully green.

## How to use

1. Pick a test email you control. Recommended pattern: `qazuor+staging-smoke-<date>@gmail.com` (Gmail accepts `+` aliases). Use a different alias per run to avoid colliding with previously-verified rows.
2. Use a **fresh browser profile** OR an incognito window so cookies from prior sessions don't mask flow issues.
3. Have the Sentry dashboard for both `hospeda-api` projects open in a second tab so you can observe events as they arrive.
4. For OAuth rows you'll be redirected to Google / Facebook consent screens — you need a real Google account and a real Facebook account.
5. Fail-fast: if a row fails, capture the network request (DevTools → Network → save HAR or screenshot the failing request) AND the container logs (`hops logs api --target=staging -n 200`) before retrying.

## Quick reference — Better Auth endpoint URLs

Hospeda uses Better Auth's bundled routes mounted at `/api/auth/*`. The path names below are what Better Auth actually exposes in the installed version (verified 2026-05-14):

| Flow | Method | Path |
|---|---|---|
| Email signup | POST | `/api/auth/sign-up/email` |
| Email signin | POST | `/api/auth/sign-in/email` |
| Request password reset | POST | `/api/auth/request-password-reset` |
| Reset password | POST | `/api/auth/reset-password` |
| Send verification email | POST | `/api/auth/send-verification-email` |
| OAuth (provider redirect) | GET | `/api/auth/sign-in/<provider>` |
| OAuth callback | GET | `/api/auth/callback/<provider>` |
| Get current session | GET | `/api/auth/get-session` |

Internal lockout-protected wrappers live at `apps/api/src/routes/auth/handler.ts` and shadow `/sign-in/email`, `/sign-up/email`, `/request-password-reset`, and `/send-verification-email`. The wrapper forwards to Better Auth after recording the attempt.

## Checklist

### Email lifecycle (T-012, T-015, T-017, T-018, T-019)

#### T-012 — Email signup happy path

- [ ] Open `https://staging.hospeda.com.ar/es/auth/signup/` in a fresh profile.
- [ ] Fill name, fresh email alias, password (≥ 8 chars).
- [ ] Submit. Expected: navigation to `/es/auth/verify-email-sent/` on the **staging** host (NOT localhost). UI shows "Casi listo. Te enviamos un correo...".
- [ ] DevTools Network: POST `/api/auth/sign-up/email` → 200 OK.
- [ ] DB check: `hops psql --target=staging "SELECT email, email_verified, created_at FROM users WHERE email = '<your-email>';"` returns a row with `email_verified = false`.
- [ ] Email arrives at Gmail inbox within 1-2 min (check spam/promotions).
- [ ] Email "from" address is `noreply@<sender domain>`, subject is `Verifica tu correo electrónico` (or equivalent).

#### T-019 — Email verification + resend

- [ ] Verify-email link in the inbox starts with `https://staging-api.hospeda.com.ar/api/auth/verify-email?token=...` (NOT localhost).
- [ ] Click the link in the inbox. Expected: redirect to `/es/mi-cuenta/` already authenticated (Better Auth signs the user in automatically post-verification).
- [ ] `users.email_verified` flips to TRUE in DB.
- [ ] **Resend flow**: in a fresh profile, repeat signup with a different fresh email. Before clicking the verify link, navigate to a "resend" UI control (if exposed) — POST `/api/auth/send-verification-email` should return 200 and a second email arrives.

#### T-015 — Email signin (valid + wrong-password + unknown-email + returnUrl guard)

- [ ] **Valid**: signin with the verified user. Expected: 200 + redirect to `redirectTo` (defaults to `/es/mi-cuenta/`).
- [ ] **Wrong password**: same email, garbage password. Expected: 401 + UI error banner.
- [ ] **Unknown email**: random email never registered + any password. Expected: 401 + UI error (do NOT leak "user not found" vs "wrong password" — both should map to same generic message for anti-enumeration).
- [ ] **Unverified email**: signin with a user whose `email_verified = false`. Expected: 401 + UI banner indicating verification required (Better Auth returns `EMAIL_NOT_VERIFIED` error code per `auth.ts:requireEmailVerification = true`).
- [ ] **returnUrl open-redirect guard**: navigate to `/es/auth/signin/?redirectTo=https://evil.com/foo`. Signin successfully. Expected: post-signin navigation lands on `https://staging.hospeda.com.ar/foo` (host stripped + reattached, NOT `evil.com`). The host-strip logic lives in `SignIn.client.tsx`.

#### T-017 — Forgot password happy path

- [ ] Navigate to `/es/auth/forgot-password/`.
- [ ] Submit with the verified user email.
- [ ] DevTools: POST `/api/auth/request-password-reset` → 200.
- [ ] UI: "Revisa tu email" success state.
- [ ] Reset email arrives in 1-2 min.
- [ ] Reset link starts with `https://staging.hospeda.com.ar/es/auth/reset-password/?token=...`.

#### T-018 — Reset password edge cases

Since SPEC-118 (PR #TBD) the reset-password page SSR-validates the token on first render and shows an error state **before** the form is rendered. The contract collapses three indistinguishable cases (used / tampered / unknown) into a single `invalid` reason; only `expired` is distinguishable.

- [ ] **Happy path**: click reset link, fill new password, submit. Expected: redirect to signin (or auto-signin). Signin with the NEW password works.
- [ ] **Expired token**: wait > Better Auth token TTL (1 hour by default unless overridden) and click the same link. Expected: page renders `ResetPasswordTokenError` with title "Este enlace expiró" and a "Solicitar nuevo enlace" CTA. **No password input is shown.**
- [ ] **Used token**: after happy-path completion, click the SAME reset link a second time. Expected: page renders `ResetPasswordTokenError` with title "Este enlace ya no es válido" and the same CTA. **No password input is shown.** (Distinct from "expired" wording.)
- [ ] **Invalid token**: hand-modify the token in the URL (delete or alter chars). Expected: same error state as "Used token" — title "Este enlace ya no es válido" + CTA. (See SPEC-118 Phase 0: indistinguishable from used.)
- [ ] **Missing token**: visit `/es/auth/reset-password/` without any `?token=` query. Expected: same `invalid` error state, no fetch to the API check endpoint (skipped at SSR).

### OAuth (T-013, T-014, T-016)

> Requires real Google + Facebook accounts. Use accounts you can revoke OAuth grants on without affecting production data. Suggested: a personal Google + a personal Facebook, separate from any role accounts.

#### T-013 — Google OAuth signup

- [ ] Fresh profile. Navigate to `/es/auth/signup/`. Click "Continuar con Google".
- [ ] Google consent screen appears with the app name and requested scopes (`email`, `profile`).
- [ ] Grant access.
- [ ] Expected: redirect to `/api/auth/callback/google` then to `/es/mi-cuenta/` already authenticated.
- [ ] DB: a new `users` row exists with `email_verified = true` (Google verified email) and an `accounts` row exists for that user with `provider = "google"`.

#### T-014 — Facebook OAuth signup

Same as T-013 with the Facebook button. Verify `accounts.provider = "facebook"` after.

#### T-016 — OAuth signin with auto-linking

- [ ] Sign in with **Google** using the email that's already registered via email signup. Expected: Better Auth auto-links the Google account to the existing user (assuming `auth.ts:accountLinking.allowDifferentEmails = false` and emails match). After consent: `accounts` table has 2 rows for that user — provider=email, provider=google.
- [ ] Sign out, sign in via email password (the original credentials). Expected: works as before.
- [ ] Sign in via Google again. Expected: same user session, not a new user row.

### Account linking cascade (T-020)

- [ ] Start with a fresh user signed up via email. After verification, 1 row in `accounts` (provider=email).
- [ ] Sign out. Sign in via Google with the same email. Expected: auto-linked. 2 rows in `accounts`.
- [ ] Sign out. Sign in via Facebook with the same email. Expected: auto-linked. 3 rows in `accounts`.
- [ ] Verify: `SELECT provider, account_id, created_at FROM accounts WHERE user_id = '<the-user-id>' ORDER BY created_at;` returns 3 distinct rows.

### Session lifecycle (T-021, T-022)

#### T-021 — Persistence + multi-browser + TTL

- [ ] **Persist across page reload**: signed in, reload `/es/mi-cuenta/` ten times. Expected: never redirected to signin.
- [ ] **Persist across browser restart**: signed in, close browser, reopen, navigate to `/es/mi-cuenta/`. Expected: still signed in (Better Auth cookie has 7-day TTL by default — see `/api/auth/get-session` response `session.expiresAt`).
- [ ] **Multi-browser**: signed in on Chrome, open Firefox (or a second profile), navigate to staging. Expected: Firefox starts unsigned in (sessions are per-browser).
- [ ] **TTL expiry**: ONLY testable manually by waiting 7 days OR by manually setting an old `expiresAt` in the DB row.

#### T-022 — Cross-environment session isolation

- [ ] Signed in on staging. Visit `https://api.hospeda.com.ar/api/auth/get-session` in the same browser. Expected: response body is `null` (staging cookies are domain-scoped to `staging-api.hospeda.com.ar`, prod-api ignores them).
- [ ] Repeat in reverse: signed in on prod (when prod has users), staging-api/get-session returns null.

### A11y (T-023)

- [ ] Open `/es/auth/signin/` with screen reader (NVDA on Windows, VoiceOver on macOS, Orca on Linux). Verify: page landmark announced, form label "Iniciar sesión" announced, inputs labeled.
- [ ] Tab through all interactive elements. Tab order should be: skip-to-content (if any) → logo → email → password → "Iniciar sesión" → "Continuar con Google" → "Continuar con Facebook" → "Olvidaste..." → "Registrate acá". No focus traps.
- [ ] Press Enter while focused on the password input. Expected: form submits.
- [ ] Verify `autocomplete="email"` on email and `autocomplete="current-password"` on password (password managers recognize).

### OAuth error logging (T-024)

> Re-run this row after deploying SPEC-120 (OAuth Cancel/Error Observability). Pre-SPEC-120 this row was PARTIAL: the redirect worked but no UI feedback and no Sentry event. Post-SPEC-120 it must be full PASS.

**Setup** (each test run):

1. Sign out of Hospeda staging (or open in private window).
2. Revoke the Hospeda grant on the provider you are about to test:
   - Google: `https://myaccount.google.com/permissions` → Hospeda → Remove access.
   - Facebook: `https://www.facebook.com/settings?tab=applications` → Hospeda → Remove.
3. Open DevTools → Network tab, tick **"Preserve log"**. Open Console tab too.
4. Open Sentry in another tab filtered to `environment:staging`, narrow to the last 10 minutes.

**Google cancel**:

- [ ] Navigate to `https://staging.hospeda.com.ar/es/auth/signin/`. Click "Continuar con Google". On the Google consent screen, click **Cancelar**.
- [ ] Verify: browser lands back on `/es/auth/signin/`. A banner is visible above the form reading "**Cancelaste el inicio de sesión con Google. Intentá de nuevo o usá otro método.**" (or the matching locale).
- [ ] Verify URL **after hydration** is exactly `https://staging.hospeda.com.ar/es/auth/signin/` (no `?error=`, no `#_=_`). Reload the page → banner does NOT reappear.
- [ ] Browser console shows `[OAuth] access_denied: (no description)`.
- [ ] Sentry has a new event titled `OAuth google signin failed: access_denied` with level `warning`, tags `module:auth.oauth`, `provider:google`, `error_code:access_denied`, `environment:staging`.

**Facebook cancel**:

- [ ] Same flow as above with "Continuar con Facebook" → **Cancel** on the consent dialog.
- [ ] Banner text reflects Facebook: "**Cancelaste el inicio de sesión con Facebook. Intentá de nuevo o usá otro método.**".
- [ ] URL after hydration is clean (no `?error=`, no `#_=_` — Facebook adds the trailing hash, the cleanup must strip it).
- [ ] Browser console shows `[OAuth] access_denied: Permissions error`.
- [ ] Sentry event titled `OAuth facebook signin failed: access_denied`, level `warning`, tags as above with `provider:facebook`. The Sentry event's `extra.provider_raw_query` includes `error_code:200`, `error_reason:user_denied`, `error_description:Permissions error`.

**Locale check** (optional):

- [ ] Repeat one provider cancel from `/en/auth/signin/` and `/pt/auth/signin/` — banner text reflects the active locale.

## Known issues and limitations

- **Server islands**: `/_server-islands/MobileMenuIsland/` returns HTTP 500 on staging due to an Astro 5.18.0 bug. Tracked as SPEC-111. Does NOT block auth smokes but mobile menu rendering is broken — testers using mobile may see a blank navbar.
- **Profile completion gap**: after email verify or OAuth signup, the user lands on `/es/mi-cuenta/` but the navbar shows no name. Tracked as SPEC-113 (introduces a mandatory profile-completion form).
- **English error messages**: Better Auth error messages display in English on Spanish pages (e.g. "Invalid email or password"). Tracked in SPEC-103 session task #30.
- **Missing &lt;h1&gt; headings**: `/auth/signin/` and `/auth/signup/` use only `<h2>` or no heading. Tracked in SPEC-103 session task #28.
- **Logo 404**: `/assets/images/logo-1.png` returns 404 on auth pages. Tracked in SPEC-103 session task #29.
- **OAuth credentials shared prod ↔ staging**: not isolated until SPEC-112 ships. Mitigation operativa: rotate shared credentials if compromised.

## Smoke execution log

Track each full run as a row:

| Date | Operator | Outcome | Failures | Notes |
|---|---|---|---|---|
| 2026-05-13 | qazuor | Initial run | T-017 forget-password 404 → fixed via PR #1075; T-012 redirect to localhost → fixed via PR #1072 | Two pre-launch bugs surfaced and shipped during the run |
| 2026-05-14 | qazuor + Playwright | Re-run after fixes | All automatable rows PASS; OAuth + cascade rows pending operator action | See SPEC-103 T-027 session tracker |
| 2026-05-14 | qazuor | OAuth smokes operator pass | None blocker; T-024 partial (observability gap, see side-finding #32) | Closed T-013/T-014/T-016/T-018/T-020 PASS, T-024 PARTIAL. Surfaced + fixed mid-run: admin SPA broken by `node:crypto` leak from `@repo/utils` (PR #1077 + #1080); FB OAuth redirect URI missing on staging (whitelisted in FB Developer Console). New side-findings #31..#34 added to TODOs.md. |

## Cross-spec references

- SPEC-103 T-012..T-024 — original smoke task IDs
- SPEC-109 — MercadoPago production toggle (auth flows must work before billing)
- SPEC-111 — Astro server islands fix (blocks T-087 web cutover)
- SPEC-112 — OAuth per-env separation (target 1 week pre-launch)
- SPEC-113 — Profile completion flow (mandatory intermediate step after first auth)
- SPEC-114 — Forget-password endpoint missing (CLOSED 2026-05-14 via PR #1075)
