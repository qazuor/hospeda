---
spec-id: SPEC-101
title: Newsletter MVP (email-only with WhatsApp channel CTA)
type: feature
complexity: high
status: draft
created: 2026-05-11T00:00:00.000Z
effort_estimate_hours: 60-80
tags: [newsletter, email, subscription, double-opt-in, brevo, qstash, admin, web, api, schemas, service-core, i18n]
dependencies: []
owner: qazuor
---

# SPEC-101: Newsletter MVP (email-only with WhatsApp channel CTA)

## Part 1 -- Functional Specification

---

### 1. Overview & Goals

**Goal:** Build a complete, legally compliant newsletter subscription system for the Hospeda platform that lets authenticated users subscribe via the website footer, receive double opt-in confirmation, and manage their subscription from their account settings. Admins can compose rich-text campaigns and dispatch them to locale-filtered audiences via an asynchronous delivery engine, with basic open and click metrics tracked per delivery.

**Motivation:**

The platform currently has a boolean flag (`user.settings.newsletter`) with no corresponding subscription infrastructure: the footer form is inert, the toggle endpoint updates the wrong field, and the admin app has no newsletter management surface at all. This spec formalizes the full newsletter loop -- from subscribe to campaign send to unsubscribe -- on a foundation that accommodates a future WhatsApp channel without rearchitecting the data model. A static WhatsApp channel CTA (join link) is surfaced after email verification and in account preferences as an interim strategy to grow that channel while the programmatic integration is deferred.

**Success Metrics:**

- At least 15% of authenticated users opt in to the newsletter within 60 days of launch.
- Email verification rate (verified / subscribed) above 60% within 7 days of signup.
- Campaign delivery rate above 95% of active subscribers reached per send.
- Zero spam complaints or legal infractions from Argentine data protection authority (Ley 25.326).
- 90% code coverage on all new service-core code; 80% on routes and UI components.

---

### 2. Glossary

| Term | Definition |
|---|---|
| **Subscriber** | A user who has opted in to newsletter communications via any channel. In MVP, channel is always 'email'. |
| **Channel** | The delivery mechanism for newsletter content. MVP supports 'email' only. 'whatsapp' is reserved for V2. |
| **Double opt-in** | A two-step subscription flow: user subscribes (status='pending_verification'), then confirms via a link sent to their email (status='active'). Required by Ley 25.326 AR. |
| **Verification token** | An HMAC-SHA256 token included in the verification email link. Single-use; expires after 72 hours. |
| **Unsubscribe token** | A stable HMAC-SHA256 token per subscriber, injected into every campaign email footer. Clicking it unsubscribes without requiring login. |
| **Campaign** | A newsletter edition composed by an admin, containing a subject, rich-text body, and targeting configuration. |
| **Delivery** | One record representing the dispatch of a specific campaign to a specific subscriber via a specific channel. |
| **Dispatch** | The process of enqueuing all deliveries for a campaign via QStash and sending the emails. |
| **Soft-cap** | A per-subscriber rate limit: maximum 1 newsletter delivery per 7-day rolling window (configurable). Enforced at dispatch time; subscribers who received a newsletter within the window are skipped for that campaign. |
| **Bounce** | An email that could not be delivered (hard bounce: invalid address; soft bounce: temporary failure). Brevo notifies via webhook. |
| **Complaint** | A spam report from a recipient. Brevo notifies via webhook. Subscriber moved to 'complained' status. |
| **Open tracking** | A 1x1 transparent pixel injected into each HTML email body per delivery. When loaded, records `opened_at` on the delivery row. |
| **Click tracking** | Campaign links are rewritten to pass through a tracking redirect endpoint that records `first_click_at` before forwarding. |
| **Locale segment** | The audience filter available in MVP: one of 'es', 'en', or 'pt'. Matches `newsletter_subscribers.locale`. |
| **Test send** | Admin-initiated delivery of a draft campaign to the admin's own email address only. Does not change campaign status. |
| **WhatsApp channel CTA** | A static call-to-action link to join the platform's WhatsApp broadcast channel. Not programmatic; no user data is sent to WhatsApp. |
| **Migration** | One-time seeding of existing users with `settings.newsletter=true` into the new `newsletter_subscribers` table with `status='active'`, `source='migration'`. |

---

### 3. Out of Scope

The following items are explicitly excluded from this MVP and must NOT be implemented:

| Excluded Item | Rationale |
|---|---|
| WhatsApp transport (sending messages via Meta Cloud API / Twilio / BSP) | Programmatic WhatsApp requires BSP onboarding and a separate compliance review. Deferred to V2. |
| A/B testing of subject lines or content | Requires split-audience logic and statistical reporting. YAGNI for MVP. |
| Scheduled / future-dated campaign sends | `scheduled_for` column exists in schema for future use; the actual cron path is not wired in MVP. All sends are immediate. |
| Granular segmentation beyond locale | Source, date range, accommodation interest, etc. are not exposed in MVP admin UI. |
| User-facing "manage all email preferences" hub | Only newsletter on/off is surfaced. A unified comms preferences page is a separate spec. |
| Multi-step welcome sequences / drip campaigns | Single transactional welcome email only. |
| Templates library | Campaigns are composed fresh each time. No saved-template system. |
| Admin campaign analytics beyond MVP metrics | Heatmaps, click-map, per-link breakdown, time-of-day analysis. |
| Subscriber CSV import / export | Admin can list and filter; no bulk file operations. |
| Anonymous (guest) subscription | Only authenticated users can subscribe. Double opt-in already exceeds baseline legal requirements. |
| Removing the legacy `settings.newsletter` boolean | Flag is retained for backward compatibility; deprecated endpoint is fixed and marked `@deprecated`. Removal deferred to V2 cleanup. |
| QStash dashboard or monitoring UI inside admin | Delivery status is surfaced from the DB; QStash console is an ops-level tool. |

