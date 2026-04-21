# SPEC-091: MVP Blockers — Host Onboarding + Subscription Checkout

> **Status**: draft
> **Priority**: P0 (critical — MVP blocker for beta)
> **Complexity**: XL
> **Origin**: 2026-04-21 — gap analysis before real-client beta testing; backend is 85%+ complete but two user-facing flows are entirely absent from the web app.
> **Affected packages**: apps/web, apps/api (webhook verification only)
> **Created**: 2026-04-21
> **Estimated effort**: ~35 hours (~2 weeks at 20h/week)
> **Depends on**: SPEC-078 (Cloudinary — done), SPEC-063 (lifecycle states — done), SPEC-059 (transactions — done), Better Auth email verification (done)

---

## Overview

85%+ of Hospeda's backend and admin infrastructure is complete and production-ready. Two user-facing flows remain entirely absent from the web app, making real beta testing impossible:

1. **Host Onboarding**: Property owners have no UI path to publish an accommodation. The backend endpoints exist and are tested, but no `/publicar` flow exists on the web app. A new user cannot become a host without direct database manipulation.

2. **Subscription Checkout**: The pricing pages (`/suscriptores/planes/`) are static marketing content. No CTA button calls the checkout endpoint. The QZPay/MercadoPago billing backend is complete, but users cannot subscribe.

This spec covers both features because they ship together as a single beta-readiness gate. Neither alone constitutes a shippable beta.

---

## Goals

- Enable a new user to go from signup → email verification → publish first property in 15 minutes or less.
- Enable a visitor to go from pricing page → completed subscription in 3 clicks or fewer.
- Achieve 0 subscription status desync incidents during the first 2 weeks of beta operation.
- No new backend services required. All new code is in the web app (React islands + Astro pages) plus webhook verification in the API.

### Success Metrics

- New user completes the full host onboarding flow end-to-end without support intervention (measured in beta user testing).
- All 3 checkout result states (success, pending, failure) render correctly and reflect real MercadoPago payment outcomes.
- Autosave draft roundtrip confirmed working: user closes browser mid-form, reopens, and all entered data is present.
- `pnpm typecheck && pnpm lint && pnpm test` passes across all touched packages.

---

## Feature 1: Host Onboarding (Single-Form, Option B)

**Approved design decision**: A single page with collapsible sections and autosave to draft. Not a multi-step wizard.

### Actors

- **Authenticated user**: any logged-in user with a verified email address.
- **Host**: an authenticated user who has published at least one property (role `HOST` or `OWNER`).
- **Unauthenticated visitor**: a user browsing without a session.

### User Journey

1. Visitor lands on `/publicar` and reads host landing page.
2. They click the CTA "Publicar tu propiedad".
3. If not logged in, they are redirected to `/auth/signin?redirect=/publicar/nueva`.
4. After login/signup and email verification, they land on `/publicar/nueva`.
5. They see a single-page form with 8 collapsible sections, all expanded by default.
6. They fill in data section by section. Every 30 seconds (or on section blur), the form autosaves to `DRAFT` state via the API.
7. A "Guardado" indicator confirms each save.
8. At any point they can close the browser and return to `/mi-cuenta/propiedades` to resume the draft.
9. When satisfied, they click "Publicar". The property transitions to `PUBLISHED`.
10. They are redirected to the property detail page (`/alojamientos/{slug}`).
11. If they did not already have the `HOST`/`OWNER` role, the backend assigns it automatically on publish.

### Form Sections

The form on `/publicar/nueva` has 8 collapsible sections rendered on a single page:

