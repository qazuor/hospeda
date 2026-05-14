---
spec-id: SPEC-113
title: Profile completion flow — required intermediate step after first signup / OAuth
type: feat
complexity: medium-high
status: draft
created: 2026-05-14T04:15:00Z
effort_estimate_hours: 8-16
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

- **Full name** (required, persists to `users.name`). Pre-filled from OAuth provider if available.
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

---

### 4. Implementation Plan

#### Phase 0 — DB schema migration

Add `users.profile_completed boolean NOT NULL DEFAULT false` and backfill existing rows where role IS NOT NULL to TRUE so existing seeded users aren't blocked.

#### Phase 1 — Backend (api)

- Service: when a NEW user row is created via Better Auth (any path), the row defaults to `profile_completed = false` (DB default). No code change here.
- New endpoint: `POST /api/v1/protected/profile/complete` accepting the form payload, validating, and setting `profile_completed = true` + updating user row.
- Service permission: user can only update their own row.

#### Phase 2 — Frontend (web)

- New route: `/[lang]/mi-cuenta/completar-perfil/` rendering the form (React island).
- Update `apps/web/src/middleware.ts` to check `profile_completed` on protected routes and redirect to completion if false.
- Pre-fill form via `user` from session (name/email).

#### Phase 3 — Frontend (admin)

- Same middleware guard for admin routes (`/_authed/*`). Optional based on policy: admin users probably skip per §3.5.

#### Phase 4 — Migration of existing data

For the few beta testers who signed up BEFORE this lands (including the test users from SPEC-103 T-012):
- Run a script: `UPDATE users SET profile_completed = TRUE WHERE name IS NOT NULL AND name != '';` to grandfather anyone with a name already set.
- Anyone without a name will be funneled into the form on next signin — acceptable.

#### Phase 5 — UX polish

- Loading state on the form (Suspense / skeleton).
- Submit button disabled until required fields are valid.
- Inline validation hints (e.g. name too short, phone wrong format).
- Success toast on completion before redirect.

---

### 5. Tasks (expand during work)

| Task | Title | Phase | Status |
|---|---|---|---|
| T-113-01 | DB migration: add `users.profile_completed` column | 0 | pending |
| T-113-02 | Backend: POST /api/v1/protected/profile/complete endpoint | 1 | pending |
| T-113-03 | Web: route + form + React island `ProfileCompletion.client.tsx` | 2 | pending |
| T-113-04 | Web: middleware guard on protected routes | 2 | pending |
| T-113-05 | Admin: middleware guard (if applicable) | 3 | pending |
| T-113-06 | Backfill script for existing users with name set | 4 | pending |
| T-113-07 | UX polish + tests | 5 | pending |
| T-113-08 | Smoke validate end-to-end on staging | 5 | pending, blocked by 03..07 |

---

### 6. Risks

| Risk | Mitigation |
|---|---|
| Middleware guard causes redirect loop if user can't submit form | Whitelist the completion route in guard logic, test thoroughly |
| Existing beta testers with empty name field get blocked unexpectedly | Phase 4 backfill grandfathers anyone with non-null name. Anyone without name was already broken (the symptom) |
| OAuth provider returns name with characters that fail validation | Form validation lenient on names (allow accents, hyphens, spaces, apostrophes) |
| Admin users locked out of dashboard | §3.5 skip rule for admin roles, tested via admin smoke |

---

### 7. Acceptance Criteria

- [ ] Brand-new email signup → email verify → land on completion form → fill → land on /mi-cuenta/ with name visible in navbar
- [ ] Brand-new Google OAuth signup → consent → land on completion form pre-filled with Google name → submit → /mi-cuenta/ with name visible
- [ ] User closes browser mid-form, opens again, signs in → redirected back to completion form
- [ ] Admin role user signs in → does NOT see completion form, lands on /mi-cuenta/ directly
- [ ] Public routes (/, /destinos/, /alojamientos/) work without requiring completion
- [ ] Form-completion endpoint persists fields correctly + sets profile_completed = true

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