---

### 4. User Stories & Acceptance Criteria

---

#### US-101-01 -- Logged-in user subscribes from the footer

**As** an authenticated user browsing any page of the website,
**I want** to subscribe to the newsletter from the footer form,
**So that** I receive news and offers about Hospeda directly in my inbox.

**AC-101-01.1 -- Footer form replaces static form with interactive island (authenticated)**

- **Given** I am logged in and the page footer is rendered,
  **When** the footer NewsletterForm island hydrates,
  **Then** I see an email input pre-filled with my account email, a submit button ("Suscribirme"), and the input is not editable (my email is fixed; the form is a one-click subscribe).

- **Given** I am already an active subscriber,
  **When** the footer island hydrates,
  **Then** I see a success state ("Ya estas suscrito") instead of the subscribe form, with a link to manage my subscription in `/mi-cuenta/preferencias/newsletter/`.

**AC-101-01.2 -- Submitting the subscribe form (happy path)**

- **Given** I am logged in, not yet subscribed, and the footer form shows my email,
  **When** I click "Suscribirme",
  **Then**:
  - The button shows a loading spinner and becomes disabled.
  - A POST is sent to `/api/v1/protected/newsletter/subscribe`.
  - A success message appears: "Revisa tu email para confirmar tu suscripcion."
  - The form transitions to a "pending verification" state and the submit button is hidden.

**AC-101-01.3 -- Submitting while already pending verification**

- **Given** I subscribed earlier and have not yet clicked the verification link,
  **When** I submit the footer form again,
  **Then** the API returns a 200 with `status='pending_verification'` and a message: "Ya enviamos un email de confirmacion. Revisa tu bandeja de entrada o spam."

**AC-101-01.4 -- API error handling**

- **Given** I click "Suscribirme" and the API returns a 4xx or 5xx error,
  **When** the response arrives,
  **Then** the button re-enables, an error message appears: "No pudimos procesar tu suscripcion. Intenta de nuevo.", and no toast is shown (inline error is sufficient).

---

#### US-101-02 -- Guest visitor sees auth popover on newsletter form

**As** a guest visitor (not logged in) browsing any page,
**I want** to see a clear prompt when I try to interact with the newsletter subscribe button,
**So that** I understand I need an account and can easily create one.

**AC-101-02.1 -- Footer form renders subscribe-blocked state for guests**

- **Given** I am not logged in and the page footer is rendered,
  **When** the footer NewsletterForm island hydrates,
  **Then** I see an email input (editable, not pre-filled), a submit button ("Suscribirme"), and a small lock icon or badge indicating login is required.

**AC-101-02.2 -- Guest clicks subscribe**

- **Given** I am not logged in and I click "Suscribirme" in the footer,
  **When** the click event fires,
  **Then** an `AuthRequiredPopover` appears anchored to the subscribe button; no HTTP request is sent; no subscription is created.

**AC-101-02.3 -- AuthRequiredPopover content**

- **Given** the AuthRequiredPopover is triggered by the newsletter form,
  **When** the popover is visible,
  **Then** it shows:
  - Title: "Inicia sesion para suscribirte"
  - Message: "Crea una cuenta gratuita y recibe novedades del Litoral en tu email."
  - Primary CTA: "Registrarse" (links to `/{locale}/auth/signup/`)
  - Secondary link: "Ya tengo cuenta" (links to `/{locale}/auth/signin/`)

**AC-101-02.4 -- Popover dismissal**

- **Given** the AuthRequiredPopover is open,
  **When** I press Escape or click outside the popover,
  **Then** the popover closes and focus returns to the subscribe button.

---

#### US-101-03 -- New subscriber receives a verification email

**As** a newly subscribed user,
**I want** to receive a verification email after subscribing,
**So that** my subscription is confirmed and I comply with double opt-in requirements.

**AC-101-03.1 -- Verification email is sent after subscribe**

- **Given** I submitted the subscribe form successfully,
  **When** the server processes the subscription,
  **Then** a verification email is sent to my account email within 60 seconds with:
  - Subject (es): "Confirma tu suscripcion a Hospeda"
  - A greeting using my first name.
  - A clear CTA button: "Confirmar suscripcion" linking to `/api/v1/public/newsletter/verify?token=<HMAC_TOKEN>`.
  - Plain-text alternative with the same link spelled out.
  - Footer text noting that if they did not subscribe, they can safely ignore the email.

**AC-101-03.2 -- Verification token is unique and time-limited**

- **Given** a verification email is sent,
  **Then** the token embedded in the link is HMAC-SHA256 signed, unique per subscriber+channel combination, and expires after 72 hours from the moment of subscription.

**AC-101-03.3 -- Verification email is NOT resent if already active**

- **Given** I am already an active subscriber,
  **When** the subscribe endpoint is called again,
  **Then** no verification email is sent and the response status is 200 with `status='active'`.

---

#### US-101-04 -- User clicks verification link and activates subscription

**As** a newly subscribed user who received the verification email,
**I want** to click the verification link and see my subscription activated,
**So that** I start receiving newsletter campaigns and know about the WhatsApp channel.

**AC-101-04.1 -- Valid token activates subscription**

- **Given** I click the verification link in my email with a valid, unexpired token,
  **When** the server processes the GET request to `/api/v1/public/newsletter/verify`,
  **Then**:
  - The subscriber record is updated: `status='active'`, `verified_at=now()`.
  - I am redirected to `/{locale}/newsletter/confirmado/` (the verification success page).

**AC-101-04.2 -- Verification success page content**

- **Given** I land on `/{locale}/newsletter/confirmado/`,
  **When** the page renders,
  **Then** I see:
  - A success confirmation: "Bienvenido! Tu suscripcion fue confirmada."
  - A brief description of what I will receive.
  - A WhatsApp channel CTA block (see US-101-10 for details).
  - A link: "Ir al sitio" (to `/{locale}/`).