| # | Section key | Fields |
|---|-------------|--------|
| 1 | `datos-basicos` | name, property type (select from `PropertyTypeEnum`), short description, long description |
| 2 | `ubicacion` | street address, city, country, latitude, longitude (Leaflet map for pin drop) |
| 3 | `capacidad` | max guests, bedrooms, bathrooms, beds |
| 4 | `amenities` | multi-select from the existing amenities catalog |
| 5 | `fotos` | image uploader to Cloudinary (reuse SPEC-078 `GalleryField` or equivalent island) |
| 6 | `precio` | price per night, currency (ARS or USD) |
| 7 | `contacto` | contact email, phone, contact preference (email/phone/both) |
| 8 | `publicar` | "Guardar borrador" button and "Publicar" primary button; summary of missing required fields |

All required fields must be completed before "Publicar" is enabled. "Guardar borrador" is always enabled.

### Routes

| Route | Page | Auth required | Notes |
|-------|------|---------------|-------|
| `/[lang]/publicar` | Host landing page | No | Can reuse content from `/suscriptores/propietarios/`; CTA links to `/publicar/nueva` |
| `/[lang]/publicar/nueva` | Single-form property creation | Yes | Full form island; middleware redirect if not authenticated |
| `/[lang]/mi-cuenta/propiedades` | User's own property list | Yes | Status badges: `DRAFT`, `PUBLISHED`, `SUSPENDED` |
| `/[lang]/mi-cuenta/propiedades/[id]/editar` | Edit existing property | Yes | Same form island in edit mode; pre-fills from existing data |

---

### User Stories — Feature 1

#### US-091-01: Host landing page

As an unauthenticated visitor,
I want a landing page that explains the benefits of publishing on Hospeda with a clear CTA,
so that I understand what publishing involves before committing to create an account.

**Acceptance Criteria**

```
Given I visit /publicar as an unauthenticated visitor,
When the page loads,
Then I see a landing page with a hero section explaining the host program,
AND a primary CTA button "Publicar tu propiedad" is clearly visible above the fold.

Given I click "Publicar tu propiedad" while unauthenticated,
When the click is processed,
Then I am redirected to /auth/signin?redirect=/publicar/nueva,
AND after successful login I am taken to /publicar/nueva.

Given I visit /publicar as an authenticated user,
When the page loads,
Then the primary CTA button links directly to /publicar/nueva,
AND a secondary link "Ver mis propiedades" links to /mi-cuenta/propiedades.
```

---

#### US-091-02: Single-form property creation

As an authenticated user with a verified email,
I want to fill out a single page form to publish my property,
so that I can complete the process without navigating multiple pages.

**Acceptance Criteria**

```
Given I navigate to /publicar/nueva as an authenticated user,
When the page loads,
Then I see a single-page form with all 8 collapsible sections visible and expanded by default,
AND a "Guardar borrador" button and a disabled "Publicar" button at the bottom.

Given I open the form for the first time,
When I inspect section headers,
Then each section shows a completion indicator (empty circle / filled check) so I know what remains.

Given I am filling out section 1 (datos-basicos) and provide a valid name,
When I move to section 2,
Then section 1 collapses and shows a green check in its header,
AND section 2 expands automatically.

Given I am on the form with at least one required field missing,
When I inspect the "Publicar" button,
Then the button is disabled,
AND a summary of missing required fields is shown in section 8.

Given I have completed all required fields,
When I inspect the "Publicar" button,
Then the button is enabled and ready to submit.

Given I click "Publicar" with a completed form,
When the API responds with success,
Then I am redirected to the newly created property's detail page (/alojamientos/{slug}),
AND a success toast "Propiedad publicada" is shown.

Given the API returns an error on publish,
When the error is received,
Then an error message is displayed inline near the "Publicar" button,
AND the form data is not lost.
```

---

#### US-091-03: Autosave draft

As an authenticated user filling out the property form,
I want my progress to be automatically saved as a draft every 30 seconds,
so that I never lose my work if I close the browser accidentally.

**Acceptance Criteria**

