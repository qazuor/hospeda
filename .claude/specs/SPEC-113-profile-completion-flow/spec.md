---
spec-id: SPEC-113
title: Profile completion flow — required intermediate step after first signup / OAuth
type: feat
complexity: medium-high
status: in-progress
created: 2026-05-14T04:15:00Z
effort_estimate_hours: 14-22
tags: [auth, onboarding, ux, profile, user-data, pre-public-launch]
discovered_during: SPEC-103 T-012 + T-019 auth smoke (2026-05-14)
priority: high (broken UX on first signup, pre-public-launch blocker)
---

# SPEC-113: Profile Completion Flow

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** After a user's FIRST successful authentication (email verify OR first OAuth signin), funnel them through a mandatory profile-completion form before granting full access to the app. The form collects baseline profile data (full name, optional phone, optional locale preference, etc.) so the rest of the UI has something to render.

**Why now:** Discovered during SPEC-103 T-012 smoke on 2026-05-14. After successful email signup + verification, the user landed on `/es/mi-cuenta/` already authenticated, but **the top navbar showed no text where the user's name should be** — because the DB row only had `email`. Better Auth's `signUp.email({email, password, name})` does persist `name`, but ONLY if the client passes it (which it does for email signup). For OAuth signins, Better Auth fills `name` from the OAuth provider profile — but the user may decline name sharing, or the provider returns an empty/unhelpful value.

The empty-name UX is broken on day-one of the user journey: the user has no visible identity in the app.

**Why a new spec:** This is a meaningful feature (multi-step onboarding flow with conditional rendering, state management, route guards). Out of scope for SPEC-103 (which is the post-merge cleanup batch). Belongs with the pre-public-launch hardening cohort (SPEC-109, SPEC-111, SPEC-112).

**Audience:** Solo developer (qazuor) plus eventual beta testers (~30-40 people) who will be the first to exercise the new flow.

---

### 2. Out of Scope

- Multi-step signup form replacing email/password screen. The signup screen stays minimal (email + password + optional name).
- Profile editing UI (already exists in `mi-cuenta/perfil/` per memory). This spec is about the FIRST-TIME flow, not editing.
- Social profile syncing (pull updated profile from Google/FB on every signin). Out of scope; one-shot import.
- Required validation against external services (email valid, phone valid). The form collects, persists, and trusts.

---

### 3. Requirements

#### 3.1 When the profile-completion form must appear

The user is redirected to `/es/mi-cuenta/completar-perfil/` (or similar route) when ALL of these hold:

- User is authenticated (Better Auth session valid).
- A flag on the user row is FALSE: e.g. `users.profile_completed` boolean defaulting to FALSE.
- The user is NOT currently on the completion route (to avoid redirect loops).

#### 3.2 Form fields (minimum viable)

- **Full name** (required, persists to `users.displayName` — the `display_name` column. Better Auth maps its virtual `name` field to `displayName` via `user.fields.name = 'displayName'` in `apps/api/src/lib/auth.ts`). Pre-filled from OAuth provider if available.
- **Display name / "Cómo querés que te llamemos"** (optional, separate field for casual addressing). Defaults to first word of full name.
- **Phone** (optional, for host contact features later). With country-code dropdown defaulting to Argentina.
- **Preferred locale** (optional, "es" | "en" | "pt" dropdown, defaults to URL locale at signup).
- **Newsletter opt-in** (optional checkbox, defaults to FALSE).
- Terms acceptance checkbox (required if not already accepted during signup).

#### 3.3 Pre-fill rules for OAuth signups

If the user arrived via Google OAuth:
- `name` <- Google's `name` claim
- `email` already populated by Better Auth
- `avatar` <- Google's `picture` claim (no form field; auto-persisted)

If via Facebook OAuth:
- `name` <- FB's `name` permission
- `email` <- FB's `email` permission (already populated)
- `avatar` <- FB's profile photo URL

If via email signup:
- `name` <- the name the user typed at signup (already in DB, just shown to confirm)

#### 3.4 Flow control

- After successful form submit: persist fields, set `users.profile_completed = true`, redirect to `users.redirect_after_complete` (defaults to `/mi-cuenta/`).
- If the user closes the tab mid-form: on next signin, middleware detects `profile_completed = FALSE`, redirects them back to completion form.
- Cannot bypass: any other protected route (`/mi-cuenta/*`, `/alojamientos/crear/*`, etc.) redirects to completion if flag is FALSE.
- Public routes (`/`, `/destinos/*`, `/alojamientos/`) work normally without requiring completion (browsing is fine).

#### 3.5 Skip rules (operator escape hatches)