**AC-101-04.3 -- Expired token shows error page**

- **Given** I click a verification link whose token is older than 72 hours,
  **When** the server validates the token,
  **Then** I am redirected to `/{locale}/newsletter/error/?reason=token_expired` and the page explains that the link expired and offers a "Reenviar confirmacion" button (calls `POST /api/v1/protected/newsletter/resend-verification`).

**AC-101-04.4 -- Invalid token shows error page**

- **Given** I click a malformed or tampered verification link,
  **When** the server validates the token,
  **Then** I am redirected to `/{locale}/newsletter/error/?reason=invalid_token` and the page shows a generic error message without exposing internal details.

**AC-101-04.5 -- Already-verified token is idempotent**

- **Given** I click the verification link a second time after having already verified,
  **When** the server processes the request,
  **Then** I am redirected to `/{locale}/newsletter/confirmado/` (same success page) without error. Idempotent.

**AC-101-04.6 -- Verification email resend (from error page)**

- **Given** I am on the token-expired error page and I click "Reenviar confirmacion",
  **When** the request is sent to `/api/v1/protected/newsletter/resend-verification`,
  **Then** a new verification email is sent, the old token is invalidated, and the page shows: "Reenviamos el email de confirmacion. Revisa tu bandeja de entrada."

---

#### US-101-05 -- Subscribed user manages newsletter from account preferences

**As** an authenticated, active newsletter subscriber,
**I want** to manage my newsletter subscription from my account preferences page,
**So that** I can see my subscription status, update preferences, or unsubscribe.

**AC-101-05.1 -- Newsletter preferences page shows subscription status**

- **Given** I am logged in and navigate to `/mi-cuenta/preferencias/newsletter/`,
  **When** the page renders,
  **Then** I see:
  - My subscription status (e.g., "Activo" / "Pendiente de verificacion" / "No suscrito").
  - The date I subscribed (if subscribed).
  - A "Cancelar suscripcion" button if status is 'active' or 'pending_verification'.
  - A "Suscribirme" button if status is 'unsubscribed' or 'not_subscribed'.
  - The WhatsApp channel CTA block (see US-101-10).

**AC-101-05.2 -- Unsubscribe from account preferences**

- **Given** I am an active subscriber and I click "Cancelar suscripcion",
  **When** I confirm in a confirmation dialog "Si, cancelar suscripcion" / "No, quedarme",
  **Then** the subscriber record is updated: `status='unsubscribed'`, `unsubscribed_at=now()`, and the page updates to show the "no suscrito" state with a "Suscribirme" button.

**AC-101-05.3 -- Re-subscribe after unsubscribing**

- **Given** I previously unsubscribed and I click "Suscribirme" on the preferences page,
  **When** the subscribe request is processed,
  **Then** a new verification email is sent and the page shows the pending verification state.

**AC-101-05.4 -- Pending verification state from preferences page**

- **Given** my subscription is in 'pending_verification' status,
  **When** I view the preferences page,
  **Then** I see a banner: "Revisa tu email para confirmar tu suscripcion." and a "Reenviar email de confirmacion" button.

---

#### US-101-06 -- Subscriber unsubscribes with 1-click from email footer

**As** a newsletter subscriber who received a campaign email,
**I want** to unsubscribe with a single click from the email footer,
**So that** I can opt out immediately without logging in.

**AC-101-06.1 -- Every campaign email includes a 1-click unsubscribe link**

- **Given** a campaign email is delivered to my inbox,
  **When** I view the email footer,
  **Then** I see an "Cancelar suscripcion" link containing my stable unsubscribe token.

**AC-101-06.2 -- Clicking unsubscribe link sets status to 'unsubscribed'**

- **Given** I click the unsubscribe link in an email,
  **When** the GET request reaches `/api/v1/public/newsletter/unsubscribe?token=<UNSUBSCRIBE_TOKEN>`,
  **Then**:
  - The subscriber record is updated: `status='unsubscribed'`, `unsubscribed_at=now()`.
  - I am redirected to `/{locale}/newsletter/desuscripto/` (the unsubscribe confirmation page).
  - No login is required at any point.

**AC-101-06.3 -- Unsubscribe confirmation page content**

- **Given** I land on `/{locale}/newsletter/desuscripto/`,
  **When** the page renders,
  **Then** I see:
  - A confirmation message: "Tu suscripcion fue cancelada. Ya no recibiras emails de Hospeda."
  - A link: "Si fue un error, volver a suscribirme" (takes authenticated users to the preferences page; takes guests to the login page).
  - No additional marketing content.

**AC-101-06.4 -- Unsubscribe token is stable and never rotates**

- **Given** a subscriber is active,
  **Then** their unsubscribe token does not change between campaigns. The same token works regardless of when the email was sent.

**AC-101-06.5 -- Already-unsubscribed token is idempotent**

- **Given** I am already unsubscribed and I click the unsubscribe link in an old email,
  **When** the server processes the token,
  **Then** I am redirected to `/{locale}/newsletter/desuscripto/` without error. No duplicate event is recorded.

**AC-101-06.6 -- Invalid unsubscribe token**

- **Given** the unsubscribe URL contains an invalid or malformed token,
  **When** the server validates the token,
  **Then** I see `/{locale}/newsletter/error/?reason=invalid_token` with a message: "El enlace de desuscripcion no es valido. Si deseas cancelar tu suscripcion, inicia sesion y hacelo desde tu cuenta."

---

#### US-101-07 -- Admin lists newsletter subscribers

**As** an admin with newsletter management permissions,
**I want** to view the list of newsletter subscribers with filters,
**So that** I can audit the subscriber base and identify issues.

**AC-101-07.1 -- Subscribers list page loads with paginated table**

- **Given** I am an admin and navigate to `/admin/newsletter/subscribers/`,
  **When** the page renders,
  **Then** I see a table of subscribers with columns: email, status, locale, source, subscribed date, verified date (nullable).