```
Given I am filling out the property form and 30 seconds have elapsed since the last save,
When the autosave timer fires,
Then a POST or PATCH request is sent to the API with the current form state and status DRAFT,
AND a "Guardado" indicator appears in the form header for 3 seconds then fades.

Given I switch focus from one section to another,
When the blur event fires on the section,
Then an autosave is triggered immediately (not waiting for the 30-second interval).

Given an autosave fails due to a network error,
When the error is detected,
Then the "Guardado" indicator shows "Error al guardar. Reintentando..." in amber color,
AND the system retries the save once after 5 seconds.

Given I have an existing draft property (status DRAFT),
When I navigate to /publicar/nueva,
Then I am shown a prompt: "Tenés un borrador guardado. ¿Continuás donde dejaste?" with "Continuar" and "Empezar de cero" options.

Given I choose "Continuar" on the draft prompt,
When the form loads,
Then all previously entered data is pre-filled in the form,
AND the autosave ID is set to the existing draft's ID.
```

---

#### US-091-04: Property management dashboard

As a host with published or draft properties,
I want to see all my properties in one place with their status,
so that I can manage my listings without contacting support.

**Acceptance Criteria**

```
Given I navigate to /mi-cuenta/propiedades as an authenticated user with no properties,
When the page loads,
Then I see an empty state with a CTA "Publicar tu primera propiedad" linking to /publicar/nueva.

Given I navigate to /mi-cuenta/propiedades with at least one property,
When the page loads,
Then I see a card or row for each property showing: thumbnail, name, status badge, city, price per night,
AND each entry has an "Editar" link and a contextual action ("Publicar" for drafts, "Despublicar" for published).

Given a property has status DRAFT,
When I view its card in /mi-cuenta/propiedades,
Then it displays a "Borrador" badge in amber/yellow color.

Given a property has status PUBLISHED,
When I view its card in /mi-cuenta/propiedades,
Then it displays a "Publicada" badge in green color,
AND a "Ver en el sitio" link that opens the public property detail page.

Given I click "Editar" on any property,
When the edit page loads,
Then I see the same single-page form pre-filled with all existing property data,
AND changes I make are saved via PATCH (not POST).
```

---

#### US-091-05: Role assignment on first publish

As a user publishing my first property,
I want my account to automatically reflect my host status,
so that I have access to host-specific features without manual admin intervention.

**Acceptance Criteria**

```
Given I am an authenticated user with role USER (no host/owner role),
When I successfully publish a property for the first time,
Then my account is assigned the HOST or OWNER role,
AND subsequent requests reflect the updated role without requiring me to log out and back in.

Given I already have the HOST or OWNER role,
When I publish an additional property,
Then no duplicate role assignment occurs,
AND the publish action completes without error.
```

---

### Technical Notes — Feature 1

- **API endpoints used**:
  - `POST /api/v1/protected/accommodations/` — create new accommodation
  - `PATCH /api/v1/protected/accommodations/:id` — update draft or transition to PUBLISHED
  - `GET /api/v1/protected/accommodations/` — list user's own accommodations (filtered by owner)
  - `GET /api/v1/protected/accommodations/:id` — fetch single accommodation for edit pre-fill
- **Form validation**: Zod schemas from `@repo/schemas` (`AccommodationInsertSchema`, `AccommodationUpdateSchema`). Frontend validates before submit; API validates independently.
- **Status transitions**: `DRAFT → PUBLISHED` handled by existing lifecycle system (SPEC-063). The form sends `status: 'PUBLISHED'` on the final publish action.
- **Autosave concurrency**: Last-write-wins acceptable for MVP. The form tracks the draft's `id` in state after first save; subsequent saves use PATCH on that `id`.
- **Image upload**: Reuse the Cloudinary uploader component from SPEC-078. If a standalone `GalleryField` island does not exist, create a minimal `AccommodationImageUploader.client.tsx` that calls the existing upload endpoint.
- **Map component**: Leaflet + OpenStreetMap. No API key required. Renders a map with a draggable pin; updates the `latitude`/`longitude` form fields on pin drop. Load Leaflet via dynamic import to avoid SSR issues.
- **i18n**: Default locale is Spanish (`es`). All new form labels, error messages, and static strings are added to the appropriate namespace in `packages/i18n`. Structure for `en`/`pt` prepared but translation deferred.
- **Rendering strategy**: `/publicar` is SSG (static marketing page). `/publicar/nueva`, `/mi-cuenta/propiedades`, and the edit page are SSR (session-gated).

