# P0 Execution Spec — Pre-Beta Validation

> **Companion to**: `pre-beta-test-coverage-checklist.md` (full coverage map with priorities)
> **Scope**: only the 61 P0 items — concrete steps, acceptance criteria, and execution mode for each.
> **Created**: 2026-04-27
> **Status**: draft

This document is the **executable** companion to the coverage checklist. While the checklist describes WHAT to test, this spec describes HOW to test each P0 item. Items are expanded with steps, pass/fail criteria, and a mode tag.

---

## Mode tags

Each P0 item is tagged with one of:

- **`owner-manual`** — The owner (qazuor) executes in person. Used for: real-account journeys, MP sandbox / live transactions, mobile devices, manual SEO validation in Google, accessibility subjective checks, anything requiring human judgment or external account access.
- **`auto-runnable-CI`** — Lives as automated test (Playwright e2e in `apps/e2e`, integration test in `apps/api`/`packages/service-core`, axe-core a11y check). Runs unattended in CI on every PR.
- **`agent-runnable`** — Claude (or a sub-agent) can execute in a dev/staging session. Used for: scripted DB queries, Sentry capture verification, env var enumeration, structured log inspection, validations that require setup but not human presence.

---

## Item template

Each P0 item below follows this structure:

```text
### N: title

> **Mode**: owner-manual | auto-runnable-CI | agent-runnable
> **Estimated effort**: time for one execution
> **Source checklist**: link/reference

**Preconditions**:
- environment, fixtures, accounts, env vars

**Steps**:
1. Action → expected immediate observation
2. ...

**Acceptance criteria** (all must pass):
- [ ] criterion A
- [ ] criterion B

**Notes / known gotchas** (optional):
- non-obvious things to watch for
```

---

## A. Authentication and session (4 P0 items)

### 1: Signup with email/password + verification

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI; ~2 min if executed manually
> **Source**: checklist item #1

**Preconditions**:

- API + web running (local, staging, or e2e environment).
- Resend API key configured; test inbox accessible (e.g., MailHog locally, real `+test` alias on staging).
- Database in clean or known state (no pre-existing user with the test email).

**Steps**:

1. Navigate to `/auth/signup` (or the equivalent web entry point) → form renders with email, password, confirm password fields.
2. Submit a fresh email with a strong password → response is 200/201 and user record is created in DB with `emailVerifiedAt = null`.
3. Inspect outbox / mock mail server → verification email present, addressed to the signup email, contains verification link with single-use token.
4. Visit the verification link → account becomes active (DB shows `emailVerifiedAt` set), success page renders.
5. Re-visit the same verification link → token is rejected (single-use), no error revealing prior state.

**Acceptance criteria**:

- [ ] User row created with hashed password (never plaintext); `emailVerifiedAt` null until verification.
- [ ] Verification email arrives within 30 seconds in normal conditions.
- [ ] Token is signed and single-use; replay returns 400/410, not 500.
- [ ] After verification, user can sign in (covered separately by item #2).
- [ ] Signing up with an email already registered returns the same generic response as a new signup (anti-enumeration: the response body must not differ).
- [ ] Password complexity enforced server-side (Zod or Better Auth policy); weak password rejected with field-level error.

**Notes / gotchas**:

- Better Auth handles the token TTL — verify default is acceptable (typically 24h). Document the value somewhere reachable.
- On staging with real Resend, allowlist `+test` aliases or use a dedicated test inbox to avoid spam classification.
- The email body must include an unsubscribe-style escape clause if regulations require it; for transactional verification this is usually exempt — confirm with legal text already in `/legal/terminos`.

---

### 2: Signin happy path + invalid credentials

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #2

**Preconditions**:

- A verified user account exists (e.g., seeded fixture user `host@test.hospeda.com.ar` with known password).
- Auth cookie clear (incognito context in Playwright).

**Steps**:

1. Navigate to `/auth/signin` → form renders with email + password fields.
2. Submit valid credentials → response is 200, session cookie set, redirect to `/mi-cuenta` (or configured post-login route).
3. Submit valid email + wrong password → response is 401/400 with generic error message ("Credenciales inválidas" or equivalent). Cookie NOT set.
4. Submit non-existent email + any password → response is identical to step 3 (anti-enumeration). Same status code, same message, indistinguishable timing within ±100ms.
5. After 5 consecutive failed attempts from the same IP within 1 minute → response transitions to 429 (rate limit) — covered also by item #52.
6. Repeat the rate-limited request after backoff → succeeds with valid creds.

**Acceptance criteria**:

- [ ] Valid login sets session cookie with `Secure`, `HttpOnly`, `SameSite=Lax` (or stricter), correct domain scope, and TTL matching Better Auth config.
- [ ] Failed login returns the same status code, body shape, and timing whether the email exists or not (timing tolerance ±100ms).
- [ ] No JWT / session token leaked in URL or non-HTTP-only cookie.
- [ ] After 5 failed attempts, subsequent attempts return 429 within the rate-limit window.
- [ ] Successful login after rate limit window expires works without manual unblock.

**Notes / gotchas**:

- Better Auth wraps Better Auth APIs — confirm the underlying `/api/auth/sign-in/email` (or equivalent) returns consistent shapes; some auth libraries leak `user_not_found` vs `wrong_password` if not configured to harmonize errors.
- If the project has 2FA scaffolded, this test should skip the 2FA challenge by using a fixture user without 2FA enabled — separate test if 2FA is in scope (currently not for beta).

---

### 3: Password reset flow

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~45s in CI
> **Source**: checklist item #3

**Preconditions**:

- Verified user account exists with known initial password.
- Test inbox reachable (MailHog locally, dedicated alias on staging).

**Steps**:

1. Navigate to `/auth/forgot-password` (or equivalent) → form renders with email field.
2. Submit the registered user's email → response is 200 with generic success message ("If the email exists, you will receive instructions").
3. Submit a non-registered email → identical response (anti-enumeration).
4. Inspect inbox → reset email present only for the registered user, contains link with single-use token.
5. Visit the reset link → form renders to set new password.
6. Submit new password (passing complexity rules) → response is 200, user is signed out of any existing sessions.
7. Sign in with the OLD password → fails with 401.
8. Sign in with the NEW password → succeeds.
9. Re-visit the original reset link → rejected (single-use).
10. Submit an expired token (TTL exceeded — simulate via clock skew or fixture) → rejected with 400/410.

**Acceptance criteria**:

- [ ] Reset email is generic in subject and body (no "Hello [Name]" leakage if the user enumerated this) — actually, personalization with the name is acceptable since the receiver IS the legitimate owner.
- [ ] Reset token is single-use, time-limited (default 1h or as configured), and cryptographically signed.
- [ ] After successful password change, all existing sessions for that user are invalidated (security requirement).
- [ ] No enumeration possible from the request-reset endpoint (timing + body identical for existing vs non-existing email, tolerance ±100ms).
- [ ] Old password rejected post-reset.

**Notes / gotchas**:

- Sessions invalidation requires Better Auth to support session revocation on password change — verify the config or document the gap.
- Expired token testing in CI usually uses a fixture token created in the past via DB insert — Playwright cannot easily wait 1h.

---

### 4: Logout and session expiration

> **Mode**: `auto-runnable-CI` for logout + `agent-runnable` for expiration audit
> **Estimated effort**: ~30s in CI for logout; ~10min for cookie audit
> **Source**: checklist item #4

**Preconditions**:

- User signed in (from item #2 fixture).
- Browser dev tools / API client able to inspect cookie attributes.

**Steps**:

**Part A — Logout**:

1. From a signed-in session, click logout (or POST to logout endpoint) → response is 200/204.
2. Verify session cookie is cleared (Set-Cookie with empty value + `Max-Age=0` or past expiration).
3. Attempt to access a protected endpoint (e.g., `/api/v1/protected/auth/me`) → response is 401.
4. The cookie sent on subsequent requests is empty / not present.

**Part B — Cookie attributes audit**:

1. Sign in and inspect Set-Cookie header from `/api/auth/sign-in` response.
2. Confirm: `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict` if appropriate), correct `Domain`, `Path=/`, `Expires` or `Max-Age` matching Better Auth TTL.
3. In production environment, `Secure` MUST be set; verify staging/prod build correctly toggles this based on env.

**Part C — Session expiration**:

1. Manually adjust a fixture session's `expiresAt` in DB to the past (or wait for natural expiration if TTL is short for tests).
2. Make a request with the expired cookie → response is 401.
3. The expired session is removed/invalidated server-side after first rejected access.

**Acceptance criteria**:

- [ ] Logout clears the cookie and invalidates the server-side session record.
- [ ] After logout, no protected endpoint accepts the previous session ID.
- [ ] Cookie has `HttpOnly`, `Secure` (in production), `SameSite=Lax` or stricter, and correct `Domain` scope.
- [ ] Expired sessions are rejected and cannot be reused even if the cookie is replayed.
- [ ] Cookie TTL matches the configured Better Auth value and is enforced server-side (not just client-side expiration).

**Notes / gotchas**:

- Cross-app session (covered by item #5, P1) is NOT in scope here. Focus is single-app cookie hygiene.
- If using middleware that reads the session, ensure 401 returns from the middleware (not from a downstream handler), to avoid leaking handler-specific behavior.

---

## B. Authorization and permissions (3 P0 items)

### 7: IDOR on protected accommodations

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #7

**Preconditions**:

- Two distinct HOST fixture accounts: `host_a@test.hospeda.com.ar` and `host_b@test.hospeda.com.ar`.
- `host_a` has at least one accommodation with a known `id`.
- Both accounts are authenticated; session tokens for each are available in the test.

**Steps**:

1. Sign in as `host_b` → obtain session cookie.
2. PATCH `/api/v1/protected/accommodations/{host_a_accommodation_id}` with valid body (e.g. `{ "name": "Hijacked" }`) using `host_b`'s session → response is 403 (not 404, not 200).
3. Confirm the accommodation name in DB is unchanged.
4. Repeat step 2 for DELETE on same ID → 403.
5. Repeat the same pattern on a bookmark owned by `host_a`: PATCH `/api/v1/protected/user-bookmarks/{host_a_bookmark_id}` with `host_b` session → 403.
6. Repeat for a conversation where `host_b` is not a participant: GET `/api/v1/protected/conversations/{host_a_conversation_id}` → 403.

**Acceptance criteria** (all must pass):

- [ ] PATCH a foreign accommodation returns exactly 403 (not 404, not 200, not 500).
- [ ] DELETE a foreign accommodation returns exactly 403.
- [ ] No DB mutation occurs on any rejected request.
- [ ] Foreign bookmark access returns 403.
- [ ] Foreign conversation access returns 403.
- [ ] Response body does not reveal whether the resource exists (no "item not found" vs "access denied" leak).

**Notes / gotchas**:

- The `BaseCrudService` ownership check must use `actor.id` compared to `ownerId`; verify the check happens before any mutation logic.
- If the API returns 404 for forbidden foreign resources, that is acceptable anti-enumeration practice but must be consistent. Document the chosen policy here.

---

### 8: Privilege escalation via mass assignment

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #8

**Preconditions**:

- A regular USER account authenticated (not HOST, not ADMIN).
- API running with Zod schemas applied to all PATCH/PUT endpoints.

**Steps**:

1. PATCH `/api/v1/protected/users/{own_user_id}` with body `{ "role": "ADMIN", "lifecycleState": "ACTIVE" }` → request processed (200 or 400), but `role` and `lifecycleState` fields are NOT updated.
2. Fetch the user record from DB → `role` is still `USER`, `lifecycleState` unchanged.
3. PATCH same endpoint with `{ "emailVerifiedAt": "2020-01-01T00:00:00Z" }` → field silently dropped or 400.
4. POST to create a new accommodation with body including `"lifecycleState": "ACTIVE"` as a regular USER → 403 (users cannot create accommodations; that's a HOST-only action) OR if creation is allowed, the `lifecycleState` is forced to the appropriate draft/pending state.
5. PATCH own profile with `{ "permissions": ["*"] }` → field stripped or 400.

**Acceptance criteria** (all must pass):

- [ ] `role` field cannot be self-assigned via any public/protected endpoint; DB value unchanged after attempt.
- [ ] `lifecycleState` cannot be set by the resource owner via PATCH; it follows controlled transitions only.
- [ ] `emailVerifiedAt` cannot be self-assigned.
- [ ] `permissions` array cannot be self-assigned or expanded.
- [ ] No 500 error occurs from any of the above payloads (Zod `strip` handles unknown fields gracefully).

**Notes / gotchas**:

- Zod `strip` mode (the default) silently drops unknown fields — verify the input schema does not use `passthrough`. Grep for `.passthrough()` in `@repo/schemas` and `apps/api/src` to confirm.
- The admin-only `PATCH /api/v1/admin/users/{id}` route IS allowed to change roles; this test only covers the protected (self-service) endpoint.

---

### 9: Access to admin endpoints without permission

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #9

**Preconditions**:

- One USER session token and one HOST session token (not ADMIN).
- Representative list of admin endpoints to test (see steps).

**Steps**:

1. With USER session: GET `/api/v1/admin/accommodations` → 403.
2. With USER session: GET `/api/v1/admin/users` → 403.
3. With USER session: POST `/api/v1/admin/users/{id}/roles` (or PATCH for role assignment) → 403.
4. With USER session: POST `/api/v1/admin/billing/refund` (or equivalent) → 403.
5. With USER session: GET `/api/v1/admin/cron` → 403.
6. With HOST session: repeat all steps above → all 403.
7. With unauthenticated request (no cookie): GET `/api/v1/admin/accommodations` → 401 (not 403).

**Acceptance criteria** (all must pass):

- [ ] All `/api/v1/admin/*` endpoints return 403 for USER and HOST actors.
- [ ] Unauthenticated requests return 401, not 403.
- [ ] Response body does not reveal endpoint implementation details (no stack trace, no route handler names).
- [ ] No endpoint in the admin tier is accidentally registered with `skipAuth: true`.

**Notes / gotchas**:

- The admin middleware should check `PermissionEnum` values, not raw role strings. Verify by reading `apps/api/src/middlewares/` for the admin guard.
- A grep for `skipAuth: true` in `apps/api/src/routes/` admin subdirectories should return zero results; include this as a CI lint check.

---

## C. Host onboarding (SPEC-091) (5 P0 items)

### 11: End-to-end publication of a new accommodation

> **Mode**: `owner-manual`
> **Estimated effort**: ~45min for one full walkthrough
> **Source**: checklist item #11

**Preconditions**:

- User account verified (`emailVerifiedAt` set) but NOT yet HOST.
- Browser on desktop (run separately on mobile for item #76).
- Real Cloudinary credentials configured (not test mock).

**Steps**:

1. Navigate to `/es/publicar` → landing page renders with CTA and value proposition → click "Publicar mi alojamiento".
2. If not signed in → inline signup/signin modal opens without leaving the page → complete auth → return to `/es/publicar/nueva` automatically.
3. Section 1 (Basic info): fill `name`, `type`, `description` → click "Siguiente" → no validation errors.
4. Section 2 (Location): select destination from hierarchy picker, fill address → "Siguiente".
5. Section 3 (Details): fill capacity, bedrooms, bathrooms → "Siguiente".
6. Section 4 (Amenities): select at least 3 → "Siguiente".
7. Section 5 (Photos): upload 5 JPG files via drag-and-drop → thumbnails appear within 5s each → "Siguiente".
8. Section 6 (Pricing): enter nightly rate → "Siguiente".
9. Section 7 (Availability): mark at least one period → "Siguiente".
10. Section 8 (Review): review summary, click "Publicar" → loading state → success redirect to `/es/alojamientos/{slug}`.
11. Confirm in DB: `accommodations.lifecycleState = 'ACTIVE'`, user `role` updated to `HOST`.
12. Navigate to `/es/mi-cuenta/propiedades` → new property listed.

**Acceptance criteria** (all must pass):

- [ ] Every section navigates forward and backward without data loss.
- [ ] Photo thumbnails render immediately after Cloudinary upload completes.
- [ ] Final publish sets `lifecycleState = ACTIVE` and assigns HOST role.
- [ ] Detail page (`/es/alojamientos/{slug}`) is publicly accessible immediately after publication.
- [ ] Welcome + "property published" email received in real inbox within 2 minutes.
- [ ] Audit log contains `created_accommodation` and `role_assigned` events for this user.
- [ ] No Sentry errors during the full flow.

**Notes / gotchas**:

- SPEC-091 defines the 8-section form. If sections differ, update step numbering accordingly.
- Trial activation (no card required) must happen automatically on publish; verify `billing_subscriptions` row is created with `status = 'trialing'`.

---

### 12: Autosave and draft persistence

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #12

**Preconditions**:

- User account with no prior draft in progress.
- Desktop browser with ability to close and reopen tabs.

**Steps**:

1. Navigate to `/es/publicar/nueva` → start filling Section 1 with a distinctive name ("Cabaña Autosave Test").
2. Fill sections 1 through 4 without completing → after 30s of inactivity or on section transition, autosave triggers → confirm via network tab (PATCH or POST to draft endpoint).
3. Close the browser tab entirely (do not click "Guardar").
4. Reopen `/es/publicar` → banner "Continue where you left off" (or equivalent) appears → click to resume.
5. Verify all filled data from sections 1-4 is intact.
6. Wait 24 hours (or simulate by fast-forwarding draft `updatedAt` in DB if testing) → return, confirm draft still present.
7. Complete and publish → draft state cleared from storage.

**Acceptance criteria** (all must pass):

- [ ] Autosave fires within 60 seconds of last input change (or on section transition).
- [ ] Closing and reopening shows the "continue draft" entry point prominently.
- [ ] All previously entered data restored accurately — no field truncation or type coercion errors.
- [ ] Draft expires after 30 days (or defined TTL); verify the TTL value is documented.
- [ ] Publishing clears the draft state so a second attempt starts fresh.

**Notes / gotchas**:

- Draft storage may be localStorage, sessionStorage, or server-side. Confirm which — if localStorage, test across different browsers and private mode where localStorage is cleared.
- If server-side draft: verify the draft endpoint requires auth (not publicly accessible via direct ID guessing).

---

### 13: Per-section form validations

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~45s in CI
> **Source**: checklist item #13

**Preconditions**:

- Playwright e2e environment with web app running.
- Spanish locale active (`/es/publicar/nueva`).

**Steps**:

1. Navigate to `/es/publicar/nueva` → Section 1 renders.
2. Click "Siguiente" without filling any field → validation errors appear for `name` and `description` → form does not advance.
3. Fill `name` with 1 character (below minimum) → "Siguiente" → error message references `name` length.
4. Fill valid `name` and `description` but leave `type` unselected → error for `type`.
5. Fill all Section 1 fields validly → proceed to Section 5 (Photos) → attempt to proceed without uploading the minimum required photos → error.
6. In Section 6 (Pricing) enter `0` as nightly price → error (price must be > 0).
7. In Section 6 enter a negative price → error.
8. Confirm all error messages are in Spanish (not English or raw Zod keys).

**Acceptance criteria** (all must pass):

- [ ] Empty required fields block section progression with visible error per field.
- [ ] `name` too short shows a human-readable Spanish error.
- [ ] Missing `type` selection shows error.
- [ ] Below-minimum photo count shows error before section advances.
- [ ] Price = 0 or negative shows validation error.
- [ ] All error strings are in Spanish (locale `es`).
- [ ] No network call is made when client-side validation fails (no wasted server round-trip).

---

### 14: Photo upload to Cloudinary

> **Mode**: `auto-runnable-CI` + `owner-manual`
> **Estimated effort**: ~40s in CI for automated leg; ~10min manual for mobile camera test
> **Source**: checklist item #14

**Preconditions**:

- Real Cloudinary credentials in `HOSPEDA_CLOUDINARY_*` env vars (or test Cloudinary account for CI).
- 5+ test images: 3 valid JPGs, 1 PNG, 1 WebP, 1 oversized file (>10MB), 1 invalid type (`.txt`).

**Part A (automated)**:

1. Navigate to photo upload section of the onboarding form.
2. Upload 3 valid JPG files sequentially → each shows a thumbnail within 5 seconds → Cloudinary URL stored in draft state.
3. Upload the `.txt` file → immediate client-side rejection with "invalid file type" error → no network call to Cloudinary.
4. Upload the oversized JPG → rejection with "file too large" message before or during upload.
5. Delete thumbnail of photo #2 → thumbnail removed, Cloudinary asset scheduled for deletion.
6. Reorder photo #3 to position #1 (drag-and-drop) → order persisted in draft.

**Part B (owner-manual, mobile)**:

1. Open `/es/publicar/nueva` on real iOS Safari and Android Chrome.
2. Reach photo section → tap "Add photos" → native camera/gallery picker opens.
3. Take a photo with camera → upload → thumbnail appears within 10 seconds on mobile connection.
4. Verify rate limit (SPEC-079) does not trigger for a normal upload session of 10 photos.

**Acceptance criteria** (all must pass):

- [ ] Valid JPG, PNG, and WebP files upload successfully and show thumbnails.
- [ ] `.txt` and other non-image MIME types rejected before upload starts.
- [ ] Files exceeding size limit rejected with clear message (not a generic error).
- [ ] Delete removes the thumbnail and the asset is marked for Cloudinary deletion.
- [ ] Reorder persists correctly in draft state.
- [ ] Mobile camera picker functional on iOS Safari and Android Chrome (manual).
- [ ] 10 photos uploaded in one session does NOT trigger the rate limiter.

**Notes / gotchas**:

- Cloudinary's free tier has rate limits — use a dedicated test Cloudinary account in CI, not the production account.
- The `apply-postgres-extras.sh` script or Cloudinary media health route (`/api/v1/public/health/media`) can be used to verify credentials before running the upload test.

---

### 15: Editing an already published property

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #15

**Preconditions**:

- HOST account with at least one `ACTIVE` accommodation already published.
- The detail page URL for that accommodation is known.

**Steps**:

1. Navigate to `/es/mi-cuenta/propiedades` → list of own properties visible.
2. Click "Edit" on the target property → form loads at `/es/mi-cuenta/propiedades/{id}/editar` with current values pre-populated.
3. Change the nightly price to a new value (e.g. from 5000 to 7500 ARS).
4. Save → PATCH request succeeds (200) → success feedback shown.
5. Navigate to the public detail page `/es/alojamientos/{slug}` → new price appears within 60 seconds (ISR revalidation).
6. Upload one additional photo via the edit form → thumbnail appears, Cloudinary URL saved.
7. Save → confirm new photo appears in the public gallery after ISR refresh.

**Acceptance criteria** (all must pass):

- [ ] Edit form pre-populates all existing fields correctly.
- [ ] Price change persisted in DB immediately after save.
- [ ] Public detail page reflects the new price within 60 seconds.
- [ ] New photo appears in the public gallery after ISR refresh.
- [ ] No `lifecycleState` change occurs as a side-effect of editing (accommodation stays `ACTIVE`).

**Notes / gotchas**:

- ISR revalidation is triggered via the `/api/v1/admin/revalidation` endpoint. Verify this is called server-side on accommodation update (check the service or route handler).
- If ISR is not working, the page will still show the old price until the next full rebuild — flag this as a defect.

---

## D. Public browsing (tourist) (4 P0 items)

### 17: Home page rendering + ISR

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #17

**Preconditions**:

- Web app running with seed data loaded (minimum: 10 active accommodations, 3 destinations).
- Playwright configured to measure LCP via `page.evaluate` or Lighthouse CI.

**Steps**:

1. Navigate to `/es` (home page) → page renders without errors → H1 visible, featured accommodation cards present.
2. Measure LCP: use `new PerformanceObserver` via `page.evaluate` → LCP < 2500ms.
3. Verify featured accommodations section shows at least 3 cards, each with name, image, and price.
4. Via admin API, update a featured accommodation's name → trigger ISR revalidation via `POST /api/v1/admin/revalidation` with appropriate `path` payload.
5. After revalidation (wait up to 10s), re-navigate to `/es` → updated name appears without full rebuild.

**Acceptance criteria** (all must pass):

- [ ] Home page renders with HTTP 200 and no JS console errors.
- [ ] LCP < 2500ms on desktop viewport (1280x720) with a warm server cache.
- [ ] Featured cards render name, image thumbnail (Cloudinary URL), and nightly price.
- [ ] After ISR revalidation trigger, updated content appears within 10 seconds on next request.
- [ ] No Sentry errors captured during page load.

**Notes / gotchas**:

- LCP measurement in Playwright requires using `PerformanceObserver` in the browser context, as Playwright does not expose Lighthouse natively. Alternatively, run Lighthouse CI as a separate step.
- ISR in Astro uses `experimental.revalidate` or `Cache-Control` headers — confirm the mechanism in `apps/web/astro.config.mjs`.

---

### 18: Accommodation listings with filters

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~45s in CI
> **Source**: checklist item #18

**Preconditions**:

- Seed data with accommodations in at least 2 destinations, 2 types, varied prices, and various amenities.
- Web app running at `/es/alojamientos`.

**Steps**:

1. Navigate to `/es/alojamientos` → default listing renders with pagination (12 or configured `pageSize` per page).
2. Apply destination filter (select "Concepción del Uruguay") → URL updates with `?destination={id_or_slug}`, results filter to that destination only.
3. Apply type filter (e.g. "Cabaña") → results further filtered; count decreases or stays same.
4. Apply price range filter (min=1000, max=5000) → results show only accommodations within range.
5. Apply amenity filter (e.g. "Pileta") → results show only accommodations with that amenity.
6. Apply sort "Precio: menor a mayor" → first card has the lowest price among results.
7. Navigate to page 2 → pagination works, different results shown.
8. Send request with invalid filter `?price=abc` → page renders without 500 error; filter ignored or shown as validation hint.
9. Send request with unknown query param `?hack=1` → 200 response, unknown param silently ignored (SPEC-089 compliance: no 400 for extra params on public routes).

**Acceptance criteria** (all must pass):

- [ ] Default listing renders with correct count and pagination controls.
- [ ] Each filter correctly narrows results; combined filters apply correctly (AND logic).
- [ ] Sort by price ascending shows correct order.
- [ ] Pagination shows the correct subset of results per page.
- [ ] Invalid filter value does not cause 500; page degrades gracefully.
- [ ] Unknown query params are silently ignored (no 400 on public listing endpoint).
- [ ] Filtered URL is shareable (all filter state reflected in query string).

**Notes / gotchas**:

- SPEC-089 (public filter alignment) just landed. Verify that `accommodationsApi.listByOwner` uses the new filter schema; the public listing endpoint is separate but same principle applies.
- The `safeIlike` helper must be used for any `search` text filter — confirm via grep on the accommodation service.

---

### 19: Accommodation detail page

> **Mode**: `auto-runnable-CI` + `owner-manual`
> **Estimated effort**: ~40s in CI; ~10min manual for full visual inspection
> **Source**: checklist item #19

**Preconditions**:

- At least one `ACTIVE` accommodation with: photos, description, amenities, location, at least 1 review, and a host with other accommodations.

**Part A (automated)**:

1. GET `/es/alojamientos/{slug}` → HTTP 200, no JS errors.
2. Verify `<title>` tag contains accommodation name.
3. Verify `<meta name="description">` is present and non-empty.
4. Verify `<script type="application/ld+json">` present with `@type: "LodgingBusiness"` schema.
5. Verify breadcrumb renders: "Inicio > Destinos > {Destination} > {Accommodation name}".
6. Verify "Other properties from this host" section appears with at least 1 card (SPEC-089 `listByOwner`).
7. Verify nearby events section (if events exist for that destination) renders with upcoming event cards.

**Part B (manual)**:

1. Open the detail page in browser → visually inspect: photo gallery functional (next/prev), map displays correct pin, amenity list complete, reviews section with star ratings.
2. Confirm "Contact host" button visible and clickable (links to conversation flow).

**Acceptance criteria** (all must pass):

- [ ] HTTP 200 and no JS console errors.
- [ ] `<title>` contains accommodation name.
- [ ] `meta description` present.
- [ ] JSON-LD `LodgingBusiness` structured data valid (parseable JSON, required fields present).
- [ ] Breadcrumb reflects correct hierarchy.
- [ ] "Other properties from this host" section shows only OTHER accommodations by the same host (not the current one).
- [ ] Nearby events section renders correctly when events for the destination exist.
- [ ] Photo gallery navigates between photos.
- [ ] "Contact host" CTA visible.

**Notes / gotchas**:

- SPEC-089 introduced `listByOwner` — confirm the detail page calls this endpoint and not an ad-hoc filtered list.
- JSON-LD validation can be automated by parsing the `<script type="application/ld+json">` content and checking required fields (`name`, `address`, `geo`, `priceRange`).

---

### 21: Browse by destination (hierarchy)

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #21

**Preconditions**:

- Destination hierarchy in DB: `Argentina > Litoral > Entre Ríos > Concepción del Uruguay` (or equivalent per seed data from SPEC-095).
- At least 2 accommodations assigned to the leaf destination.

**Steps**:

1. Navigate to `/es/destinos/argentina/litoral/entre-rios/concepcion-del-uruguay` (or the actual slug path) → page renders HTTP 200.
2. Verify breadcrumb: "Inicio > Destinos > Argentina > Litoral > Entre Ríos > Concepción del Uruguay".
3. Verify accommodations listing section shows only accommodations in that destination (and descendants if applicable).
4. Navigate to parent destination `/es/destinos/argentina/litoral/entre-rios` → accommodations from all child destinations shown.
5. Navigate to `/es/destinos` → list of top-level destinations shown with child counts.
6. Verify the `by-path` API endpoint used: GET `/api/v1/public/destinations/by-path?path=/argentina/litoral/entre-rios/concepcion-del-uruguay` → returns the destination object with correct `id`.

**Acceptance criteria** (all must pass):

- [ ] Leaf destination page renders with correct name, description, and filtered accommodations.
- [ ] Breadcrumb is correct at each level of the hierarchy.
- [ ] Parent destination aggregates accommodations from all child destinations.
- [ ] `/es/destinos` index page renders top-level destinations.
- [ ] `by-path` API resolves the slug path to the correct destination ID.
- [ ] No 404 or 500 for any valid slug path in the seed data.

**Notes / gotchas**:

- SPEC-095 cleaned up destination FK relationships; verify that the hierarchy in DB matches the URL slugs in the web routes.
- The `[...path].astro` catch-all handles all depth levels — confirm it handles 1-deep and 4-deep paths correctly.

---

## E. User account (web) (2 P0 items)

### 26: Guest-owner messaging (SPEC-085)

> **Mode**: `auto-runnable-CI` + `owner-manual`
> **Estimated effort**: ~50s in CI; ~15min manual for real email verification
> **Source**: checklist item #26

**Preconditions**:

- One HOST with an `ACTIVE` accommodation and a real email address.
- One GUEST (unauthenticated) or USER account.
- Resend configured; test inbox accessible.

**Part A (automated)**:

1. As GUEST, navigate to accommodation detail page → "Contact host" button visible.
2. Click "Contact host" → either inline form appears (guest messaging) or redirect to sign-in if login required → verify no broken UI.
3. As authenticated USER: navigate to detail page → click "Contact host" → conversation creation form opens.
4. Submit message "Hola, me interesa reservar para enero" → POST to `/api/v1/public/conversations` or `/api/v1/protected/conversations` → conversation created with status `OPEN`.
5. Host inbox at `/es/mi-cuenta/messages` → new conversation listed with guest's initial message.
6. HOST replies: POST message to conversation → guest receives notification.

**Part B (manual)**:

1. Execute steps 2-6 in a real browser with real Resend email delivery.
2. Verify host receives email notification with message preview and direct link to conversation.
3. HOST replies from `/es/mi-cuenta/messages/{conversationId}` → guest receives reply email.
4. Verify emails arrive in correct language (`es` for both Spanish-locale users).

**Acceptance criteria** (all must pass):

- [ ] Conversation created with status `OPEN`, `guestEmail` and `hostId` set correctly.
- [ ] Host receives email notification within 2 minutes of guest's first message.
- [ ] Host reply creates a new message in the conversation and triggers guest email notification.
- [ ] Conversation listed in `/es/mi-cuenta/messages` for the HOST.
- [ ] Guest (if non-logged-in) can access their conversation via the token link in the email.
- [ ] Email template renders in Spanish for es-locale users.

**Notes / gotchas**:

- SPEC-085 is now implemented. The guest access flow uses a one-time token in the email link — verify the token is single-use and expires.
- The guest token route is at `/es/guest/messages/{token}` — confirm the Astro page exists (confirmed in earlier file listing).

---

### 27: Conversations — states and permissions

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #27

**Preconditions**:

- An `OPEN` conversation between GUEST and HOST.
- A third USER account that is NOT a participant in the conversation.

**Steps**:

1. GUEST accesses conversation via token link → messages visible, can reply → status remains `OPEN`.
2. HOST closes the conversation from the UI → conversation status transitions to `CLOSED` → a `SYSTEM` message appears in the thread indicating closure.
3. GUEST attempts to send a message to a `CLOSED` conversation → rejected with appropriate error (400 or shown "conversation closed" state in UI).
4. Third USER (logged in) attempts to GET `/api/v1/protected/conversations/{conversation_id}` → 403.
5. Third USER attempts to POST a message to the conversation → 403.
6. HOST can reopen the conversation (if that flow exists) OR creates a new one.

**Acceptance criteria** (all must pass):

- [ ] Conversation `OPEN` → `CLOSED` transition works from HOST side.
- [ ] SYSTEM message inserted on close event.
- [ ] `CLOSED` conversation rejects new messages with a clear error.
- [ ] Non-participant USER cannot read or post to foreign conversations (403 on both GET and POST).
- [ ] No email addresses or private data leaked in the conversation response to a third party.

---

## F. Billing — tourist becoming HOST (4 P0 items)

### 28: Plan selection + MP checkout

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min with MP sandbox
> **Source**: checklist item #28

**Preconditions**:

- MercadoPago sandbox account configured with test card numbers.
- Web app running in staging/test mode with `HOSPEDA_MP_*` env vars pointing to sandbox.
- HOST account in trial (no active paid subscription).

**Steps**:

1. Navigate to `/es/suscriptores/planes` → plan listing renders with monthly prices and features.
2. Click "Suscribirse" on the selected plan → redirect to MP checkout page.
3. Enter MP test card APRO (approved): `4509 9535 6623 3704`, any future expiry, DNI `12345678` → confirm payment.
4. Redirected to `/es/suscriptores/checkout/success` → confirmation message shown.
5. Check DB: `billing_subscriptions` row with `status = 'active'`, correct `plan_id`, correct `userId`.
6. HOST account now has active subscription — navigate to `/es/mi-cuenta/suscripcion` → subscription details shown.
7. Repeat with MP test card CONT (declined): confirm redirect to `/es/suscriptores/checkout/failure` → appropriate message.
8. Repeat with MP test card FUND (insufficient funds): confirm failure flow.

**Acceptance criteria** (all must pass):

- [ ] Plans page renders with correct prices from `billing_plans` table.
- [ ] MP checkout redirect uses correct `back_urls` pointing to `/success`, `/failure`, `/pending`.
- [ ] APRO payment creates `billing_subscriptions` row with `status = 'active'`.
- [ ] Confirmation email (billing mailer) received within 2 minutes of APRO.
- [ ] CONT/FUND cards redirect to failure page with user-friendly message.
- [ ] Payment is associated with correct `userId` and `planId`.

**Notes / gotchas**:

- MP sandbox test card numbers: APRO=`4509 9535 6623 3704`, CONT=`5031 7557 3453 0604`, FUND=`3753 651535 56885`. Verify current MP sandbox docs as these may change.
- The `back_urls` must match the actual deployed domain — ensure they are configurable via env, not hardcoded.

---

### 29: MP webhook — idempotency + HMAC

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #29

**Preconditions**:

- API running with `HOSPEDA_MP_WEBHOOK_SECRET` configured.
- Test fixture: a synthetic MP webhook payload with a known `data.id` (payment ID).

**Steps**:

1. POST to `/api/v1/webhooks/mercadopago` with valid HMAC signature header and `data.id = "test-payment-123"` → 200 response, event processed, row inserted in `billing_webhook_events`.
2. Replay the SAME request body with the SAME HMAC → 200 response (idempotent), but NO new row inserted in `billing_webhook_events` (exactly 1 row with `externalId = "test-payment-123"`).
3. Replay a third time → same result (1 row total).
4. POST with a MODIFIED HMAC signature (tampered) → 401 response; no row inserted.
5. POST with missing signature header → 401; no row inserted.

**Acceptance criteria** (all must pass):

- [ ] First webhook delivery → 200, 1 row in `billing_webhook_events`.
- [ ] Second replay → 200, still exactly 1 row (idempotent).
- [ ] Third replay → 200, still exactly 1 row.
- [ ] Invalid HMAC → 401, 0 rows inserted.
- [ ] Missing signature → 401, 0 rows inserted.
- [ ] No 500 errors on any of the above scenarios.

**Notes / gotchas**:

- The HMAC is computed from the raw request body using `HOSPEDA_MP_WEBHOOK_SECRET`. Signature header name: check MP's docs — typically `X-Signature` or `x-mp-signature`. Verify in `apps/api/src/routes/webhooks/`.
- The idempotency key is `billing_webhook_events.externalId` — confirm there is a unique constraint on this column in the DB schema.

---

### 30: Automatic renewal

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min with date simulation
> **Source**: checklist item #30

**Preconditions**:

- A HOST with an active subscription whose `currentPeriodEnd` can be manipulated in the DB (staging environment).
- MP sandbox configured to simulate renewal webhooks.

**Steps**:

1. In DB: update the active subscription's `currentPeriodEnd` to `now() - 1 day` (simulate expiration).
2. Trigger the renewal cron job: POST `/api/v1/cron` (with valid `HOSPEDA_CRON_SECRET`) to the appropriate renewal job, or wait for scheduled run.
3. MP sandbox sends renewal payment webhook → POST arrives at `/api/v1/webhooks/mercadopago` with new `payment_id`.
4. Verify: `billing_subscriptions.currentPeriodEnd` updated to next billing cycle, `status` remains `active`.
5. HOST accesses `/es/mi-cuenta/suscripcion` → renewal date shows the new period.
6. If renewal payment FAILS: verify subscription transitions to `past_due`, HOST receives "payment failed" email, grace period begins.

**Acceptance criteria** (all must pass):

- [ ] Successful renewal webhook extends `currentPeriodEnd` by one billing period.
- [ ] No feature interruption during renewal (subscription stays `active` throughout).
- [ ] Failed renewal sets subscription to `past_due` and triggers the grace period middleware.
- [ ] HOST receives renewal confirmation email on success.
- [ ] Audit log contains `SUBSCRIPTION_RENEWED` event.

**Notes / gotchas**:

- Clock injection is not available in production Hono — the only practical way to test this is to manipulate `currentPeriodEnd` in the staging DB and send a synthetic MP webhook.
- The `pastDueGraceMiddleware` in `apps/api/src/middlewares/past-due-grace.middleware.ts` governs what happens during `past_due` state — confirm it correctly exempts payment routes.

---

### 31: Cancellation + refund

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min
> **Source**: checklist item #31

**Preconditions**:

- HOST with an active paid subscription.
- Admin account with billing refund permission.
- MP sandbox account accessible.

**Steps**:

1. HOST navigates to `/es/mi-cuenta/suscripcion` → "Cancelar suscripción" button visible.
2. Click cancel → confirmation modal → confirm → subscription `cancelAtPeriodEnd` set to `true`; `status` remains `active`.
3. HOST retains full access until `currentPeriodEnd` (verify by accessing protected HOST features).
4. Simulate `currentPeriodEnd` passing (DB manipulation) → subscription status transitions to `canceled` → HOST features deactivated.
5. Admin navigates to `/admin/billing` → finds the subscription → issues refund via admin UI → refund request sent to MP.
6. MP processes refund → webhook fires → `billing_refunds` or equivalent table updated → audit log entry created.
7. HOST receives "refund issued" email.

**Acceptance criteria** (all must pass):

- [ ] Cancel sets `cancelAtPeriodEnd = true`, immediate access preserved.
- [ ] After period end, subscription `status = 'canceled'`, HOST features inaccessible.
- [ ] Admin refund flow works end-to-end (MP refund + audit log).
- [ ] HOST receives refund confirmation email.
- [ ] Audit log contains `SUBSCRIPTION_CANCELED` and `REFUND_ISSUED` events with `actorId`.

---

## G. Admin panel — content moderation (2 P0 items)

### 34: Paginated admin accommodations listing

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #34

**Preconditions**:

- Admin account with `ACCOMMODATION_VIEW_ALL` permission.
- DB with at least 30 accommodations in various states (`ACTIVE`, `INACTIVE`, `DRAFT`, including 2 soft-deleted).

**Steps**:

1. GET `/api/v1/admin/accommodations?page=1&pageSize=10` with admin session → 200, returns 10 items, `pagination.total` >= 30.
2. GET with `?status=ACTIVE` → returns only `ACTIVE` accommodations.
3. GET with `?search=Cabaña` → returns accommodations whose name matches "Cabaña" (case-insensitive).
4. GET with `?includeDeleted=true` → total count increases by 2 (the soft-deleted ones are included).
5. GET with `?page=3&pageSize=10` → returns the correct third page (items 21-30).
6. GET with `?sort=createdAt:desc` → newest accommodation is first.
7. GET with `?ownerId={host_a_id}` → returns only accommodations owned by `host_a`.
8. In admin panel UI: navigate to accommodations list → same filters work via the UI with correct URL params.

**Acceptance criteria** (all must pass):

- [ ] Pagination metadata (`page`, `pageSize`, `total`, `totalPages`) correct in response.
- [ ] `status` filter correctly limits results to that state.
- [ ] `search` filter matches names case-insensitively.
- [ ] `includeDeleted=true` includes soft-deleted records.
- [ ] Page 3 returns the expected items with no duplicates or gaps.
- [ ] `sort` by `createdAt` descending returns newest first.
- [ ] `ownerId` filter returns only that owner's accommodations.
- [ ] No unknown query params cause a 400 (only validated params matter; `createAdminListRoute` enforces this).

**Notes / gotchas**:

- `createAdminListRoute` auto-merges `PaginationQuerySchema` and rejects unknown params with 400. This is actually desired for admin routes (stricter than public routes). Verify in CLAUDE.md — confirmed.
- `?destination=` filter may reference a `destinationId` UUID; verify the admin search schema includes it.

---

### 36: Soft delete + restore

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #36

**Preconditions**:

- Admin account with `ACCOMMODATION_DELETE` permission.
- One `ACTIVE` accommodation to soft-delete and restore.

**Steps**:

1. DELETE `/api/v1/admin/accommodations/{id}` with admin session → 200; DB sets `deletedAt = now()` on the record.
2. GET `/api/v1/public/accommodations/{id}` → 404 (soft-deleted hidden from public).
3. GET `/api/v1/admin/accommodations/{id}` without `?includeDeleted=true` → 404.
4. GET `/api/v1/admin/accommodations/{id}?includeDeleted=true` → 200, record returned with `deletedAt` set.
5. POST `/api/v1/admin/accommodations/{id}/restore` (or equivalent restore endpoint) → 200; `deletedAt` set to `null`.
6. GET `/api/v1/public/accommodations/{id}` → 200 again (accommodation is back).

**Acceptance criteria** (all must pass):

- [ ] Soft delete sets `deletedAt`, does NOT delete the DB row.
- [ ] Public endpoint returns 404 for soft-deleted accommodation.
- [ ] Admin endpoint without `includeDeleted` returns 404 for soft-deleted.
- [ ] Admin endpoint with `includeDeleted=true` returns the soft-deleted record.
- [ ] Restore clears `deletedAt` and makes the accommodation publicly accessible again.
- [ ] No cascade hard-delete of related data (photos, reviews, bookmarks) during soft delete.

---

## H. Admin panel — user and billing management (2 P0 items)

### 39: User management — list, search, role assign

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #39

**Preconditions**:

- Admin account with `USER_VIEW_ALL` and `USER_UPDATE` permissions.
- At least one USER and one HOST in DB, plus one suspended account.

**Steps**:

1. Navigate to `/admin/users` → user list renders with pagination; columns include name, email, role, status, created date.
2. Search by partial email "test" → results filtered to users whose email contains "test".
3. Filter by role "HOST" → only HOST accounts shown.
4. Click a USER account → user detail page opens.
5. Assign HOST role: click "Assign role" → select HOST → confirm → `role` updated in DB.
6. Suspend the user: click "Suspend" → confirm → `lifecycleState = SUSPENDED` (or equivalent) in DB → user cannot log in.
7. Unsuspend: click "Unsuspend" → user can log in again.
8. View activity log for the user → recent actions listed.

**Acceptance criteria** (all must pass):

- [ ] User list renders with pagination and correct total count.
- [ ] Search by partial email returns correct results.
- [ ] Role filter correctly limits list.
- [ ] Role assignment updates DB and takes effect on next login (or immediately if session is invalidated).
- [ ] Suspended user receives 401/403 on protected endpoint access.
- [ ] Unsuspend restores login capability.
- [ ] Each admin action (role change, suspend) appears in the audit log.

---

### 40: Billing dashboard admin

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #40

**Preconditions**:

- Admin account with billing permissions.
- At least 3 active subscriptions, 2 expiring addons, and configured cron jobs in DB.

**Steps**:

1. Navigate to `/admin/billing` → billing dashboard loads without JS errors.
2. Subscriptions tab: list renders with customer name, plan, status, next renewal date. Filter by `status=active` → count matches DB.
3. Customer add-ons tab: list of active addons with expiry dates visible.
4. Metrics tab: "System usage" panel shows total active hosts, revenue, and approaching-limits panel shows accounts with subscription near expiration (< 7 days).
5. Cron jobs tab: list of registered cron jobs with name, schedule, enabled status → matches the jobs registered at `/api/v1/cron` endpoint.
6. Navigate to individual subscription → can see payment history, cancel button, refund button.
7. Pages load within 3 seconds on a seeded dataset.

**Acceptance criteria** (all must pass):

- [ ] All 4 billing tabs (subscriptions, add-ons, metrics, cron) load without errors.
- [ ] Subscription filter by status returns correct results.
- [ ] Approaching-limits panel shows accounts with renewal within 7 days.
- [ ] Cron jobs list matches the actual registered jobs in the API.
- [ ] Individual subscription detail shows payment history.
- [ ] No JS console errors on any billing tab.

**Notes / gotchas**:

- These pages were fixed in a prior session (2026-02-25/27). Re-testing is still required to confirm no regressions from SPEC-089 or SPEC-095 changes that touched the service layer.

---

## I. Crons and background processes (2 P0 items)

### 43: Addon expiration cron

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #43

**Preconditions**:

- DB has at least one addon entitlement with `expiresAt` set to yesterday (past).
- `HOSPEDA_CRON_SECRET` env var set.

**Steps**:

1. Verify: before cron runs, the expired addon entitlement has `status = 'active'` in `billing_subscription_addons` (or equivalent).
2. POST `/api/v1/cron/addon-expiration` (or the correct job name) with header `X-Cron-Secret: {HOSPEDA_CRON_SECRET}` → 200, job execution result in response.
3. Check DB: expired addon entitlement now has `status = 'expired'` or `deletedAt` set.
4. Check audit log: entry with action `ADDON_EXPIRED` and the affected `addonId`.
5. Verify the HOST account no longer has the feature entitlement active (e.g., GET user's entitlements → addon not in the active list).
6. Run the cron again → idempotent; no re-processing of already-expired addons.

**Acceptance criteria** (all must pass):

- [ ] Addon with `expiresAt` in the past is deactivated after cron runs.
- [ ] Audit log entry `ADDON_EXPIRED` created.
- [ ] Entitlement no longer active for the HOST.
- [ ] Second run of cron on same data is idempotent (no duplicate processing).
- [ ] If revocation fails (simulated DB error), a compensating event `ADDON_REVOCATION_FAILED` is logged.

**Notes / gotchas**:

- Verify the actual cron job name registered in `apps/api/src/cron/registry.ts` — it may differ from "addon-expiration".
- `billing_subscription_addons` has no `livemode` or `deleted_at` columns (from prior session memory); use `status` or `expiresAt` to determine active state.

---

### 46: Cron secret protection

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #46

**Preconditions**:

- API running with `HOSPEDA_CRON_SECRET` set.
- At least one cron job registered.

**Steps**:

1. GET `/api/v1/cron` without any auth header → 401.
2. GET `/api/v1/cron` with `X-Cron-Secret: wrong-secret` → 401.
3. GET `/api/v1/cron` with `Authorization: Bearer wrong-token` → 401.
4. GET `/api/v1/cron` with correct `X-Cron-Secret: {HOSPEDA_CRON_SECRET}` → 200, job list returned.
5. Response body in step 1/2/3 does NOT reveal what jobs exist or how many.
6. POST `/api/v1/cron/non-existent-job` with correct secret → 404 (not 500).

**Acceptance criteria** (all must pass):

- [ ] No secret → 401.
- [ ] Wrong secret → 401 with same response body as "no secret" (no timing difference that leaks whether the secret is partially correct).
- [ ] Correct secret → 200 with job list.
- [ ] Rejected responses do not reveal job names or count.
- [ ] Non-existent job name with valid secret → 404, not 500.

**Notes / gotchas**:

- The middleware uses `timingSafeCompare` (confirmed in `apps/api/src/cron/middleware.ts`) — this is correct and should be noted as a verification checkpoint.

---

## J. Cross-cutting security (7 P0 items)

### 47: SQL injection on filters

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #47

**Preconditions**:

- API running with real PostgreSQL (not mock).
- Public accommodation listing endpoint available.

**Steps**:

1. GET `/api/v1/public/accommodations?search='; DROP TABLE accommodations; --` → 200 response (not 500), normal (empty or full) results returned, `accommodations` table still exists.
2. GET `/api/v1/public/accommodations?search=' OR 1=1; --` → 200, results not expanded to all rows (parameterization prevents wildcard injection).
3. GET `/api/v1/public/destinations?search=<script>alert(1)</script>` → 200, response body does not echo the script tag as executable content.
4. Verify via `EXPLAIN` query (if DB access available) that search uses parameterized query (`$1` placeholder), not string concatenation.
5. Repeat steps 1-2 for event listing endpoint (`/api/v1/public/events?search=...`) newly updated in SPEC-089.

**Acceptance criteria** (all must pass):

- [ ] SQL injection payloads in `?search=` do not cause 500 errors.
- [ ] `accommodations` table exists after the DROP attempt (DB integrity preserved).
- [ ] OR-injection does not expand result set beyond what the authenticated user would normally see.
- [ ] HTML/script injection in query params does not reflect executable content in response.
- [ ] SPEC-089 new endpoints (events by destination) also resist injection.

**Notes / gotchas**:

- Drizzle ORM uses parameterized queries by default — this test is a regression guard, not a new discovery. The important thing is to catch any raw SQL interpolation introduced in new code.

---

### 48: LIKE wildcard injection

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~15s in CI
> **Source**: checklist item #48

**Preconditions**:

- DB with accommodations whose names do NOT contain `%` or `_` characters.
- `safeIlike` from `@repo/db` used in all search handlers (verify with grep).

**Steps**:

1. GET `/api/v1/public/accommodations?search=%` → response returns empty results or results where name contains literal `%` (not a wildcard-expanded full-table match).
2. GET `/api/v1/public/accommodations?search=_` → same check — single `_` should not match every single-character name as a wildcard.
3. GET `/api/v1/public/accommodations?search=cabaña%_test` → only matches literal string "cabaña%_test" (escaped properly).
4. Verify in source: grep for `ilike(` (raw from drizzle-orm) in `packages/service-core/src/` and `apps/api/src/` → zero occurrences (all should use `safeIlike`).

**Acceptance criteria** (all must pass):

- [ ] `?search=%` returns only records with literal `%` in name (or empty), not all records.
- [ ] `?search=_` returns only records with literal `_` in name (or empty).
- [ ] Source contains zero raw `ilike(` calls in production code (CI grep enforced).
- [ ] `safeIlike` from `@repo/db/utils/drizzle-helpers` is the only ILIKE mechanism used.

---

### 49: Reflected and stored XSS

> **Mode**: `auto-runnable-CI` + `owner-manual`
> **Estimated effort**: ~40s in CI; ~10min manual
> **Source**: checklist item #49

**Preconditions**:

- A HOST account able to create/edit an accommodation.
- Playwright with a CSP-aware page inspector.

**Part A — Stored XSS (automated)**:

1. HOST creates accommodation with `name = '<script>window.__xss=1</script>XSS Test'` via PATCH `/api/v1/protected/accommodations/{id}`.
2. Guest visits the public detail page `/es/alojamientos/{slug}` → page renders, `window.__xss` is NOT set (script was not executed).
3. The accommodation name renders as literal text: `<script>window.__xss=1</script>XSS Test` visible in the DOM as escaped text.
4. Repeat with `description = '<img src=x onerror=window.__xss=1>'` → image does not trigger `onerror` handler.

**Part B — Reflected XSS (automated)**:

1. GET `/es/alojamientos?search=<script>alert(1)</script>` → page renders, script is not executed, param is HTML-escaped in the page.

**Part C — Manual CSP**:

1. Open any page in browser → DevTools → Network → inspect response headers → `Content-Security-Policy` header present.
2. Confirm no `unsafe-inline` in the `script-src` directive.
3. Attempt to inject inline script via browser console → CSP blocks it.

**Acceptance criteria** (all must pass):

- [ ] Stored script payload does not execute in the browser on the detail page.
- [ ] `onerror` handler in stored `<img>` tag does not fire.
- [ ] Reflected search params are HTML-escaped in rendered output.
- [ ] CSP header present on all pages.
- [ ] `script-src` does not contain `unsafe-inline`.

---

### 50: CSP enforcement

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #50

**Preconditions**:

- Web and admin apps running in production-equivalent mode (not dev, where CSP may be relaxed).
- Sentry DSN configured with a `report-uri` or `report-to` endpoint.

**Steps**:

1. Fetch headers: `curl -I https://hospeda.com.ar/es` (or local equivalent) → extract `Content-Security-Policy` header.
2. Parse the policy: confirm `default-src 'self'`, no `unsafe-inline` in `script-src`, no `unsafe-eval` in `script-src`.
3. Confirm `img-src` includes `res.cloudinary.com` (for Cloudinary images).
4. Confirm `connect-src` includes the API URL (`https://api.hospeda.com.ar`).
5. In test: trigger a deliberate CSP violation (inject a script from an unauthorized origin) → Sentry receives a CSP violation report.
6. Repeat for admin app (`/admin`) → separate CSP header present (admin may allow additional sources for Tailwind dev).

**Acceptance criteria** (all must pass):

- [ ] CSP header present on all page responses for web and admin.
- [ ] No `unsafe-inline` in `script-src`.
- [ ] No `unsafe-eval` in `script-src`.
- [ ] `img-src` allows `res.cloudinary.com`.
- [ ] `connect-src` allows the API origin.
- [ ] CSP violations are reported to Sentry (or a dedicated reporting endpoint).

**Notes / gotchas**:

- SPEC-042-GAPS defines the CSP policy. Verify the current implementation matches the spec.
- Astro SSR may inject inline scripts for hydration; if so, a `nonce`-based CSP is required instead of `unsafe-inline`. Document which approach is in use.

---

### 51: Rate limit on public endpoints

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #51

**Preconditions**:

- API running with rate limiting configured (Redis or memory backend).
- `API_RATE_LIMIT_MAX_REQUESTS` and `API_RATE_LIMIT_WINDOW_MS` set (from `CLAUDE.md`: window=900000ms, max=100, but verify actual config).

**Steps**:

1. Send 100 rapid sequential GET requests to `/api/v1/public/accommodations` from the same IP → all 200.
2. Send the 101st request → 429 Too Many Requests, with `Retry-After` header.
3. Wait for the rate limit window to reset → next request returns 200.
4. Verify `Retry-After` header value is present and positive.
5. Confirm authenticated requests (with valid session) use a separate or higher rate limit bucket than unauthenticated.
6. If Redis backend configured: stop Redis, send requests → rate limiter falls back to memory or fails open (does NOT crash the API with 500).

**Acceptance criteria** (all must pass):

- [ ] After N requests in the window, the N+1 request returns 429.
- [ ] 429 response includes `Retry-After` header.
- [ ] After window reset, requests succeed again.
- [ ] Redis failure does not cause API 500 — graceful fail-open or fallback to memory.
- [ ] Authenticated requests are not counted against the unauthenticated limit (separate bucket).

**Notes / gotchas**:

- The actual rate limit thresholds may differ from `API_RATE_LIMIT_MAX_REQUESTS=100` for specific public endpoints. Check `apps/api/src/utils/route-factory.ts` for per-route `customRateLimit` options.
- SPEC-079 defines the fail-open behavior for Redis downtime.

---

### 52: Brute force login

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #52

**Preconditions**:

- API running with Better Auth rate limiting or custom brute force protection.
- A valid test user email (the account exists but we send wrong passwords).

**Steps**:

1. POST 5 failed login attempts to `/api/auth/sign-in/email` with wrong password within 60 seconds → first 5 return 401.
2. 6th attempt (still within window) → returns 429 or some lockout-like response (not 401).
3. Wait for the lockout window to expire → next attempt with CORRECT password → 200 (normal login).
4. Verify the lockout error message is user-friendly and does not reveal the exact threshold.

**Acceptance criteria** (all must pass):

- [ ] 5 failed attempts do not lock the account (individual attempt gets 401).
- [ ] 6th (or configured N+1) attempt within the window returns 429 or lockout response.
- [ ] After lockout window, correct credentials succeed.
- [ ] Lockout error message does not reveal the exact attempt threshold.
- [ ] Lockout is per-IP (or per-email) — not global (other users not affected).

**Notes / gotchas**:

- Better Auth has built-in rate limiting on sign-in; check the Better Auth config in `apps/api/src/lib/auth.ts` (or similar) to see the configured threshold and window.

---

### 54: CSRF on protected mutations

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #54

**Preconditions**:

- An authenticated user session (valid session cookie).
- API configured with Better Auth CSRF protection.

**Steps**:

1. Attempt PATCH `/api/v1/protected/users/{id}` with valid session cookie but WITHOUT the CSRF token (or with an invalid one) → expect 403 (CSRF rejected) or the mutation is rejected.
2. Attempt the same mutation with a CSRF token from ANOTHER user's session → 403.
3. Attempt from a cross-origin request (simulated by setting `Origin: https://evil.com` header with no CORS allow) → request rejected by CORS before reaching CSRF check.
4. Verify `SameSite=Lax` on the session cookie (already covered by item #4, but cross-reference here).

**Acceptance criteria** (all must pass):

- [ ] Missing CSRF token on state-changing request → 403 (or 401 if CSRF is handled at auth level).
- [ ] Cross-user CSRF token → 403.
- [ ] Cross-origin mutations blocked by CORS before reaching application logic.
- [ ] Session cookie has `SameSite=Lax` or `SameSite=Strict`.

**Notes / gotchas**:

- Better Auth includes CSRF protection by default using `SameSite` cookies and optional CSRF token validation. Verify the exact mechanism used in this project (some Better Auth setups rely entirely on `SameSite=Lax` rather than explicit tokens).
- If the API is stateless (JWT-based), CSRF protection via `SameSite` is sufficient — document this.

---

## K. Performance and observability (2 P0 items)

### 58: Sentry capturing errors

> **Mode**: `agent-runnable`
> **Estimated effort**: ~10min
> **Source**: checklist item #58

**Preconditions**:

- Sentry DSN configured in `HOSPEDA_SENTRY_DSN` (or equivalent) for all three apps (api, web, admin).
- `release` attribute configured in Sentry init (DoD item 4).
- Access to Sentry dashboard (read-only, agent can verify via Sentry API or just inspect the config).

**Steps**:

1. In `apps/api`: trigger a synthetic unhandled error by calling a test endpoint (or temporarily adding a throw to a health endpoint in a staging deployment) → verify Sentry receives an event.
2. Check the Sentry event: confirm `release` tag is set (not `undefined`), `environment` tag is correct (`staging` or `production`), user context (userId/email) is present where applicable, route (`/health` or whatever) is in the breadcrumb.
3. In `apps/web`: trigger a client-side error by evaluating `throw new Error('Sentry web test')` in the browser console → verify Sentry receives the event with `release` tag.
4. In `apps/admin`: same as step 3 for the admin app.
5. Verify source maps: the Sentry event for a server-side error shows the original TypeScript file and line number (not transpiled JS).

**Acceptance criteria** (all must pass):

- [ ] Sentry receives events from all three apps (api, web, admin).
- [ ] Each event has `release` tag (not empty/undefined).
- [ ] Each event has correct `environment` tag.
- [ ] API events include user context when the request was authenticated.
- [ ] Source maps resolve correctly (original file+line visible in Sentry, not minified code).
- [ ] No duplicate events from a single error (no double-initialization).

**Notes / gotchas**:

- The `release` attribute must be set at Sentry initialization time, typically from an env var populated during the CI/CD build process (e.g., `SENTRY_RELEASE=git-sha`). If it's missing, that's the bug to file.
- Do NOT trigger errors in production. Use the staging environment.

---

### 59: Metrics and health checks

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #59

**Preconditions**:

- API running with PostgreSQL connected.
- Metrics middleware active.

**Steps**:

1. GET `/health` → 200, body `{ "status": "healthy", "timestamp": "...", "uptime": N }`.
2. GET `/health/db` → 200, body includes `database.status = "connected"`, `responseTime` in milliseconds.
3. GET `/health/ready` → 200 (readiness: DB connected, all required services initialized).
4. GET `/health/live` → 200 (liveness: process is alive).
5. Simulate DB down: stop PostgreSQL, then GET `/health/db` → 503, body `database.status = "disconnected"`.
6. GET `/api/v1/admin/metrics` with admin session → 200, includes request counts and latency histograms.
7. GET `/api/v1/admin/metrics` without session → 401 or 403.

**Acceptance criteria** (all must pass):

- [ ] `/health` returns 200 with `status: "healthy"` when system is operational.
- [ ] `/health/db` returns 200 with `connected` status when DB is up.
- [ ] `/health/db` returns 503 with `disconnected` status when DB is down.
- [ ] `/health/ready` and `/health/live` return 200 in normal conditions.
- [ ] Metrics endpoint requires admin authentication.
- [ ] Metrics endpoint returns request counts and latency data.

---

## L. i18n and SEO (2 P0 items)

### 62: SEO meta tags + structured data

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #62

**Preconditions**:

- Web app running with seed data.
- Pages to check: home (`/es`), accommodation listing (`/es/alojamientos`), accommodation detail (`/es/alojamientos/{slug}`), destination (`/es/destinos/{path}`), post (`/es/publicaciones/{slug}`).

**Steps**:

1. GET `/es` → parse HTML: `<title>` present and non-empty, `<meta name="description">` present, `<meta property="og:image">` present.
2. GET `/es/alojamientos/{slug}` → `<script type="application/ld+json">` present, JSON parseable, `@type = "LodgingBusiness"`, `name`, `address`, `geo` fields populated.
3. GET `/es/publicaciones/{slug}` (blog post) → JSON-LD with `@type = "BlogPosting"`, `headline`, `datePublished`, `author` present.
4. GET `/es/eventos/{slug}` (event detail) → JSON-LD with `@type = "Event"`, `name`, `startDate`, `location` present.
5. For each page: `<link rel="canonical">` present with the correct URL.
6. Validate the accommodation JSON-LD against Google's Rich Results Test schema (automated via fetch + parse).

**Acceptance criteria** (all must pass):

- [ ] All pages have `<title>`, `meta description`, and `og:image`.
- [ ] Accommodation detail has valid `LodgingBusiness` JSON-LD with required fields.
- [ ] Blog post has valid `BlogPosting` JSON-LD.
- [ ] Event detail has valid `Event` JSON-LD.
- [ ] Canonical URL correct on all pages (no duplicate content signals).
- [ ] JSON-LD is valid JSON (parseable without errors).

**Notes / gotchas**:

- The `og:image` must be an absolute URL (Cloudinary CDN) — relative paths are invalid for Open Graph. Verify in the meta tag rendering.

---

### 63: Sitemap.xml and robots.txt

> **Mode**: `owner-manual`
> **Estimated effort**: ~10min
> **Source**: checklist item #63

**Preconditions**:

- Web app deployed (staging or production).
- At least 5 published accommodations in DB to verify sitemap entries.

**Steps**:

1. GET `https://hospeda.com.ar/sitemap-index.xml` → 200, valid XML, references individual sitemap files.
2. GET one of the referenced sitemaps (e.g. `/sitemap-0.xml`) → includes URLs for published accommodations.
3. Verify: soft-deleted and `DRAFT` accommodations are NOT in the sitemap.
4. Verify: each sitemap entry has `<loc>` (absolute URL) and `<lastmod>` (ISO date).
5. GET `https://hospeda.com.ar/robots.txt` → 200, contains `Disallow: /api/`, `Disallow: /*/mi-cuenta/`, `Sitemap: https://hospeda.com.ar/sitemap-index.xml`.
6. Verify admin app robots: `apps/admin/public/robots.txt` has `Disallow: /` (admin should not be indexed).

**Acceptance criteria** (all must pass):

- [ ] `sitemap-index.xml` is valid XML and references at least one sitemap file.
- [ ] Published accommodations appear in the sitemap with absolute `<loc>` URLs.
- [ ] Draft and deleted accommodations NOT in the sitemap.
- [ ] `robots.txt` blocks `/api/` and `/*/mi-cuenta/` from crawlers.
- [ ] `robots.txt` references the `Sitemap:` URL.
- [ ] Admin `robots.txt` disallows all crawling.

**Notes / gotchas**:

- Astro's `@astrojs/sitemap` integration generates the sitemap at build time; ISR additions won't appear until next build or sitemap regeneration. Document the sitemap refresh mechanism.
- Confirmed from file listing: `apps/web/public/robots.txt` exists with the correct `Disallow` rules (verified earlier).

---

## M. Transactional email (3 P0 items)

### 64: Signup email verification

> **Mode**: `owner-manual`
> **Estimated effort**: ~10min with real inbox
> **Source**: checklist item #64

**Preconditions**:

- Real Resend API key configured (not mock/sandbox).
- A real email address accessible for testing (use `+test` alias or dedicated mailbox).
- Staging environment (not local MailHog — this test validates real Resend delivery).

**Steps**:

1. Navigate to `/es/auth/signup` → sign up with `test+signup-{timestamp}@yourdomain.com`.
2. Receive email in real inbox → verify: NOT in spam, sender name correct ("Hospeda" or similar), sender address correct (configured Resend domain), no broken images.
3. Click the verification link → land on `/es/auth/verify-email` → success message → account activated.
4. Verify the link is an absolute URL pointing to the correct domain (staging or production, not localhost).
5. Click the link a second time → error "token already used" (single-use).

**Acceptance criteria** (all must pass):

- [ ] Email delivered to real inbox (not spam) within 2 minutes.
- [ ] Sender name and address match the configured Resend domain.
- [ ] Verification link is an absolute URL for the correct environment.
- [ ] Link activates account and sets `emailVerifiedAt`.
- [ ] Replay of the link rejected (single-use token).
- [ ] Email renders correctly (no broken template, no missing images if any are used).

---

### 65: SPEC-085 messaging mailers

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #65

**Preconditions**:

- HOST and GUEST accounts with real email addresses.
- Resend configured; conversation flow working (item #26 passed).

**Steps**:

1. GUEST sends first message to HOST → HOST receives email notification within 2 minutes.
2. Verify HOST email: subject references the accommodation name, body includes message preview, direct link to conversation in `/es/mi-cuenta/messages/{id}`.
3. HOST replies → GUEST receives email notification within 2 minutes.
4. Verify GUEST email: subject references the host/accommodation, body includes reply preview, link to conversation.
5. GUEST opts out of notifications (if unsubscribe link exists) → sends another message → HOST does NOT receive email for that conversation (or per their preference).
6. Test with a PT-locale user (if available) → email template renders in Portuguese.

**Acceptance criteria** (all must pass):

- [ ] HOST email received within 2 minutes of GUEST's first message.
- [ ] GUEST email received within 2 minutes of HOST's reply.
- [ ] Both emails contain message preview and correct deep link.
- [ ] Opt-out (if implemented) suppresses subsequent email notifications for that conversation.
- [ ] Email templates exist for `es`, `en`, and `pt` locales.

---

### 66: Billing mailers

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #66

**Preconditions**:

- HOST account that goes through billing events (payment, renewal, refund) in staging.
- Real Resend configuration.

**Steps**:

1. Complete plan purchase (from item #28) → receive "Payment confirmed / Subscription activated" email within 2 minutes.
2. Verify email: plan name, amount charged, next renewal date, link to `/es/mi-cuenta/suscripcion`.
3. Simulate upcoming renewal reminder (trigger cron or inject date): HOST receives "Your subscription renews in 5 days" email with renewal date and plan name.
4. Admin issues a refund (from item #31) → HOST receives "Refund issued" email within 5 minutes.
5. Verify refund email: amount refunded, original charge date, reference number.

**Acceptance criteria** (all must pass):

- [ ] Payment confirmation email received within 2 minutes of APRO webhook.
- [ ] Renewal reminder email sent by the reminder cron within the configured window.
- [ ] Refund confirmation email received within 5 minutes of admin refund action.
- [ ] All emails have correct amounts, dates, and deep links.
- [ ] No email sent in duplicate (idempotency).

---

## N. Edge cases and resilience (2 P0 items)

### 67: Access to soft-deleted resource

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~20s in CI
> **Source**: checklist item #67

**Preconditions**:

- One accommodation soft-deleted in DB (`deletedAt` set).
- Its slug is known.
- A USER with a bookmark to this accommodation exists.

**Steps**:

1. GET `/es/alojamientos/{slug}` (deleted accommodation) → 404 page rendered gracefully (Astro 404 layout, no stack trace).
2. GET `/api/v1/public/accommodations/{id}` → 404 JSON response `{ success: false, error: { code: "NOT_FOUND" } }`.
3. GET `/api/v1/public/accommodations/slug/{slug}` → 404 JSON response.
4. Navigate to `/es/mi-cuenta/favoritos` as the USER with a bookmark → deleted accommodation card shown as "No longer available" (or disabled/greyed) rather than broken link.
5. Attempting to visit the bookmark's URL from the favorites page → same graceful 404.

**Acceptance criteria** (all must pass):

- [ ] Web detail page for deleted accommodation renders a graceful 404 (not a 500 or blank page).
- [ ] Public API returns 404 JSON for both ID and slug lookup of deleted accommodation.
- [ ] User's bookmark listing shows deleted accommodations as "unavailable" without crashing.
- [ ] No stack trace or internal error details exposed in the 404 response.

---

### 70: DB transaction rollback

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~30s in CI
> **Source**: checklist item #70

**Preconditions**:

- Integration test environment with real PostgreSQL.
- A multi-table operation to test (e.g., addon purchase that creates both a `billing_subscription_addons` row and an entitlement row).

**Steps**:

1. In integration test: mock the second DB write (entitlement creation) to throw an error after the first write (addon row) succeeds.
2. Trigger the addon purchase operation → the operation fails with an error.
3. Verify DB: the `billing_subscription_addons` row was NOT created (transaction rolled back both writes).
4. Verify: the system returns an error response (not 200 with partial data).
5. Repeat for another multi-table operation: HOST onboarding completion (accommodation + HOST role assignment). Mock role assignment to fail → verify accommodation row is NOT created.

**Acceptance criteria** (all must pass):

- [ ] First write is rolled back when second write fails (no orphaned rows).
- [ ] Error response is returned to the caller (not a success with partial state).
- [ ] DB is in a consistent state after the failed operation.
- [ ] No compensating cleanup is needed (transaction handles it atomically).

**Notes / gotchas**:

- Drizzle's transaction API is `db.transaction(async (tx) => { ... })`. Verify that multi-table operations in `service-core` use this pattern, not separate `await` calls outside a transaction.

---

## P. Browser and device matrix (2 P0 items)

### 76: Mobile iOS Safari

> **Mode**: `owner-manual`
> **Estimated effort**: ~45min for a focused session
> **Source**: checklist item #76

**Preconditions**:

- Real iPhone (not simulator) with Safari.
- Staging environment accessible over the internet (not localhost).
- Test HOST account and GUEST account available.

**Steps**:

1. Open `https://staging.hospeda.com.ar/es` in Mobile Safari → home page renders without layout breaks.
2. Navigate to `/es/alojamientos` → listings render, filter panel opens correctly, cards are tappable.
3. Open accommodation detail page → photo gallery swipes horizontally, map renders (or falls back gracefully), "Contact host" button tappable.
4. Scroll through the page → sticky header works without obscuring content, no scroll restoration issues.
5. Navigate to `/es/publicar/nueva` → fill Section 1-3 → autosave fires → close Safari tab → reopen → "continue draft" banner visible.
6. In photo upload section → tap "Add photos" → iOS photo picker opens → select 3 photos → upload succeeds with thumbnails.
7. Verify `100vh` issues: forms and modals do not get cut off by the iOS browser chrome.
8. Test sign-in form → keyboard does not obscure the password field on iOS.

**Acceptance criteria** (all must pass):

- [ ] Home page renders without horizontal scroll or broken layout.
- [ ] Accommodation listing filters functional on touch.
- [ ] Detail page gallery swipes correctly.
- [ ] Photo upload from iOS gallery works.
- [ ] Forms not obscured by iOS keyboard or browser chrome.
- [ ] No `100vh` layout breaks on any page.
- [ ] Autosave and draft recovery work on Safari.

**Notes / gotchas**:

- iOS Safari's `100vh` includes the browser chrome; use `100dvh` (dynamic viewport height) instead. Flag any page that uses `100vh` in CSS.
- Cloudinary's `<picture>` with `srcset` is generally well-supported on iOS Safari; verify Avif format is not used (Safari < 16 doesn't support it).

---

### 77: Mobile Android Chrome

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min
> **Source**: checklist item #77

**Preconditions**:

- Real Android device (not emulator) with Chrome.
- Screen size representative of the lower end (e.g., 360px width).
- Same staging environment as item #76.

**Steps**:

1. Open `https://staging.hospeda.com.ar/es` in Android Chrome → home page renders correctly at 360px viewport.
2. Test accommodation listing with filters → filter panel opens as bottom sheet or overlay (not broken).
3. Open detail page → verify viewport-relative sizing works on various Android Chrome versions.
4. Navigate to photo upload section → tap "Add photos" → camera option available → take a photo with the camera → upload succeeds.
5. Test form keyboard interaction → inputs focus correctly, keyboard does not break form layout.
6. Verify touch target sizes: buttons and links are at least 44x44px (tap target).

**Acceptance criteria** (all must pass):

- [ ] Home page renders without overflow at 360px width.
- [ ] Filters functional on touch interface.
- [ ] Camera photo upload works on Android Chrome.
- [ ] Form inputs focus correctly without layout collapse.
- [ ] Touch targets are at minimum 44x44px for all interactive elements.
- [ ] No horizontal scroll on any page.

---

## Q. Operations, deploy and configuration (6 P0 items)

### 80: Vercel deploy — preview vs prod

> **Mode**: `owner-manual`
> **Estimated effort**: ~20min
> **Source**: checklist item #80

**Preconditions**:

- Vercel project connected to the Git repository with correct branch configuration.
- A feature branch open as a PR.

**Steps**:

1. Open a test PR to main → Vercel generates a preview deployment URL automatically.
2. Visit the preview URL → app loads (web, admin, api each have their own preview deployment).
3. Verify the preview uses preview environment variables (not production `HOSPEDA_DATABASE_URL`).
4. Merge the PR to `main` → Vercel triggers a production deployment.
5. Production deployment completes → app functional at the production URL.
6. Trigger a rollback in Vercel dashboard → previous deployment is active within 2 minutes.
7. Verify environment variables are scoped correctly: `Preview` scope does not expose `HOSPEDA_MP_ACCESS_TOKEN_PROD` (only `HOSPEDA_MP_ACCESS_TOKEN_TEST`).

**Acceptance criteria** (all must pass):

- [ ] PR creates preview deployment with correct preview env vars.
- [ ] Merge to `main` creates production deployment.
- [ ] Rollback to previous deployment completes within 2 minutes.
- [ ] Preview environment does NOT use production DB or MP credentials.
- [ ] Each of the 3 apps (web, admin, api) has independent Vercel deployments.

---

### 81: Complete environment variables

> **Mode**: `agent-runnable`
> **Estimated effort**: ~10min
> **Source**: checklist item #81

**Preconditions**:

- Access to the `@repo/config` env registry.
- Production and staging Vercel env vars accessible (via `pnpm env:pull` or Vercel dashboard).

**Steps**:

1. Run `pnpm env:check` from the repo root → verify it exits with code 0 (all registered env vars present in the environment).
2. Inspect `packages/config/src/env-registry.hospeda.ts` → enumerate all registered variables with `required: true`.
3. Cross-reference against Vercel production environment → every required var is present with a non-empty value.
4. Verify critical vars specifically: `HOSPEDA_RESEND_API_KEY`, `HOSPEDA_MP_ACCESS_TOKEN`, `HOSPEDA_CLOUDINARY_API_KEY`, `HOSPEDA_SENTRY_DSN`, `HOSPEDA_BETTER_AUTH_SECRET`, `HOSPEDA_DATABASE_URL`, `HOSPEDA_REDIS_URL`.
5. Verify no variable has placeholder value like `your-secret-here` or `change-me`.
6. Verify startup validation: simulate missing `HOSPEDA_DATABASE_URL` → API should refuse to start (Zod validation at startup), not fail silently at first DB call.

**Acceptance criteria** (all must pass):

- [ ] `pnpm env:check` exits 0 in all environments (dev, staging, production).
- [ ] All `required: true` vars from the registry are present in production Vercel config.
- [ ] No placeholder or empty values for critical variables.
- [ ] Missing required var causes API startup failure (not a runtime error on first use).

---

### 82: Migration apply on clean DB

> **Mode**: `agent-runnable`
> **Estimated effort**: ~15min
> **Source**: checklist item #82

**Preconditions**:

- Docker running with PostgreSQL available.
- `packages/db/scripts/apply-postgres-extras.sh` script present.

**Steps**:

1. Run `pnpm db:fresh-dev` from repo root → drops and recreates the DB, applies schema via `drizzle-kit push`, runs seeds.
2. Immediately run `packages/db/scripts/apply-postgres-extras.sh` → applies triggers, materialized views (`search_index`), and JSONB CHECK constraints.
3. Verify: query `SELECT count(*) FROM search_index` → materialized view exists and is populated.
4. Verify: list triggers on `accommodations` table → expected triggers present.
5. Re-run `apply-postgres-extras.sh` a second time → script is idempotent (no duplicate triggers or constraint violations).
6. Run `pnpm db:seed` → seeds complete without FK violations.

**Acceptance criteria** (all must pass):

- [ ] `pnpm db:fresh-dev` completes without errors on a clean DB.
- [ ] `apply-postgres-extras.sh` runs without errors.
- [ ] `search_index` materialized view populated.
- [ ] Triggers on `accommodations` table present.
- [ ] Second run of `apply-postgres-extras.sh` is idempotent (no errors).
- [ ] Seed completes without FK violations.

**Notes / gotchas**:

- From the project memory (SPEC-078-GAPS): `apply-postgres-extras.sh` was previously not chained into `db:fresh-dev`. Verify this was fixed. If not, the step must be manually executed — flag as a defect.

---

### 83: DB backup and restore

> **Mode**: `owner-manual`
> **Estimated effort**: ~45min (including restore verification)
> **Source**: checklist item #83

**Preconditions**:

- Access to staging PostgreSQL instance.
- `pg_dump` and `pg_restore` available on the local machine.

**Steps**:

1. Run: `pg_dump -Fc $HOSPEDA_DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).dump` → dump file created.
2. Create a new empty test database: `createdb hospeda_restore_test`.
3. Restore: `pg_restore -d hospeda_restore_test backup_*.dump` → completes without errors.
4. Connect to `hospeda_restore_test` and verify: `SELECT count(*) FROM accommodations` → matches source DB count.
5. Run a sample query: `SELECT name FROM accommodations LIMIT 5` → returns expected data.
6. Verify triggers are present in the restored DB (they should be included in `pg_dump -Fc`).
7. Document: total dump time, dump file size, restore time → add to runbook.
8. Drop test database: `dropdb hospeda_restore_test`.

**Acceptance criteria** (all must pass):

- [ ] `pg_dump` completes without errors.
- [ ] `pg_restore` completes without errors.
- [ ] Row counts match between source and restored DB.
- [ ] Sample queries return expected data in the restored DB.
- [ ] Runbook documents dump/restore timings and file size for SLA planning.

---

### 84: Deploy rollback

> **Mode**: `owner-manual`
> **Estimated effort**: ~15min
> **Source**: checklist item #84

**Preconditions**:

- At least 2 production deployments in Vercel history.
- A known-good previous deployment to roll back to.

**Steps**:

1. Identify the current production deployment and the previous one in Vercel dashboard.
2. Click "Promote to Production" (or equivalent rollback button) on the previous deployment.
3. Vercel triggers the rollback → new deployment is active within 2 minutes.
4. Verify the rolled-back app is functional: GET `https://hospeda.com.ar/health` → 200.
5. Verify DB schema compatibility: if the rolled-back code uses an older schema, confirm forward-only migrations did not break it (verify no column added by the rolled-back version was deleted).
6. Document the rollback time (from click to traffic served by old version).

**Acceptance criteria** (all must pass):

- [ ] Rollback completes within 5 minutes (target: < 2 minutes for Vercel instant rollback).
- [ ] Rolled-back deployment is functional (`/health` returns 200).
- [ ] DB schema is compatible with the rolled-back code (no migration that added a NOT NULL column without default).
- [ ] No data loss during rollback.

**Notes / gotchas**:

- Vercel instant rollback re-promotes a previous build artifact — no rebuild required, so the "< 2 minutes" target is realistic.
- DB forward-only migrations may be incompatible with a rollback if the new migration added a NOT NULL column. This is a schema design risk to monitor.

---

### 85: Healthcheck and readiness

> **Mode**: `auto-runnable-CI`
> **Estimated effort**: ~15s in CI
> **Source**: checklist item #85

**Preconditions**:

- API running in a production-equivalent environment.
- DB connected.

**Steps**:

1. GET `/health` → 200, `{ "status": "healthy" }` (confirmed from route implementation).
2. GET `/health/ready` → 200 when all services initialized.
3. GET `/health/live` → 200 (process alive check).
4. Verify Vercel configuration: `healthcheckPath` or equivalent set in `vercel.json` to `/health` → Vercel uses this to gate traffic routing.
5. Simulate a cold start: stop and restart the API, immediately poll `/health/ready` — it should return 503 until the DB pool warms up, then 200.
6. Confirm warm-up time is within acceptable range (< 5s for the DB pool).

**Acceptance criteria** (all must pass):

- [ ] `/health` returns 200 in normal operation.
- [ ] `/health/ready` returns 503 during startup and 200 after initialization.
- [ ] `/health/live` returns 200 at any point the process is running (even during startup).
- [ ] Vercel healthcheck configuration references `/health` (or `/health/ready`).
- [ ] Cold start readiness time < 5 seconds.

---

## R. Audit, compliance and privacy (3 P0 items)

### 90: Cookie consent

> **Mode**: `owner-manual`
> **Estimated effort**: ~10min
> **Source**: checklist item #90

**Preconditions**:

- Web app deployed.
- Cookie consent banner implemented (verify `apps/web/src/` for consent component).
- Sentry and analytics scripts configured to fire only after consent.

**Steps**:

1. Open `https://hospeda.com.ar/es` in an incognito window (no cookies) → cookie consent banner appears immediately.
2. Banner offers at minimum "Accept all" and "Reject non-essential" options (granular options preferred: necessary / analytics / marketing).
3. Click "Reject non-essential" → banner dismisses, preference stored in a cookie or localStorage.
4. Verify: analytics scripts (if any) are NOT loaded after rejection; Sentry error tracking (classified as necessary) continues to load.
5. Reload the page → banner does NOT reappear (preference remembered).
6. Clear cookies → banner reappears on next visit.
7. Accept all → analytics and marketing scripts load.

**Acceptance criteria** (all must pass):

- [ ] Banner appears on first visit with no prior consent.
- [ ] Rejection suppresses non-essential scripts.
- [ ] Preference persists across page reloads.
- [ ] Banner does not reappear until cookies are cleared.
- [ ] Accepting all loads all configured scripts.
- [ ] No Sentry/analytics scripts load before consent is given (except Sentry if classified as necessary infrastructure).

---

### 91: Privacy policy and terms

> **Mode**: `owner-manual`
> **Estimated effort**: ~10min
> **Source**: checklist item #91

**Preconditions**:

- Web app running.
- Legal pages exist at the expected URLs.

**Steps**:

1. Navigate to `/es/legal/privacidad` → page renders with HTTP 200, content visible (not empty/placeholder).
2. Navigate to `/es/legal/terminos` → page renders, content visible.
3. Attempt to access `/es/legal/cookies` → if page exists: content visible; if not: identify this as a gap.
4. Verify: footer links on the home page include links to privacy policy and terms.
5. Verify: each legal page has a "Last updated" date visible to the user.
6. Verify: pages are accessible without login (public, no auth required).
7. Attempt `/en/legal/privacidad` (English locale) → page renders in English (or falls back to Spanish with a note).

**Acceptance criteria** (all must pass):

- [ ] `/es/legal/privacidad` renders with real content (not a placeholder).
- [ ] `/es/legal/terminos` renders with real content.
- [ ] Footer links to both pages from every page.
- [ ] Each page shows a "Last updated" date.
- [ ] Pages accessible without authentication.
- [ ] English locale versions exist or clearly redirect to Spanish equivalents.

**Notes / gotchas**:

- From the file listing: `apps/web/src/pages/[lang]/legal/privacidad/index.astro` and `terminos/index.astro` exist. `/legal/cookies` is NOT in the listing — flag as a gap if required by GDPR.

---

### 92: PII in URLs / referrers

> **Mode**: `owner-manual`
> **Estimated effort**: ~10min
> **Source**: checklist item #92

**Preconditions**:

- Web app running.
- Browser DevTools available to inspect network requests and headers.

**Steps**:

1. Perform a password reset flow → inspect the URL of the reset link: the token should be in the path (not a query param), e.g. `/auth/reset-password?token=...` — if it IS a query param, this may appear in referrer headers.
2. From the reset page, click any external link (e.g. a help link) → inspect the `Referer` header in the linked request — the token should NOT be in the Referer due to `Referrer-Policy`.
3. Inspect response headers on all pages: `Referrer-Policy: strict-origin-when-cross-origin` (or stricter) present.
4. Check all paginated/filtered URLs: no email addresses or user IDs embedded in query params (use opaque IDs, not emails).
5. Navigate to the conversation token URL `/es/guest/messages/{token}` → access the page, then click any external link → verify the token does NOT appear in the external request's Referer.
6. Inspect the session cookie name: no PII in the cookie value (it should be an opaque session ID, not a JWT with email).

**Acceptance criteria** (all must pass):

- [ ] `Referrer-Policy: strict-origin-when-cross-origin` (or stricter) header present on all page responses.
- [ ] Password reset token does not appear in Referrer headers when navigating from the reset page.
- [ ] Guest conversation token does not leak via Referrer to external sites.
- [ ] No email addresses or sensitive IDs in any query param across standard user flows.
- [ ] Session cookie value is an opaque ID (not a decodable JWT with PII).

---

## S. Seed data (1 P0 item)

### 93: Seed runs cleanly on fresh DB

> **Mode**: `agent-runnable`
> **Estimated effort**: ~15min
> **Source**: checklist item #93

**Preconditions**:

- Docker running with PostgreSQL.
- SPEC-095 manifest available: 104 accommodations, 6 events, full destination hierarchy.

**Steps**:

1. Run `pnpm db:fresh-dev` → completes without errors; DB reset, schema applied, seed runs.
2. Run `packages/db/scripts/apply-postgres-extras.sh` → completes without errors.
3. Query: `SELECT count(*) FROM accommodations WHERE deleted_at IS NULL` → returns 104.
4. Query: `SELECT count(*) FROM events WHERE deleted_at IS NULL` → returns 6.
5. Query: `SELECT count(*) FROM destinations` → returns the expected hierarchy count (all nodes from Argentina down to municipalities).
6. Check foreign keys: `SELECT a.id FROM accommodations a LEFT JOIN destinations d ON a.destination_id = d.id WHERE d.id IS NULL` → returns 0 rows (no orphaned FK).
7. Check: `SELECT a.id FROM accommodations a LEFT JOIN users u ON a.owner_id = u.id WHERE u.id IS NULL` → returns 0 rows.
8. Run `pnpm test` → all existing tests pass (seed data does not conflict with test fixtures).

**Acceptance criteria** (all must pass):

- [ ] `pnpm db:fresh-dev` + `apply-postgres-extras.sh` complete without errors.
- [ ] Accommodation count = 104 (SPEC-095 manifest).
- [ ] Event count = 6.
- [ ] No orphaned `destination_id` FK in `accommodations`.
- [ ] No orphaned `owner_id` FK in `accommodations`.
- [ ] All destination hierarchy nodes present with valid parent references.
- [ ] Existing test suite passes after seeding.

---

## T. End-to-end journeys (5 P0 items)

### 96: Journey "Host discovers Hospeda and publishes"

> **Mode**: `owner-manual`
> **Estimated effort**: ~60min for one full unassisted walkthrough
> **Source**: checklist item #96

**Preconditions**:

- Staging environment deployed and indexed (or production with real content for SEO step).
- Real Cloudinary, Resend, and Better Auth configured.
- Tester acts as a "first-time cabin owner" with no prior knowledge of the system.

**Steps**:

1. (SEO) Google `site:hospeda.com.ar` → Hospeda pages appear in results; try a realistic query like "alojamiento concepcion del uruguay" → Hospeda appears.
2. Click the result → land on host landing or home page → LCP < 2.5s on mobile.
3. Navigate to the "Publicar mi alojamiento" CTA → if not logged in, inline signup appears without leaving the page → complete signup and email verification.
4. Receive and click email verification link → account activated → return to onboarding form automatically.
5. Complete the 8-section form with realistic data (name, type, location, description, amenities, 8-10 photos from mobile, pricing, availability).
6. Photos upload from mobile camera → thumbnails appear within 5 seconds each → rate limiter does not trigger.
7. Click "Publicar" → trial activates automatically (no card requested) → HOST role assigned → `accommodations.lifecycleState = ACTIVE`.
8. Redirect to `/es/alojamientos/{slug}` → property visible publicly, JSON-LD present.
9. Share the link with a friend (different device/session) → friend can access the page without login.
10. Return to `/es/mi-cuenta/propiedades` → edit price → change visible within 60 seconds on the public detail page via ISR.
11. (Parallel test) Another browser/incognito: navigate `/es/alojamientos?destination={slug}` → new property appears in results.

**Acceptance criteria** (all must pass):

- [ ] SEO: Hospeda appears in Google results for relevant queries (manual check).
- [ ] Inline signup during onboarding has no friction (no separate "register" page required).
- [ ] Email verification real inbox delivery within 2 minutes.
- [ ] 8-section form completable in one 40min session with autosave.
- [ ] Mobile photo upload (10 photos) succeeds without rate-limit block.
- [ ] Trial subscription created with `status = 'trialing'` on publish.
- [ ] HOST role assigned; `lifecycleState = ACTIVE`.
- [ ] Property publicly accessible immediately after publish.
- [ ] ISR update visible within 60 seconds after price edit.
- [ ] "Welcome" + "Property published" emails received.
- [ ] Audit log: `created_accommodation`, `role_assigned` events present.
- [ ] Sentry: 0 errors during the full journey.

---

### 97: Journey "Host trial → pays → renews → buys addon → cancels"

> **Mode**: `owner-manual`
> **Estimated effort**: ~90min with MP sandbox (including simulated time jumps)
> **Source**: checklist item #97

**Preconditions**:

- HOST account in trial phase (from journey #96 or a fresh fixture).
- MP sandbox configured with test cards.
- DB access to simulate date transitions.

**Steps**:

1. (Day 1 simulation) HOST published, trial active. Verify: `billing_subscriptions.status = 'trialing'`, `trialEndsAt` set correctly.
2. (Day 25 simulation) Update `trialEndsAt` to 5 days from now in DB → trigger trial-reminder cron → HOST receives "trial expires in 5 days" email.
3. (Day 28 simulation) HOST navigates to `/es/suscriptores/planes` → compare plans → select a plan → MP checkout → enter APRO test card → payment confirmed.
4. MP webhook arrives → `billing_subscriptions.status = 'active'`, `currentPeriodEnd` set → confirmation email received.
5. (Day 30 simulation) Update `trialEndsAt` to past → trial expires → verify: since already paid, NO feature degradation.
6. (Month 2 simulation) Update `currentPeriodEnd` to past → renewal cron fires → MP renewal webhook → `currentPeriodEnd` extended → no downtime.
7. (Month 3) HOST buys "Featured listing 30 days" addon → MP webhook → `billing_subscription_addons` row with `expiresAt` set → property appears featured in search.
8. (Month 4) Update addon `expiresAt` to past → addon expiration cron runs → addon deactivated → entitlement removed → property no longer featured.
9. (Month 5) HOST cancels: navigate `/es/mi-cuenta/suscripcion` → "Cancelar" → `cancelAtPeriodEnd = true` → access retained through period.
10. (Month 6) Update `currentPeriodEnd` to past → subscription expires → HOST features deactivated → property goes `INACTIVE` → data preserved.

**Acceptance criteria** (all must pass):

- [ ] Trial reminder email received when configured days before expiry.
- [ ] MP checkout with APRO card activates subscription.
- [ ] Trial expiry with active paid plan: no feature interruption.
- [ ] Automatic renewal extends `currentPeriodEnd`; no downtime.
- [ ] Addon purchase creates entitlement; property featured in search.
- [ ] Addon expiration deactivates entitlement; no longer featured.
- [ ] Cancellation sets `cancelAtPeriodEnd`; access retained through period end.
- [ ] Post-expiry: property `INACTIVE`, data preserved, reactivation possible.
- [ ] Audit log: `TRIAL_STARTED`, `SUBSCRIPTION_CREATED`, `ADDON_PURCHASED`, `ADDON_EXPIRED`, `SUBSCRIPTION_CANCELED` events all present.
- [ ] MP webhook replay does NOT double-process any event.

---

### 99: Journey "Tourist searches, expresses interest, contacts host, returns"

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min
> **Source**: checklist item #99

**Preconditions**:

- GUEST (incognito browser) and HOST accounts available.
- At least one `ACTIVE` accommodation with the HOST as owner.
- Real Resend configured for email delivery.

**Steps**:

1. GUEST (incognito) navigates to `/es/alojamientos/{slug}` (as if arrived from Google) → page renders correctly.
2. GUEST clicks the bookmark/favorites heart → login required modal appears → GUEST signs up with minimal friction.
3. After signup and email verification → redirect back to the accommodation page → bookmark saved.
4. GUEST clicks "Contact host" → message form appears → GUEST types "Hola, me interesa reservar para enero" → sends.
5. HOST receives email notification within 2 minutes with message preview and direct link.
6. HOST clicks link → opens `/es/mi-cuenta/messages/{conversationId}` → sees GUEST's message → replies "Gracias, tenemos disponibilidad".
7. GUEST receives email notification with HOST's reply → opens conversation via link in email.
8. Exchange continues for 5 messages → conversation `OPEN` throughout.
9. Simulate inactivity: update conversation `lastMessageAt` to 30+ days ago → run conversation-cleanup cron (if implemented) → conversation auto-closed; SYSTEM message appears.
10. (3 months later) GUEST navigates to `/es/mi-cuenta/conversaciones` → archived conversation with full history visible.
11. Third USER (not a participant) attempts GET `/api/v1/protected/conversations/{id}` → 403.

**Acceptance criteria** (all must pass):

- [ ] Bookmark saved after inline signup (no multi-step friction).
- [ ] Host email notification with message preview received within 2 minutes.
- [ ] Host reply triggers guest email notification.
- [ ] Conversation history preserved in `/es/mi-cuenta/messages`.
- [ ] Conversation auto-closes after inactivity with SYSTEM message.
- [ ] Archived conversation accessible to participants; full history visible.
- [ ] Non-participant access → 403 on both GET and POST.
- [ ] Emails sent in the receiver's preferred locale.
- [ ] Bookmark shows "no longer available" state if the accommodation is later soft-deleted.

---

### 100: Journey "Admin's typical operations day"

> **Mode**: `owner-manual`
> **Estimated effort**: ~30min
> **Source**: checklist item #100

**Preconditions**:

- Admin account with full billing + moderation permissions.
- A second admin account with restricted permissions (no refund ability).
- Staging DB with pending moderation content, a billing event needing attention, and a suspicious user.

**Steps**:

1. Admin logs in at `/admin` → dashboard shows: pending accommodations count, today's payments, addons expiring today.
2. Navigate to `/admin/accommodations?status=PENDING` → review first pending accommodation → click "Approve" → `lifecycleState = ACTIVE` → HOST receives approval email.
3. Navigate to `/admin/billing/addons` → find an addon with `ADDON_REVOCATION_FAILED` compensating event → click "Retry revocation" → entitlement successfully deactivated.
4. Navigate to `/admin/billing/subscriptions` → search for HOST's subscription → click "Refund" → confirm refund amount → refund queued to MP → audit log entry created.
5. Navigate to `/admin/users` → search for the suspicious user → assign USER role (downgrade from HOST) → suspend account.
6. Export CSV of active subscriptions: click "Export" in billing dashboard → CSV file downloads with correct columns.
7. Admin logs out → session ends cleanly → next request to `/admin` redirects to login.
8. Restricted admin (no refund permission): attempt the refund step → "Refund" button absent or disabled → API rejects PATCH request with 403.

**Acceptance criteria** (all must pass):

- [ ] Dashboard shows actionable counts (pending, expiring, etc.).
- [ ] Accommodation approval updates `lifecycleState` and sends HOST email.
- [ ] Addon revocation retry works from admin panel.
- [ ] Refund flow creates audit log entry with `actorId` and `targetId`.
- [ ] Role downgrade and suspension take effect on next HOST login.
- [ ] CSV export downloads correctly formatted file.
- [ ] Logout invalidates session.
- [ ] Restricted admin cannot access refund action (PermissionEnum enforced).
- [ ] Every admin action visible in the audit log within the same session.

---

### 101: Journey "Failure recovery — something breaks in prod"

> **Mode**: `owner-manual`
> **Estimated effort**: ~45min (chaos scenarios can be run individually)
> **Source**: checklist item #101

**Preconditions**:

- Staging environment with Redis, Cloudinary, and Resend configured.
- Ability to temporarily break each dependency (stop Redis, disconnect Cloudinary, disable Resend).

**Steps**:

1. (MP webhook delay) Stop the webhook endpoint (or simulate 5min downtime), then send a queued MP webhook → system processes on retry without double-charge.
2. (Cloudinary slow) Throttle Cloudinary requests (simulate via network proxy) → upload waits and retries → after 3 retries, displays "Upload failed, please try again" to host. No 500.
3. (Redis down) Stop Redis → send 10 requests to a rate-limited endpoint → requests succeed (fail-open, memory fallback) → server logs warning "Redis unavailable, using memory fallback" → no 500 errors.
4. (DB read lag) Simulate high DB latency (pg proxy or `SELECT pg_sleep(2)`) → home page shows cached content; if stale > 30s, a "refreshing" banner or fallback shown. No 500.
5. (Resend down) Disable Resend API key → trigger an email (e.g. HOST creates accommodation) → email delivery fails → system logs `failed_email_send` → user sees success UI (accommodation published), email delivery failure is silent to user but logged.
6. (Deploy failure) Push a deployment with a deliberate startup error → Vercel deployment fails health check → previous deployment remains active (automatic rollback or Vercel's zero-downtime guaranteed).

**Acceptance criteria** (all must pass):

- [ ] MP webhook replay (after downtime) processes exactly once, no double-charge.
- [ ] Cloudinary timeout shows user-friendly retry message, no 500.
- [ ] Redis downtime: rate limiter fails open, API continues serving requests, warns in logs.
- [ ] DB latency: no 500, cached content served with appropriate UX feedback.
- [ ] Resend failure: `failed_email_send` logged; user-facing flow completes successfully.
- [ ] Failed Vercel deploy does not take down production (previous deploy remains active).
- [ ] No user-facing stack traces or internal error details in any failure scenario.
- [ ] Sentry groups each failure type correctly (not one event per failed request).