**AC-101-07.2 -- Filter by status**

- **Given** the subscribers list is loaded,
  **When** I select a status filter (pending_verification / active / unsubscribed / bounced / complained),
  **Then** the table reloads showing only subscribers with that status.

**AC-101-07.3 -- Filter by locale**

- **Given** the subscribers list is loaded,
  **When** I select a locale filter (es / en / pt),
  **Then** the table reloads showing only subscribers with that locale.

**AC-101-07.4 -- Filter by source**

- **Given** the subscribers list is loaded,
  **When** I select a source filter (web_footer / account_preferences / migration),
  **Then** the table reloads showing only subscribers acquired from that source.

**AC-101-07.5 -- Summary stats banner**

- **Given** the subscribers list page loads,
  **When** the page renders,
  **Then** a summary banner at the top shows: total active, total pending, total unsubscribed, total bounced.

**AC-101-07.6 -- No delete / edit subscriber from this view**

- **Given** I am viewing the subscribers list,
  **Then** there are no individual delete or edit controls. Subscriber data is managed through the subscription flow itself (no admin overrides in MVP).

---

#### US-101-08 -- Admin composes a newsletter campaign

**As** an admin with newsletter management permissions,
**I want** to compose a new newsletter campaign using a rich text editor,
**So that** I can create formatted content for our subscribers.

**AC-101-08.1 -- New campaign form**

- **Given** I navigate to `/admin/newsletter/campaigns/new/`,
  **When** the page renders,
  **Then** I see:
  - A "Title" field (internal label, not shown to subscribers; required, max 120 chars).
  - A "Subject" field (shown as the email subject line; required, max 120 chars).
  - A TipTap rich text editor for the body (supports: headings H2/H3, bold, italic, underline, blockquote, ordered/unordered lists, links, horizontal rule).
  - A live HTML preview pane (renders the TipTap JSON as HTML using the same renderer used by web).
  - A "Locale / Audience" dropdown: All / Spanish / English / Portuguese.
  - A "Save as draft" button and a "Send test email" button. No "Send now" button yet.

**AC-101-08.2 -- Save draft**

- **Given** I fill in the title, subject, and body,
  **When** I click "Guardar borrador",
  **Then** the campaign is saved via `POST /api/v1/admin/newsletter/campaigns` with `status='draft'`, and I am redirected to the campaign detail/edit page at `/admin/newsletter/campaigns/[id]/`.

**AC-101-08.3 -- Edit existing draft**

- **Given** I am on the campaign detail page for a draft campaign,
  **When** I update the subject or body and click "Guardar",
  **Then** the campaign is updated via `PATCH /api/v1/admin/newsletter/campaigns/[id]` and a success toast appears: "Borrador guardado."

**AC-101-08.4 -- Validation**

- **Given** I attempt to save a campaign with an empty subject or empty body,
  **When** I click "Guardar borrador",
  **Then** inline validation errors appear next to the empty fields; no API call is made.

**AC-101-08.5 -- Preview pane updates in real-time**

- **Given** I am editing the campaign body in TipTap,
  **When** I type or format content,
  **Then** the preview pane reflects the rendered HTML output within 300ms (debounced).

**AC-101-08.6 -- Cannot edit a sent campaign**

- **Given** a campaign has `status='sent'` or `status='sending'`,
  **When** I navigate to its edit page,
  **Then** all fields are read-only and an info banner shows: "Esta campana ya fue enviada y no puede editarse."

---

#### US-101-09 -- Admin sends a test email before going live

**As** an admin composing a campaign,
**I want** to send a test email to my own address,
**So that** I can verify the layout, subject, and content before dispatching to all subscribers.

**AC-101-09.1 -- Test send from campaign edit page**

- **Given** I am on the campaign edit page and the campaign has a title, subject, and body,
  **When** I click "Enviar email de prueba",
  **Then**:
  - A confirmation tooltip or small inline dialog appears: "Se enviara a [admin@email.com]. Confirmar?"
  - After confirming, a POST is sent to `/api/v1/admin/newsletter/campaigns/[id]/test-send`.
  - A success toast appears: "Email de prueba enviado a [admin@email.com]."
  - Campaign status remains 'draft'.

**AC-101-09.2 -- Test email content**

- **Given** the test email is delivered,
  **When** I open it,
  **Then**:
  - The subject line is prefixed with "[PRUEBA] " (e.g., "[PRUEBA] Novedades de Mayo").
  - The body renders identically to the preview pane.
  - A banner at the top of the email body reads: "Este es un email de prueba. No fue enviado a suscriptores reales."
  - Open/click tracking pixels and link rewrites are NOT applied to test emails.
  - The unsubscribe link in the footer is present but leads to a no-op endpoint.

**AC-101-09.3 -- Test send fails gracefully**

- **Given** the test email delivery fails (e.g., Brevo returns an error),
  **When** the error response arrives,
  **Then** an error toast appears: "No pudimos enviar el email de prueba. Intenta de nuevo." No changes are made to the campaign.

---

#### US-101-10 -- Admin sends a campaign to subscribers

**As** an admin with newsletter management permissions,
**I want** to dispatch a campaign to the filtered subscriber audience,
**So that** active subscribers in the target locale receive the newsletter.

**AC-101-10.1 -- Send campaign button on detail page**

- **Given** I am on the campaign detail page for a 'draft' campaign,
  **When** I click "Enviar campana",
  **Then** a confirmation dialog appears showing:
  - Campaign title and subject.
  - Target audience description: "X suscriptores activos en [locale]" (or "todos los idiomas" if locale is All).
  - Soft-cap notice: "Los suscriptores que recibieron un email en los ultimos 7 dias seran omitidos."
  - Two buttons: "Confirmar envio" and "Cancelar".

**AC-101-10.2 -- Confirm dispatch**