---

## Feature 2: Subscription Checkout Button

### Actors

- **Visitor**: unauthenticated user on the pricing page.
- **Authenticated user**: logged-in user ready to subscribe.
- **Subscriber**: a user who has successfully completed a checkout.
- **Platform operator**: receives and processes MercadoPago webhooks.

### User Journey

1. User visits `/suscriptores/planes/` and views plan cards.
2. They click "Contratar" on a plan card.
3. If not logged in, they are redirected to `/auth/signin?redirect=/suscriptores/planes`.
4. If logged in, the `PlanPurchaseButton` island POSTs to `/api/v1/protected/billing/checkout` with `{ planId }`.
5. The API returns `{ preferenceId, initPoint }` (MercadoPago hosted checkout URL).
6. The browser is redirected to `initPoint`.
7. The user completes payment on MercadoPago.
8. MercadoPago redirects back to the configured return URL:
   - Success → `/suscriptores/checkout/success?collection_status=approved&payment_id=...`
   - Pending → `/suscriptores/checkout/pending?collection_status=pending&...`
   - Failure → `/suscriptores/checkout/failure?collection_status=rejected&...`
9. In parallel, MercadoPago sends a webhook to the API, which updates the subscription status atomically.

### Routes

| Route | Page | Auth required | Notes |
|-------|------|---------------|-------|
| `/[lang]/suscriptores/checkout/success` | Payment approved | No (return URL from MP) | Reads URL query params; shows confirmation UI |
| `/[lang]/suscriptores/checkout/pending` | Payment being processed | No | Shows "Estamos procesando tu pago" state |
| `/[lang]/suscriptores/checkout/failure` | Payment rejected | No | Shows error message with retry CTA |

No new route for the pricing page itself — only the `PlanPurchaseButton` island is inserted into the existing `/suscriptores/planes/` page.

### Component

`apps/web/src/components/billing/PlanPurchaseButton.client.tsx` — React island.

Props:
```
{
  planId: string
  price: number
  currency: 'ARS' | 'USD'
  ctaText: string
}
```

Behavior:
- Reads auth session to determine if user is logged in.
- If not logged in: renders a button that on click redirects to `/auth/signin?redirect=/suscriptores/planes`.
- If logged in: renders a button that on click calls the checkout API endpoint.
- Loading state: button shows spinner and is disabled while the API call is in flight.
- Error state: if the API returns an error, shows an inline error message below the button.

---

### User Stories — Feature 2

#### US-091-06: Initiate checkout from pricing page

As an authenticated user,
I want to click a "Contratar" button on a pricing plan and be taken to the MercadoPago payment screen,
so that I can subscribe without navigating away from the familiar pricing page.

**Acceptance Criteria**

```
Given I am authenticated and viewing /suscriptores/planes,
When I click "Contratar" on any plan card,
Then a POST request is made to /api/v1/protected/billing/checkout with the selected plan's ID,
AND while the request is in flight the button shows a loading spinner and is disabled to prevent double submission,
AND on success the browser is redirected to the MercadoPago initPoint URL.

Given the checkout API call fails (e.g., network error or API 500),
When the error is received,
Then an inline error message appears below the button: "No pudimos iniciar el pago. Intentá de nuevo.",
AND the button is re-enabled and the loading state is cleared.

Given the checkout API returns a validation error (e.g., plan not found),
When the error is received,
Then an inline error message appears with the server's error description,
AND the button is re-enabled.
```

---

#### US-091-07: Unauthenticated user on pricing page

As an unauthenticated visitor,
I want to be prompted to log in when I try to subscribe,
so that I understand why I cannot proceed directly and can complete login to continue.