- Admin / SuperAdmin role users skip the form (existing seed users like `superadmin@hospeda.com` should not be locked out).
- A signed-in user can be marked `profile_completed = true` directly via admin tools without filling the form (e.g. seed scripts, manual data migration).

#### 3.6 OAuth-only set-password sub-flow (absorbed from SPEC-103 T-094)

After the profile-completion form submits, if the user authenticated via OAuth (Google or Facebook) AND has NO Better Auth `credential`-type account row, a second screen offers them the chance to set a password so they can also sign in via email/password going forward.

**When this screen appears:**
- Profile completion submitted successfully (so `profile_completed = true` is already persisted).
- User row has at least one `account` of `providerId IN ('google', 'facebook')`.
- User row has ZERO `account` of `providerId = 'credential'`.

**Behavior:**
- Screen route: `/[lang]/mi-cuenta/agregar-contrasena/` (a step after `completar-perfil/`).
- Two CTAs: "Establecer contraseña" (primary) and "Saltar por ahora" (secondary). Both lead to `/mi-cuenta/`.
- "Skip" sets `users.set_password_prompted = true` so the user is not asked again on subsequent signins. Per-user one-shot prompt — they can still set a password later from `/mi-cuenta/perfil/seguridad/`.
- If submitted: hit Better Auth's `setPassword` endpoint, which creates a `credential` account row linked to the same user. On success: redirect to `/mi-cuenta/` with success toast.

**DB additions:**
- `users.set_password_prompted boolean NOT NULL DEFAULT false` — flips to true on first visit to the screen (skip or submit, both set it).