- **Given** I confirm the send dialog,
  **When** the POST reaches `/api/v1/admin/newsletter/campaigns/[id]/send`,
  **Then**:
  - The server computes the eligible subscriber list (active status + matching locale + not soft-capped).
  - One `newsletter_campaign_deliveries` row is created per eligible subscriber (idempotent by unique constraint).
  - All deliveries are enqueued in QStash for async processing.
  - Campaign `status` transitions to 'sending', `sent_at` is set to now(), `total_recipients` is set to the count enqueued.
  - The page refreshes and shows the campaign in "sending" state with a progress indicator.

**AC-101-10.3 -- Zero eligible subscribers**

- **Given** the target audience returns zero eligible subscribers (all are soft-capped, unsubscribed, or bounced),
  **When** I confirm the send dialog,
  **Then** an informational toast appears: "No hay suscriptores elegibles para esta campana. Intenta de nuevo mas tarde o amplia el filtro de idioma." Campaign status remains 'draft'.

**AC-101-10.4 -- Soft-cap enforcement**

- **Given** subscriber Alice received a newsletter 3 days ago and subscriber Bob received one 10 days ago,
  **When** a new campaign is dispatched,
  **Then** Alice is excluded from the delivery batch; Bob is included.

**AC-101-10.5 -- QStash retry on delivery failure**

- **Given** a delivery is enqueued and the Brevo API call fails transiently,
  **When** QStash retries (up to 3 times),
  **Then** each retry attempt increments `retry_count` on the delivery row; if all retries fail, `status='failed'` and `error_message` is set.

**AC-101-10.6 -- Idempotency on duplicate enqueue**

- **Given** a campaign send is triggered twice (e.g., double-click or network retry),
  **When** the second enqueue attempt runs,
  **Then** the unique constraint on `(campaign_id, subscriber_id, channel)` prevents duplicate delivery rows; no subscriber receives the campaign twice.

---

#### US-101-11 -- Admin views campaign delivery metrics

**As** an admin,
**I want** to see delivery progress and metrics for a sent campaign,
**So that** I can assess campaign performance and identify delivery issues.

**AC-101-11.1 -- Campaign detail shows delivery summary**

- **Given** a campaign is in 'sending' or 'sent' status,
  **When** I view the campaign detail page,
  **Then** I see a metrics panel with:
  - Total recipients (enqueued count).
  - Delivered (count with `status='delivered'`).
  - Failed (count with `status='failed'`).
  - Open rate: unique opens / delivered * 100 (shown as percentage).
  - Click rate: unique clicks / delivered * 100 (shown as percentage).

**AC-101-11.2 -- Metrics auto-refresh during send**

- **Given** the campaign is in 'sending' status,
  **When** the detail page is open,
  **Then** the metrics panel polls the metrics endpoint every 10 seconds and updates the counters without a full page reload.

**AC-101-11.3 -- Campaign transitions to 'sent' when all deliveries are resolved**

- **Given** all delivery rows for a campaign have `status` in ('delivered', 'failed', 'skipped'),
  **When** the `close-campaign` background job runs (or the next poll after the last delivery settles),
  **Then** the campaign `status` transitions from 'sending' to 'sent'.

**AC-101-11.4 -- Individual delivery errors are visible**

- **Given** a campaign has failed deliveries,
  **When** I click "Ver errores" on the metrics panel,
  **Then** a dialog/sheet shows a list of failed deliveries with: email (masked: `a***@domain.com`), error_message, retry_count.

---

#### US-101-12 -- Admin cancels an in-progress campaign

**As** an admin,
**I want** to cancel a campaign that is currently sending,
**So that** I can stop a mistaken or problematic send before all emails go out.

**AC-101-12.1 -- Cancel button visible during 'sending' status**

- **Given** a campaign has `status='sending'`,
  **When** I view the campaign detail page,
  **Then** I see a "Cancelar envio" button alongside the metrics panel.

**AC-101-12.2 -- Cancel transitions campaign to 'cancelled'**

- **Given** I click "Cancelar envio" and confirm the action,
  **When** the POST reaches `/api/v1/admin/newsletter/campaigns/[id]/cancel`,
  **Then**:
  - The campaign `status` transitions to 'cancelled'.
  - All queued deliveries that have not yet been attempted are marked `status='skipped'`.
  - Deliveries already in-flight (being processed by QStash workers at that moment) may still be sent; this is an accepted edge case.
  - The page updates to show the cancelled state.

**AC-101-12.3 -- Cannot cancel a 'sent' or 'draft' campaign**

- **Given** a campaign has `status='sent'` or `status='draft'`,
  **When** I attempt to POST to the cancel endpoint,
  **Then** the API returns 409 with `error='campaign_not_cancellable'` and an appropriate message.

---

#### US-101-13 -- WhatsApp channel CTA is surfaced at key moments

**As** a user who has verified their newsletter subscription (or is managing it),
**I want** to see a clear invitation to join the Hospeda WhatsApp channel,
**So that** I can receive time-sensitive updates and offers on the channel I prefer.

**AC-101-13.1 -- WhatsApp CTA block on verification success page**

- **Given** I land on `/{locale}/newsletter/confirmado/` after verifying my email,
  **When** the page renders,
  **Then** I see a secondary section below the confirmation message with:
  - Icon: WhatsApp logo.
  - Headline: "Sumate al canal de WhatsApp de Hospeda"
  - Body: "Recibe ofertas exclusivas y novedades del Litoral en tu WhatsApp."
  - A CTA button: "Unirse al canal" (opens `PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL` in a new tab).
  - Clicking the button fires a client-side analytics event: `newsletter_wa_channel_clicked` with property `{ source: 'verification_success' }`.

**AC-101-13.2 -- WhatsApp CTA block on account preferences page**