**Acceptance Criteria**

```
Given I am not authenticated and viewing /suscriptores/planes,
When I click "Contratar" on any plan card,
Then I am redirected to /auth/signin?redirect=/suscriptores/planes,
AND after successful login I am returned to /suscriptores/planes (not a broken URL).

Given I am not authenticated,
When I view the pricing page,
Then the "Contratar" button is rendered in its normal state (not hidden or disabled),
AND there is no visual indication that login is required until the user clicks the button.
```

---

#### US-091-08: Payment success confirmation

As a user who has completed payment on MercadoPago,
I want to see a clear confirmation that my subscription is active,
so that I know the payment was accepted and I can start using my plan.

**Acceptance Criteria**

```
Given MercadoPago redirects me to /suscriptores/checkout/success with collection_status=approved,
When the page loads,
Then I see a confirmation message: "¡Tu suscripción está activa!",
AND the page shows the plan name and confirmation of the payment amount,
AND a CTA button "Ir a mi cuenta" links to /mi-cuenta.

Given MercadoPago redirects me to /suscriptores/checkout/success,
When the page loads,
Then the page title and meta description reflect a successful payment (for history/bookmark clarity).

Given MercadoPago redirects me to /suscriptores/checkout/success but the collection_status query param is absent or unexpected,
When the page loads,
Then the page shows a neutral "Verificando estado del pago..." message with a link to /mi-cuenta for the user to check their subscription status manually.
```

---

#### US-091-09: Payment pending state

As a user whose payment is being processed,
I want to see a clear explanation that my payment is pending,
so that I do not worry about a lost payment or try to pay again.

**Acceptance Criteria**

```
Given MercadoPago redirects me to /suscriptores/checkout/pending,
When the page loads,
Then I see a message: "Tu pago está siendo procesado",
AND an explanatory paragraph states that the process can take up to 24 hours,
AND a CTA "Verificar estado" links to /mi-cuenta where they can see their subscription status.

Given the pending page loads,
When I inspect it,
Then there is no "Pagar de nuevo" or retry button (payment is not failed, just in process).
```

---

#### US-091-10: Payment failure with retry

As a user whose payment was rejected,
I want to understand why it failed and have a clear path to try again,
so that I am not left on a dead-end page.

**Acceptance Criteria**

```
Given MercadoPago redirects me to /suscriptores/checkout/failure,
When the page loads,
Then I see a message: "El pago no pudo procesarse",
AND a brief user-friendly explanation (insufficient funds, card declined, etc.) is shown if available from the query params,
AND a primary CTA "Intentar de nuevo" redirects me back to /suscriptores/planes,
AND a secondary CTA "Contactar soporte" links to the support contact method.

Given the failure page loads,
When I inspect the page,
Then no sensitive payment data (full card numbers, tokens) is displayed in the UI or in the page source.
```

---

#### US-091-11: Webhook-driven subscription activation

As a platform operator,
I want MercadoPago payment webhooks to update subscription status atomically and idempotently,
so that user access reflects their real payment status without manual intervention.

**Acceptance Criteria**

```
Given MercadoPago sends a webhook with payment status "approved",
When the webhook handler receives and validates the request,
Then the corresponding subscription record is updated to ACTIVE,
AND the user's billing entitlements are updated,
AND the webhook is acknowledged with HTTP 200.

Given MercadoPago sends the same webhook notification twice (same notification ID),
When the second webhook arrives,
Then the handler detects the duplicate via the notification ID,
AND returns HTTP 200 without modifying any subscription record,
AND logs the duplicate detection.

Given MercadoPago sends a webhook with payment status "rejected" or "cancelled",
When the webhook handler processes it,
Then the corresponding subscription record is updated to INACTIVE or CANCELLED,
AND HTTP 200 is returned.

Given the webhook arrives with an invalid or missing MercadoPago signature,
When the handler validates the signature,
Then the request is rejected with HTTP 401,
AND no subscription record is modified.

Given the webhook handler encounters a database error while processing,
When the error occurs,
Then the handler returns HTTP 500 (so MercadoPago retries),
AND the error is logged with full context (webhook ID, payment ID, error details).
```