**Out of scope for §3.6:**
- Password reset email for credentialed users (that's a different existing flow).
- Force-set-password for OAuth-only users (always optional/skippable here).
- Removing/changing the password once set (that's profile editing under `mi-cuenta/perfil/seguridad/`).

---

### 4. Implementation Plan

#### Phase 0 — DB schema migration

Add to `users` table:
- `profile_completed boolean NOT NULL DEFAULT false` — flipped TRUE when the completion form is submitted (§3).
- `set_password_prompted boolean NOT NULL DEFAULT false` — flipped TRUE when OAuth-only user has either submitted or skipped the set-password screen (§3.6).

Backfill existing rows where `display_name IS NOT NULL AND display_name <> ''` to `profile_completed = TRUE` so existing seeded users aren't blocked. Also backfill `set_password_prompted = TRUE` for any user that has a `credential` account row (they already have a password, no need to ever prompt).

#### Phase 1 — Backend (api)

- Service: when a NEW user row is created via Better Auth (any path), both flags default to FALSE (DB default).
- New endpoint: `POST /api/v1/protected/profile/complete` accepting the form payload, validating, and setting `profile_completed = true` + updating user row.
- New endpoint: `POST /api/v1/protected/profile/set-password` accepting `{password}` payload, calling Better Auth's `setPassword` internally to create a `credential` account row, and setting `set_password_prompted = true` on success.
- New endpoint: `POST /api/v1/protected/profile/skip-set-password` — flips `set_password_prompted = true` without setting any password.
- Both endpoints: user can only update their own row.

#### Phase 2 — Frontend (web)

- New route: `/[lang]/mi-cuenta/completar-perfil/` rendering the completion form (React island).
- New route: `/[lang]/mi-cuenta/agregar-contrasena/` rendering the set-password screen (React island, only reachable when conditions in §3.6 hold).
- Update `apps/web/src/middleware.ts` to check both flags on protected routes:
  - If `profile_completed = false` → redirect to `completar-perfil`.
  - Else if OAuth-only AND `set_password_prompted = false` → redirect to `agregar-contrasena`.
  - Else → allow through.
- Pre-fill completion form via `user` from session (name/email).

#### Phase 3 — Frontend (admin)

- Same middleware guard for admin routes (`/_authed/*`). Optional based on policy: admin users probably skip per §3.5. Set-password sub-flow probably skipped for admin too (they signed in via email/password anyway).

#### Phase 4 — Migration of existing data

For the few beta testers who signed up BEFORE this lands (including the test users from SPEC-103 T-012):
- Run a script:
  - `UPDATE users SET profile_completed = TRUE WHERE display_name IS NOT NULL AND display_name <> '';` — grandfathers anyone with a display_name already set. (Note: Better Auth maps its `name` field to the `display_name` column via `user.fields.name = 'displayName'`.)
  - `UPDATE users SET set_password_prompted = TRUE WHERE id IN (SELECT user_id FROM account WHERE provider_id = 'credential');` — anyone with a password row never sees the set-password prompt.
- Anyone without a name will be funneled into the form on next signin — acceptable.

#### Phase 5 — UX polish

- Loading state on both forms (Suspense / skeleton).
- Submit button disabled until required fields are valid.
- Inline validation hints (e.g. name too short, phone wrong format, password length/strength).
- Success toast on each step completion before redirect.
- Skip button on set-password screen with confirmation modal: "Vas a poder establecerla más tarde desde tu perfil. ¿Continuar?"

---

### 5. Tasks (expand during work)

| Task | Title | Phase | Status |
|---|---|---|---|
| T-113-01 | DB migration: add `users.profile_completed` + `users.set_password_prompted` columns | 0 | completed |
| T-113-02 | Backend: POST /api/v1/protected/profile/complete endpoint | 1 | completed |
| T-113-03 | Backend: POST /api/v1/protected/profile/set-password + skip-set-password endpoints | 1 | completed |
| T-113-04 | Web: route + form + React island `ProfileCompletion.client.tsx` | 2 | completed |
| T-113-05 | Web: route + form + React island `SetPassword.client.tsx` | 2 | completed |
| T-113-06 | Web: middleware guard on protected routes (both flags) | 2 | completed |
| T-113-07 | Admin: middleware guard (if applicable) | 3 | pending |
| T-113-08 | Backfill script: profile_completed + set_password_prompted for grandfathered users | 4 | pending |
| T-113-09 | UX polish + tests (both flows) | 5 | pending |
| T-113-10 | Smoke validate end-to-end on staging (email signup path + Google OAuth path + FB OAuth path) | 5 | pending, blocked by 04..09 |

---

### 6. Risks

| Risk | Mitigation |
|---|---|
| Middleware guard causes redirect loop if user can't submit form | Whitelist the completion route in guard logic, test thoroughly |
| Existing beta testers with empty name field get blocked unexpectedly | Phase 4 backfill grandfathers anyone with non-null name. Anyone without name was already broken (the symptom) |
| OAuth provider returns name with characters that fail validation | Form validation lenient on names (allow accents, hyphens, spaces, apostrophes) |
| Admin users locked out of dashboard | §3.5 skip rule for admin roles, tested via admin smoke |
| Better Auth `setPassword` requires existing session — works since user is already authenticated when reaching the screen | Test path explicitly: middleware → completion form → set-password screen all share the same session |
| User skips set-password and locks themselves out if they forget their OAuth provider | One-shot prompt is acceptable: user can always set password later from `/mi-cuenta/perfil/seguridad/`. Skip button has confirmation modal warning them |

---

### 7. Acceptance Criteria

- [ ] Brand-new email signup → email verify → land on completion form → fill → land on /mi-cuenta/ with name visible in navbar (no set-password screen, already credentialed)
- [ ] Brand-new Google OAuth signup → consent → land on completion form pre-filled with Google name → submit → land on set-password screen → submit a password → /mi-cuenta/ with name visible, and the user can subsequently sign in via email/password too
- [ ] Brand-new Facebook OAuth signup → completion form → set-password screen → skip → /mi-cuenta/ visible, never prompted again on next signin
- [ ] User closes browser mid-form (completion OR set-password), opens again, signs in → redirected back to the unfinished step
- [ ] Admin role user signs in → does NOT see completion form, lands on /mi-cuenta/ directly (skip rule §3.5)
- [ ] Public routes (/, /destinos/, /alojamientos/) work without requiring completion
- [ ] Form-completion endpoint persists fields correctly + sets profile_completed = true
- [ ] Set-password endpoint creates a `credential` account row in DB linked to the user + sets set_password_prompted = true
- [ ] Skip-set-password endpoint sets set_password_prompted = true without touching account rows

---

## Part 2 — Implementation Notes

### Source

Discovered during SPEC-103 T-012 + T-019 smoke (2026-05-14 ~01:00 ART, completed ~04:10 ART). The user (qazuor) observed: after clicking the verify email link, they landed on `/es/mi-cuenta/` already authenticated, but the navbar showed no text where the user name should be. Reason: the user row had no `name` field populated yet because the signup form attempt that worked at the backend level didn't persist name correctly (different bug — addressed indirectly here since the completion flow would have caught it).

### Cross-spec dependencies

- SPEC-103 T-012 (email signup smoke) — discovered the issue
- SPEC-112 (per-env OAuth separation) — when staging gets dedicated OAuth clients, the consent screen branding could mention "complete your profile next" to set user expectations
- SPEC-111 (Astro server islands) — completion form is a React island; should not be affected by the server-island bug since the island uses `client:load` not `server:defer`

### When to start

Recommended: **immediately after auth smokes (SPEC-103 T-012..T-024) reveal further gaps**. The completion flow is a CRITICAL pre-public-launch piece — without it, beta tester onboarding has the broken-navbar UX from day one.