- **Given** I navigate to `/mi-cuenta/preferencias/newsletter/`,
  **When** the page renders (regardless of newsletter subscription status),
  **Then** the same WhatsApp CTA block is shown below the newsletter subscription controls, with `{ source: 'account_preferences' }` in the analytics event.

**AC-101-13.3 -- WhatsApp CTA block in welcome email (optional)**

- **Given** a verification email is sent,
  **When** I open the welcome email after verifying,
  **Then** the welcome email body (not the verification email) optionally includes a text link: "Tambien podes seguirnos en WhatsApp: [link]" in the footer section. This is informational only, not a primary CTA.

**AC-101-13.4 -- WhatsApp CTA not shown when env var is unset**

- **Given** the `PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL` env var is empty or not set,
  **When** any page with the WhatsApp CTA block renders,
  **Then** the CTA block is not rendered (hidden entirely). No broken link or empty button.

---

#### US-101-14 -- Legacy newsletter flag is fixed and migrated

**As** a returning user who previously opted in via the account settings toggle,
**I want** my existing newsletter preference to be honored in the new system,
**So that** I do not have to re-subscribe after the migration.

**AC-101-14.1 -- Buggy endpoint is fixed**

- **Given** the legacy endpoint `PATCH /api/v1/protected/user/newsletter` exists and previously wrote to `settings.notifications.allowEmails` (wrong field),
  **When** the fix is deployed,
  **Then** the endpoint correctly writes to `settings.newsletter` (the intended field) and is marked `@deprecated` with a JSDoc note indicating V2 removal.

**AC-101-14.2 -- Migration seeds existing opt-in users**

- **Given** the one-time migration SQL runs on `packages/db/src/migrations/manual/`,
  **When** the migration completes,
  **Then** all users with `settings.newsletter=true` at migration time are inserted into `newsletter_subscribers` with: `channel='email'`, `status='active'`, `source='migration'`, `locale` derived from their account locale (defaulting to 'es'), `email` from their user record.

**AC-101-14.3 -- Migration is idempotent**

- **Given** the migration is run more than once (e.g., in a dev reset cycle),
  **When** the INSERT executes,
  **Then** the `UNIQUE (user_id, channel)` constraint causes an `ON CONFLICT DO NOTHING` and no duplicates are created.

---

### 5. UX Considerations

#### 5.1 Footer Form (NewsletterForm island)

The footer form has four distinct visual states:

| State | Description | Visual |
|---|---|---|
| **idle-guest** | Visitor not logged in. Email input editable, empty. Subscribe button enabled. Lock icon badge visible. | Standard form. |
| **idle-auth** | Authenticated, not subscribed. Email input read-only, pre-filled with account email. Subscribe button enabled. | Pre-filled, clean. |
| **pending** | Subscribe button clicked, request in flight. | Button shows spinner, disabled. Input disabled. |
| **pending-verification** | Subscribe submitted successfully. Verification email sent. | Form replaced by success message with icon. |
| **already-active** | User is already an active subscriber. | "Ya estas suscrito" banner with link to preferences. |
| **error** | API call failed. | Inline error message below form. Button re-enabled. |

Island hydration strategy: `client:visible` (lazy hydration on scroll). The island must fetch subscription status from `/api/v1/protected/newsletter/status` on mount (authenticated only) to determine whether to show the subscribe form or the already-active state.

#### 5.2 Verification Page (`/{locale}/newsletter/confirmado/`)

- Layout: centered, single-column, max-width 600px.
- Primary block: large checkmark icon (green), headline, brief description.
- Secondary block: WhatsApp channel CTA card (see US-101-13). Shown only when `PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL` is set.
- Footer link: "Ir al inicio" and "Gestionar preferencias" (for authenticated users).
- No header navigation complexity -- use BaseLayout with minimal chrome (same pattern as auth pages).
- Page must be SSR (not prerendered) because locale affects the redirect target.

#### 5.3 Verification Error Page (`/{locale}/newsletter/error/`)

- Receives `?reason=token_expired` or `?reason=invalid_token` query param.
- Renders a friendly error message specific to each reason.
- For `token_expired`: shows a "Reenviar email de confirmacion" button (only if user is authenticated; if not, links to login first).
- For `invalid_token`: shows a generic message without the resend button.
- No tech jargon; error messages are in plain language.

#### 5.4 Unsubscribe Confirmation Page (`/{locale}/newsletter/desuscripto/`)

- Minimal layout: centered card.
- Confirmation message.
- Re-subscribe link that accounts for auth state:
  - If the user is authenticated: links directly to `/mi-cuenta/preferencias/newsletter/`.
  - If the user is a guest (followed link from email without logging in): links to `/{locale}/auth/signin/?redirect=/mi-cuenta/preferencias/newsletter/`.
- No additional marketing or upsell. The user explicitly opted out; respect that intent.

#### 5.5 Account Preferences Page (`/{locale}/mi-cuenta/preferencias/newsletter/`)

- Access: authenticated only (enforced by middleware like all `/mi-cuenta/*` routes).
- Status badge: color-coded by status (active=green, pending=yellow, unsubscribed=grey, bounced=red).
- "Cancelar suscripcion" action: must show an inline confirmation dialog before posting, to prevent accidental unsubscribes.
- WhatsApp CTA: rendered as a card below the newsletter controls, visually distinct (use `--surface-warm` background to separate it).
- The page is NOT prerendered (SSR); fetches subscription status from the protected API on load.

#### 5.6 Admin Campaign Editor

- Two-column layout on desktop: editor (left, 60%) + preview (right, 40%).
- Single-column stacked on mobile (editor first, preview collapsible/tabbed).
- TipTap toolbar: minimal set (Bold, Italic, Underline, H2, H3, Bullet list, Ordered list, Blockquote, Link, Divider, Clear formatting).
- Preview pane renders via the same `tiptap-renderer.ts` logic used on the web app to guarantee WYSIWYG fidelity.
- Subject preview: above the preview pane, the email subject line is shown as it will appear in an inbox.
- Autosave: debounced 3-second autosave of draft changes to prevent data loss.
- Character counters: visible on title (120 max) and subject (120 max) fields.