---

### Technical Notes — Feature 2

- **Checkout endpoint**: `POST /api/v1/protected/billing/checkout`. Verify it exists in `apps/api/src/routes/billing/`. If it does not exist, flag as additional work required before implementation can begin.
- **Webhook handler**: Verify `apps/api/src/routes/billing/webhooks/mercadopago.ts` (or equivalent path). The handler must implement idempotency via webhook notification ID stored in a processed-webhooks table or equivalent mechanism. If it does not exist, creating it is part of this spec's scope.
- **MercadoPago return URLs**: Configured as part of the preference object sent to MercadoPago during checkout. The API must set `back_urls.success`, `back_urls.pending`, and `back_urls.failure` to the correct absolute URLs for the current environment.
- **Sandbox vs. production**: Environment variable `HOSPEDA_MERCADOPAGO_SANDBOX=true` (or equivalent) controls which MP credentials are used. Staging always uses sandbox. Production uses real credentials. The return URLs must be environment-aware (use `HOSPEDA_SITE_URL` from `@repo/config`).
- **Result page query params**: MercadoPago sends `collection_id`, `collection_status`, `payment_id`, `payment_type`, `merchant_order_id`, `preference_id` as query params on redirect. The result pages should read and display relevant fields for user clarity.
- **Session state**: The result pages do NOT require authentication (MercadoPago redirects unauthenticated if the session expired during checkout). They should gracefully handle both authenticated and unauthenticated states.
- **Reuse**: `@repo/billing` package provides the checkout logic. The web app only needs the React island and result pages. No new billing logic.

---

### Staging Smoke Test Runbook

Before beta launch, run the following procedure to validate the full checkout flow with sandbox credentials:

1. Set `HOSPEDA_MERCADOPAGO_SANDBOX=true` in staging environment.
2. Log in as a test user (non-admin).
3. Navigate to `/suscriptores/planes/` and click "Contratar" on the base plan.
4. Verify the browser redirects to MercadoPago sandbox checkout URL.
5. Complete payment using MP sandbox test card `5031 7557 3453 0604` (approved).
6. Verify redirect to `/suscriptores/checkout/success`.
7. Check that the subscription record in the database shows `ACTIVE` status.
8. Repeat with test card `4013 7509 5099 2827` (rejection) and verify redirect to `/suscriptores/checkout/failure`.
9. Inspect API logs to confirm webhook was received and processed idempotently.

### Pre-Beta Real Transaction Checklist

One real transaction must be validated before opening beta to paying users:

- [ ] Swap to production MercadoPago credentials in production env.
- [ ] Create a real plan with price ARS $100 (symbolic amount) in production.
- [ ] Complete a real purchase as the platform owner's personal account.
- [ ] Verify webhook received and subscription activated in production DB.
- [ ] Confirm webhook idempotency by checking logs for duplicate handling.
- [ ] Revert plan price or mark the test plan as hidden before opening beta.

---

## UX Considerations

### Loading States

- **Autosave indicator**: "Guardando..." while in flight, "Guardado" (3 seconds) on success, "Error al guardar" (amber, persists until resolved) on failure.
- **Publish button**: spinner + "Publicando..." while the publish request is in flight. Button disabled during this state.
- **PlanPurchaseButton**: spinner + button disabled while the checkout API call is in flight. Button text changes to "Procesando..." to prevent user confusion.

### Error States

- **Form validation errors**: inline, per-field, in Spanish. Shown on submit attempt or on field blur for required fields.
- **Autosave failure**: non-blocking amber warning. User can continue filling the form; retry is automatic.
- **Checkout API error**: inline message below the button. Non-modal. User can retry immediately.
- **Webhook failure**: invisible to the user at the moment of occurrence. The success page shows confirmed data from query params; the authoritative subscription status is updated asynchronously via webhook. If there is a discrepancy, the user's /mi-cuenta page will show the correct status once the webhook is processed.

### Empty States

- `/mi-cuenta/propiedades` with no properties: illustration + "Aún no publicaste ninguna propiedad." + CTA "Publicar ahora".
- `/suscriptores/planes/` with no plans returned from API: should not occur in production but if it does, show "Los planes no están disponibles en este momento. Contactá soporte."

### Accessibility

- All form sections use `<fieldset>` + `<legend>` for screen reader grouping.
- Collapsible sections use `aria-expanded` and `aria-controls` on the toggle button.
- Autosave status indicator uses `aria-live="polite"` so screen readers announce save state changes without interrupting flow.
- The Leaflet map provides a fallback: if JavaScript fails to load, latitude/longitude fields are exposed as plain text inputs.
- All interactive elements are keyboard-navigable. Tab order follows section order.
- Error messages are associated with their fields via `aria-describedby`.
- `PlanPurchaseButton` loading state announces "Procesando..." to screen readers via `aria-label` update.

### Responsive Design

- The property form single page stacks sections vertically on mobile (no sidebar).
- Section collapse/expand toggle is touch-friendly (minimum 44px tap target).
- The Leaflet map on mobile shows a compact fixed-height container (200px) with a "Expandir mapa" toggle.
- Property cards in `/mi-cuenta/propiedades` use a responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop.
- `PlanPurchaseButton` integrates naturally into the existing pricing card layout; no layout changes needed to the pricing page itself.

---

## Out of Scope

- **Admin approval queue for host properties**: Self-publish is approved for MVP. Post-MVP admins can report/unpublish abusive properties.
- **Multi-step wizard onboarding**: Single-form approach (Option B) is confirmed. Wizard design is not considered.
- **Advanced pricing rules**: Seasonal pricing, weekend rates, length-of-stay discounts. Only a single nightly rate for MVP.
- **Calendar and availability management**: Post-MVP feature. Not blocked by this spec.
- **Direct guest booking flow**: Guests contact hosts via the existing owner-contact flow (SPEC-085). No booking engine in scope.
- **Recurring billing management UI**: Only one-time plan selection and redirect to MercadoPago checkout. No upgrade/downgrade, no in-app cancellation, no invoice history UI.
- **Multi-currency conversion**: ARS and USD are accepted as fixed options. No real-time exchange rate conversion.
- **Plan upgrade or downgrade UI**: Post-MVP.
- **Property moderation or review queue**: Post-MVP. A basic admin "unpublish" action covers abuse for MVP.
- **Guest reviews of properties**: Post-MVP.
- **Nightly reconciliation job for subscription status**: Flagged as post-beta mitigation for webhook reliability. Not in scope for this spec.

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `POST /api/v1/protected/accommodations/` | Done | Verified in `apps/api/src/routes/accommodation/protected/` |
| `PATCH /api/v1/protected/accommodations/:id` | Done | Same directory |
| `GET /api/v1/protected/accommodations/` | Done | List endpoint with owner filter |
| SPEC-063 lifecycle states (`DRAFT`, `PUBLISHED`) | Done | `DRAFT → PUBLISHED` transition available |
| SPEC-078 Cloudinary image upload component | Done | Must confirm a reusable island exists or create minimal wrapper |
| SPEC-059 transaction support | Done | Used internally by billing service; no new work required |
| `POST /api/v1/protected/billing/checkout` | Needs verification | Must confirm endpoint exists before implementation starts; if absent, creating it is additional work |
| MercadoPago webhook handler | Needs verification | Must confirm handler exists and covers idempotency; if absent, creating it is in scope |
| Better Auth email verification | Done | User must be email-verified; enforced by existing auth middleware |
| `@repo/billing` QZPay/MercadoPago adapter | Done | Used by the checkout endpoint |
| Pricing page `/suscriptores/planes/` | Exists (static) | `PlanPurchaseButton` island will be inserted into this page |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| MercadoPago webhook reliability in production | Medium | High | Flag nightly reconciliation job for post-beta sprint; log all webhook events with full payload for manual recovery if needed. |
| Self-publish abuse (fake or low-quality listings) | Medium | Medium | Admin "unpublish" action available from day 1; user report button deferred to post-MVP. |
| Cloudinary image upload quota | Low | Medium | Enforce 20-image limit per property at the API level; verify SPEC-078 controls cover this before implementation. |
| Autosave draft race condition (2 open tabs) | Low | Low | Accept last-write-wins for MVP. Document the limitation. |
| MercadoPago sandbox not reflecting production webhook behavior | Medium | Medium | Run pre-beta real transaction checklist (see runbook above) before opening beta. |
| Checkout endpoint does not exist | Low | High | Verify first; if absent, scope it as a prerequisite task before web work begins. |