#### 5.7 Admin Send Confirmation Dialog

- Modal dialog (not a full-page transition).
- Shows: campaign title, subject, target audience count, soft-cap notice.
- Primary action: "Confirmar envio" (destructive intent -- use a distinct accent color to indicate irreversibility).
- Escape / "Cancelar" closes without sending.
- After confirming, the button shows a loading state; the modal closes automatically when the API responds.

#### 5.8 Empty States

| Surface | Empty State |
|---|---|
| Subscribers list (no subscribers match filter) | "No hay suscriptores con los filtros seleccionados." with a clear filters button. |
| Campaigns list (no campaigns yet) | "Todavia no creaste ninguna campana." with a "Crear campana" CTA. |
| Campaign deliveries (no deliveries on a draft) | Not shown (deliveries only exist for sent campaigns). |
| Failed deliveries list | "No hay entregas fallidas en esta campana." |

#### 5.9 Loading States

- Subscribers list: skeleton table rows (Shadcn Skeleton) while data loads.
- Campaign editor: skeleton for TipTap on initial load (TipTap lazy-loads the editor JS bundle).
- Metrics panel: numeric placeholders (dashes) while the metrics fetch is in flight.

#### 5.10 Accessibility

- The footer NewsletterForm island must be keyboard-navigable (Tab to input, Tab to button, Enter to submit).
- The subscribe button has an `aria-live="polite"` region adjacent to it for status messages (success, error, loading).
- All admin modals use a focus trap and restore focus on close.
- The TipTap editor must be operable via keyboard (TipTap's built-in keyboard shortcuts apply).
- Status badges must not rely on color alone; include a text label alongside the color indicator.
- The verification and unsubscribe pages must render correctly without JavaScript (server-rendered).

---

### 6. Non-Functional Requirements

#### 6.1 Performance

- **Dispatch throughput**: 10,000 deliveries enqueued to QStash in under 30 seconds from the moment the admin confirms send.
- **Email delivery rate**: above 95% of active, non-bounced subscribers successfully delivered per campaign (post soft-cap and bounce filtering).
- **Verification email latency**: verification email dispatched within 60 seconds of subscription.
- **Admin UI response times**: campaign list and subscriber list queries return in under 1 second at up to 50,000 subscriber rows (requires indexed queries on `status`, `locale`, `channel`).

#### 6.2 Rate Limiting

- `POST /api/v1/protected/newsletter/subscribe`: 5 requests per minute per authenticated user (prevents accidental spam of verification emails).
- `GET /api/v1/public/newsletter/verify`: 10 requests per minute per IP (prevents token-scanning attacks).
- `GET /api/v1/public/newsletter/unsubscribe`: 20 requests per minute per IP (stable tokens are less sensitive, higher limit acceptable).
- `POST /api/v1/admin/newsletter/campaigns/[id]/send`: 1 request per minute per admin (debounce against double-click).

#### 6.3 Legal Compliance (Ley 25.326 AR / GDPR principles)

- **Double opt-in**: all email subscriptions require email verification before the subscriber receives any campaign. No single opt-in path.
- **Consent record**: every subscriber row stores `consent_ip` and `consent_ua` captured at subscription time, plus `created_at` timestamp. This constitutes the consent audit trail.
- **1-click unsubscribe**: every campaign email must include a working 1-click unsubscribe link (RFC 8058 compliant List-Unsubscribe header also included in the Brevo send payload).
- **Unsubscribe honored immediately**: a subscriber whose status becomes 'unsubscribed' is excluded from all subsequent dispatches, including any in-flight QStash jobs for campaigns started before the unsubscribe (QStash workers check status at delivery time, not at enqueue time).
- **No third-party data sharing**: subscriber email addresses are passed to Brevo only for delivery; no subscriber list is shared with other third parties.
- **Data retention**: subscriber records are soft-deleted (status transitions) not hard-deleted, to preserve the consent audit trail. Hard deletion is possible via admin action only (out of scope for MVP but the schema supports it).

#### 6.4 Testing Coverage Targets

- `newsletter.service.ts` and related service-core code: 90% line coverage.
- API routes (`/newsletter/*`): 80% line coverage via integration tests.
- Web components (NewsletterForm island, verification pages): 80% line coverage.
- Admin components (campaign editor, subscribers list): 80% line coverage.
- E2E coverage: full happy-path flows for subscribe, verify, unsubscribe, and admin send.

#### 6.5 Internationalization

- All user-facing strings must go through `@repo/i18n` (`t()` function).
- Primary locale: `es`. English (`en`) and Portuguese (`pt`) strings fall back to `es` until translated.
- New i18n keys must be added to all three locale files (`packages/i18n/src/locales/es/`, `en/`, `pt/`) in the same commit that introduces the UI.
- Email templates (verification, welcome, campaign) are rendered server-side; the locale used is the subscriber's `locale` column (set at subscription time from `Astro.locals.locale`).

#### 6.6 Security

- HMAC-SHA256 tokens use a server-side secret from `HOSPEDA_NEWSLETTER_HMAC_SECRET` env var (minimum 32 bytes, required).
- Unsubscribe and verify endpoints are public but token-gated -- no session required, no user enumeration possible through error messages.
- Admin newsletter endpoints require `NEWSLETTER_MANAGE` permission (new permission added to `PermissionEnum`). No role-checking directly.
- Bounce/complaint webhook from Brevo must be authenticated via a shared webhook secret (`HOSPEDA_BREVO_WEBHOOK_SECRET`).
- Open tracking pixel endpoint and click tracking redirect are public endpoints but are rate-limited per IP to prevent artificial inflation.
- HTML campaign body must be sanitized before rendering in email (prevent script injection).

---

### 7. Scope Definition

#### 7.1 In Scope (MVP)

1. Fix the buggy `PATCH /api/v1/protected/user/newsletter` endpoint.
2. One-time migration SQL for existing opt-in users.
3. Three new DB tables: `newsletter_subscribers`, `newsletter_campaigns`, `newsletter_campaign_deliveries`.
4. Zod schemas in `@repo/schemas` for all three tables.
5. Three service-core services: `NewsletterSubscriberService`, `NewsletterCampaignService`, `NewsletterDeliveryService`.
6. New `NEWSLETTER_MANAGE` permission in `PermissionEnum`.
7. New `NotificationCategory.NEWSLETTER` in `@repo/notifications`.
8. Public API endpoints: verify, unsubscribe, open-tracking pixel, click-tracking redirect.
9. Protected API endpoints: subscribe, unsubscribe, status, resend-verification.
10. Admin API endpoints: subscribers list, campaign CRUD, test-send, send, cancel, metrics.
11. Footer `NewsletterForm.client.tsx` React island (replaces inert static form).
12. Web pages: verification success, verification error, unsubscribe confirmation.
13. Account preferences newsletter page at `/mi-cuenta/preferencias/newsletter/`.
14. Admin pages: subscribers list, campaigns list, campaign create/edit/detail.
15. TipTap integration in admin for campaign composition.
16. QStash integration for async dispatch.
17. Brevo bounce/complaint webhook handler.
18. Open and click tracking infrastructure.
19. WhatsApp channel CTA block (static link, env-gated).
20. Double opt-in verification flow with HMAC tokens.
21. Soft-cap anti-fatigue enforcement (1 newsletter per subscriber per 7 days).
22. New env vars: `HOSPEDA_NEWSLETTER_HMAC_SECRET`, `HOSPEDA_BREVO_WEBHOOK_SECRET`, `HOSPEDA_NEWSLETTER_SOFT_CAP_DAYS` (default 7), `PUBLIC_HOSPEDA_WHATSAPP_CHANNEL_URL`.
23. i18n strings for all user-facing text (es primary; en/pt files updated with same strings as fallback).
24. Unit tests (90% service-core, 80% routes/UI).
25. E2E tests for critical flows.

#### 7.2 Out of Scope (V2 and beyond)

1. WhatsApp transport (programmatic sends via Meta Cloud API / Twilio / any BSP).
2. A/B testing.
3. Scheduled/future-dated campaign sends (column exists, UI and cron deferred).
4. Segmentation beyond locale.
5. Unified email preferences hub.
6. Drip campaigns / welcome sequences.
7. Template library.
8. Admin campaign analytics beyond MVP metrics (heatmaps, per-link breakdown).
9. Subscriber CSV import / export.
10. Anonymous subscription flow.
11. Hard deletion of subscriber records.
12. Removal of legacy `settings.newsletter` boolean and deprecated endpoint.

---

### 8. Implementation Phases (Overview)

The following phase outline is informational for context. The tech-analyzer and task-planner agents will atomize these into concrete tasks.

| Phase | Focus | Approximate Scope |
|---|---|---|
| **Phase 0** | Cleanup: fix buggy endpoint, run migration SQL | ~2 tasks |
| **Phase 1** | Foundation: DB schemas, Drizzle models, Zod schemas, 3 services, permissions, notifications category, tests | ~12 tasks |
| **Phase 2** | Subscription flow: public/protected API, Footer island, AuthRequiredPopover wiring, verify/unsubscribe pages, welcome email, i18n, account preferences page, WhatsApp CTA | ~16 tasks |
| **Phase 3** | Admin UI: TipTap install, RichTextEditor component, admin routes (campaigns CRUD, subscribers list), admin API, TanStack Query hooks, permission guards | ~15 tasks |
| **Phase 4** | Dispatch engine: NEWSLETTER notification category, bulk send helper, dispatch endpoint, QStash integration, retry logic, bounce webhook, open/click tracking, cron-close-campaign | ~10 tasks |
| **Phase 5** | Polish: E2E tests, ADR, docs guide, CLAUDE.md updates, VPS smoke tests | ~5 tasks |

---

### 9. Open Questions & Assumptions

The following items required assumptions during spec authoring. They should be validated before Phase 1 begins:

| Item | Assumption Made | Should Validate |
|---|---|---|
| QStash version and integration pattern | Assumed QStash v2 HTTP push via `@upstash/qstash` SDK, consistent with existing platform patterns. | Confirm QStash is already installed or approved as a new dependency. |
| TipTap license | Assumed TipTap open-source (MIT) editor only. No Pro extensions. | Confirm Pro features are not needed (collaboration, AI assist, etc.). |
| Brevo webhook authentication | Assumed shared secret header (`X-Brevo-Webhook-Secret`). | Verify Brevo's actual webhook authentication mechanism. |
| Welcome email vs. verification email | Assumed one email flow: verification email only. A separate "welcome" email fires after verification is confirmed (not at subscribe time). | Confirm whether a separate welcome email is desired or the verification email doubles as welcome. |
| Subscriber locale | Assumed subscriber locale is captured from `Astro.locals.locale` at subscription time and stored in `newsletter_subscribers.locale`. | Confirm this is the correct source; alternative is user's account locale from `users.settings.locale`. |
| Open tracking GDPR implications | Assumed open tracking pixel is acceptable within the consent granted at subscription time (subscriber opted in to newsletter). | Validate with legal/product that the consent scope covers tracking. |
| Admin permission name | Assumed `NEWSLETTER_MANAGE` as the new permission. | Confirm naming convention aligns with existing `PermissionEnum` values in the codebase. |
| Soft-cap configurable unit | Assumed rolling 7-day window (configurable via `HOSPEDA_NEWSLETTER_SOFT_CAP_DAYS`). | Confirm rolling window vs. calendar week is the right model. |