---

## Deliverables

### Feature 1: Host Onboarding

- `apps/web/src/pages/[lang]/publicar/index.astro` — host landing page (SSG)
- `apps/web/src/pages/[lang]/publicar/nueva.astro` — single-form creation page (SSR)
- `apps/web/src/pages/[lang]/mi-cuenta/propiedades/index.astro` — property list (SSR)
- `apps/web/src/pages/[lang]/mi-cuenta/propiedades/[id]/editar.astro` — edit page (SSR)
- `apps/web/src/components/host/PropertyForm.client.tsx` — main form React island (8 sections, autosave, validation)
- `apps/web/src/components/host/PropertyFormSection.client.tsx` — reusable collapsible section wrapper
- `apps/web/src/components/host/PropertyCard.astro` (or `.tsx`) — property card for /mi-cuenta/propiedades
- `apps/web/src/hooks/useAutosave.ts` — autosave hook (debounced + interval-based, returns save status)
- `apps/web/src/hooks/usePropertyForm.ts` — form state + field validation hook
- i18n strings for new namespaces or extensions to `host.*` namespace in `packages/i18n/src/locales/es/`
- Tests: unit tests for `useAutosave`, `usePropertyForm`; component tests for `PropertyForm`; E2E test for the full happy-path flow (create → autosave → publish → redirect)

### Feature 2: Subscription Checkout

- `apps/web/src/components/billing/PlanPurchaseButton.client.tsx` — React island
- `apps/web/src/pages/[lang]/suscriptores/checkout/success.astro` — success result page
- `apps/web/src/pages/[lang]/suscriptores/checkout/pending.astro` — pending result page
- `apps/web/src/pages/[lang]/suscriptores/checkout/failure.astro` — failure result page
- Webhook handler verification or creation: `apps/api/src/routes/billing/webhooks/mercadopago.ts`
- i18n strings for checkout result pages in `packages/i18n/src/locales/es/`
- Tests: unit tests for `PlanPurchaseButton` (auth states, loading, error); integration test for checkout endpoint roundtrip; webhook handler idempotency test
- Staging smoke test runbook (documented above in this spec)
- Pre-beta real transaction checklist (documented above in this spec)

---

## Open Questions (must be resolved before task generation)

1. **Does `POST /api/v1/protected/billing/checkout` exist?** If not, creating it becomes T-000 (prerequisite) before any web work begins.

2. **Does a reusable Cloudinary upload island exist from SPEC-078?** If yes, what is its component name and import path? If no, the image upload section must create one as part of this spec.

3. **Does the MercadoPago webhook handler exist and cover idempotency?** If partial, what is missing?

4. **Role assignment mechanism**: Does the API automatically assign `HOST`/`OWNER` role on first property publish, or must the web app explicitly trigger a role-update call after successful publish?

5. **Draft resume prompt**: When a user already has a `DRAFT` accommodation, should `/publicar/nueva` always show the resume prompt, or should there be a way to create a second draft (e.g., max 1 active draft per user for MVP)?
