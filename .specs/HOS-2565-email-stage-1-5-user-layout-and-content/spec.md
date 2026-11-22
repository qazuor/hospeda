---
title: "Emails stage 1.5: catalog audience, shared callout and button, content fixes and a user layout variant"
linear: HOS-2565
statusSource: linear
created: 2026-11-22
type: feature
smoke:
  - staging
smokeLabels:
  - status-needs-smoke-staging
areas:
  - admin
  - api
  - web
  - content
---

# Emails stage 1.5: catalog audience, shared callout and button, content fixes and a user layout variant

## 1. Summary

HOS-2519 shipped one `EmailLayout`, the central catalog and the admin previewer. Reviewing all ~125 emails in that previewer, the owner found 10 problems (owner feedback, 2026-11-22). This spec fixes them in four PRs, in this order. The order and the split are owner-approved.

1. **PR-1, audience.** Each catalog entry declares who reads it (`audience: 'user' | 'staff'`). The admin API exposes the field, and the previewer can filter users vs staff. The stale "SUPER_ADMIN" docblock of the AI cost alert is fixed.
2. **PR-2, shared callout and button.** One `Callout` (info, success, warning, danger; always a visible tinted background plus a 4px left border) and one `Button` (full width on mobile, content width on desktop). About 50 inline callout copies, the auth templates and the `admin-lead-received` outlier migrate to them. A static guard keeps new templates from going back.
3. **PR-3, content.** No English text and no raw codes in a Spanish render. Plain-text URLs become buttons or links. The reconciliation summary gets one block per item. The four unclear staff mails get labeled rows and admin deep links. Every user mail that asks for an action gets a CTA button.
4. **PR-4, user layout variant.** `EmailLayout` gains `variant: 'user' | 'staff'`. User mails get a wave header (hosted PNG), more spacing and color, and a richer footer with social icons and a "Gestioná tus avisos" link. Staff mails stay visually unchanged. **The owner approves a design draft before PR-4 is implemented** (§8.6).

### 1.1 Out of scope (non-goals)

| Item | Why |
|---|---|
| The receipt PDF | HOS-2566 |
| Editing templates from the admin, or storing them in the DB | Stage 2 (HOS-2519 §1.1) |
| The newsletter dispatcher bug (verify and welcome never sent) | HOS-2535 |
| A one-click unsubscribe, or a `List-Unsubscribe` header, on transactional mails | Rejected on purpose (D13) |
| A `List-Unsubscribe` header on the newsletter | Not requested. The newsletter keeps its in-body HMAC unsubscribe unchanged. Possible follow-up |
| Making `/es/mi-cuenta/preferencias/` control more email categories | The link is added (PR-4). Wiring the page to `PreferenceService` is a separate feature (§2.6, OQ-1) |
| Colored "pill" badges from the owner's second reference | No template needs them today (YAGNI). The reference only guides spacing and color |
| Changing who receives a mail, when, or through which send path | Presentation and copy only |
| Rewriting owner-approved copy beyond the listed fixes | Only the strings listed in §7 change. Every changed string is listed for sign-off in the PR |

## 2. Current baseline (verified on `origin/staging` `445621f046`, 2026-11-22)

### 2.1 The catalog does not know who reads a mail

- `EmailCatalogEntry` (`packages/notifications/src/catalog/types.ts`) has `key`, `id`, `sendPath`, `name`, `domain`, `wired`, `scenarios` and `renderScenario`. There is no audience. `domain: 'admin'` does not work as a proxy: the feedback and contact mails live in `contact-feedback`, the AI cost alert in `ai`, and six staff mails in `billing`/`listing`.
- The catalog holds **125 entries**: 49 `notification.*` (`entries/notification-*.ts`), 64 `outbox.*` (`entries/outbox-*.ts`), and 12 others (2 auth, 6 conversation, 1 alert-digest, 3 newsletter).
- **13 entries are read by staff.** The rest (112) are read by users.

| # | Catalog key | Who receives it (evidence) |
|---|---|---|
| 1 | `notification.admin_payment_failure` | admin notification list |
| 2 | `notification.admin_system_event` | admin notification list |
| 3 | `notification.admin_lead_received` | admin notification list |
| 4 | `notification.feedback_report` | support inbox |
| 5 | `notification.contact_submission` | support inbox |
| 6 | `notification.ai_cost_threshold_alert` | `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` (`apps/api/src/services/ai-cost-alert.service.ts:119-139`) |
| 7 | `outbox.billing.reconciliation-summary` | SUPER_ADMIN recipients |
| 8 | `outbox.billing.duplicate-charge-detected` | SUPER_ADMIN recipients |
| 9 | `outbox.billing.mark-escalated` | SUPER_ADMIN recipients |
| 10 | `outbox.billing.revocation-refund-failed` | SUPER_ADMIN recipients |
| 11 | `outbox.billing.manual-installment-unpaid` | SUPER_ADMIN recipients |
| 12 | `outbox.billing.provider-watch-alert` | one per SUPER_ADMIN (`apps/api/src/utils/provider-watch/provider-watch-alert-outbox.ts:54`) |
| 13 | `outbox.verticals.listing-fix-reported` | `listSuperAdminRecipients` (`apps/api/src/services/listing-notices/fix-reported-notice.ts:55`) |

`notification.ai_questions_weekly_digest` is in `notification-admin.ts` but goes to listing owners (`apps/api/src/cron/jobs/ai-questions-weekly-digest.job.ts`), so it is a user mail.

The docblock of `packages/notifications/src/templates/admin/ai-cost-threshold-alert.tsx:9` says "Rendered once per SUPER_ADMIN recipient". The service sends it to each address in `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` with `recipientName: 'Admin'` (`ai-cost-alert.service.ts:120-139`).

The previewer filter is client-side: `apps/admin/src/routes/_authed/platform/emails/-components/email-catalog-filter.ts` (`filterEmailCatalog`: search plus domains). The list response maps entries in `apps/api/src/services/email-preview/email-preview.service.ts:93-94`. The schema is `packages/schemas/src/api/email-preview/email-preview.schema.ts`. The page copy is `emailPreviews.*` in `packages/i18n/src/locales/{es,en,pt}/admin-pages.json`.

### 2.2 Callouts and buttons

- **No shared callout.** `rg -c borderLeft` over `packages/notifications/src/templates` and `packages/email/src/templates` finds **50 `borderLeft` styles in 42 files**. Most are callouts. A few are list cards (`alerts/PriceDropItem.tsx`, `alerts/PromoOfferItem.tsx`). Many callouts are nearly invisible: `#f8fafc` background with a colored border (alliance, host-trade, subscription, conversation, `trial/trial-series-shared.ts:109-115` `calmBox`). `billing/purchase-confirmation.tsx` and `billing/payment-success.tsx` use `#f8fafc` boxes with no border at all. Others use visible tints (`#f0fdf4`, `#fffbeb`, `#fef2f2`, `#eff6ff`, `#fefce8`, `#fff7ed`, `#fff1f2`). The auth templates use their own palette (`packages/email/src/templates/verify-email.tsx`, `reset-password.tsx`).
- **The reference callout** is `expiryBox` in `packages/notifications/src/templates/conversation/conversation-verify.tsx:86-92`: background `#f0f9ff`, `borderLeft: 4px solid #0ea5e9`, radius 8px, padding `16px 20px`, margin `24px 0`, text `#0369a1`.
- **Buttons.** `packages/notifications/src/templates/components/button.tsx` (primary `#3b82f6`, `display: inline-block`, radius 6px, padding `12px 24px`; secondary outlined). About 65 `<Button` usages. Three templates import the raw react-email `Button` instead: `verify-email.tsx:1` and `reset-password.tsx:1` (full width, `#3182ce`) and `admin/admin-lead-received.tsx:1` (`#0f766e`, styles at `:154-163`).
- **Package direction.** `@repo/notifications` depends on `@repo/email`, never the reverse (`packages/email/CLAUDE.md`). A component the auth templates must use therefore has to live in `@repo/email`.
- `emailPalette` (`packages/design-tokens/src/tokens/email-palette.ts`) has 8 roles. A colocated test recomputes each one from its source token. `colors.ts:187-207` already defines semantic palettes `success`, `warning`, `danger` and `info`.

### 2.3 English text and raw codes in Spanish renders

| Where | What |
|---|---|
| `billing/purchase-confirmation.tsx:62-66` | prints `billingPeriod` verbatim ("monthly", "annual"). Mappings already exist in `plan-price-change-notice.tsx:58` and `reconciliation-summary.tsx:84-89` (`CYCLE_LABELS`) |
| `subscription/subscription-access-ending-soon.tsx` | the whole template is English, and so is its subject (`utils/subject-builder.ts:74-75`) |
| `subscription/subscription-cancel-confirmed.tsx` | the whole template and its subject (`subject-builder.ts:70-71`) are English |
| `subscription/plan-being-retired.tsx` | the whole template and its subject (`subject-builder.ts:78-79`) are English |
| `billing/mark-escalated.tsx:27-28` | raw `reason` (`COBRO_DUPLICADO`) and raw `subjectType` (`subscription`, `addon_instance`) |
| `billing/duplicate-charge-detected.tsx:26` | raw `subjectType` |
| `billing/revocation-refund-failed.tsx:49-51` | raw `subjectType`. A null currency prints "N centavos" |
| `billing/provider-watch-alert.tsx:84-86` | `finishedAt` printed as an ISO string. Values are unlabeled lines |
| `billing/reconciliation-summary.tsx` | reasons fall back to the raw code |

The 3 English subscription templates have **no producer** in `apps/api/src` or `packages/service-core/src` (`rg` for their type names, components and kebab names finds only the notifications package). They are probably leftovers from before HOS-1352. PR-3 still translates them, since the catalog shows them, and records the finding on the issue (§7.1).

Two of the paths the audit listed are **intentional locale maps** and stay as they are: `ai/ai-questions-weekly-digest.tsx` (es/en/pt `COPY` and `SUBJECT`) and `listing-location/listing-location-exception-decision.tsx` (es/en copy). Their `es` branch is already Spanish.

### 2.4 Plain-text URLs and missing CTAs

These templates print a URL as text: `billing/grace-reminder.tsx:49`, `billing/grace-started.tsx:37`, `billing/chargeback-suspension.tsx:28`, `billing/signup-declined.tsx:56`, `billing/paid-after-cancellation.tsx:36`, `verticals/listing-business-lines-changed.tsx:61-62` (two URLs), `verticals/listing-content-edited-by-support.tsx:28` and `verticals/listing-notice-shared.tsx:89`.

The outbox renderers already build these URLs from the env-aware `siteUrl`. Examples: `SUBSCRIPTION_PATH = '/es/mi-cuenta/suscripcion/'` (`services/outbox/billing-signup-renderers.tsx:52`) and the per-vertical account paths (`services/outbox/vertical-listing-renderers.tsx:50-54`).

Several user mails ask the reader to do something and offer no button (§7.5).

### 2.5 Four unclear staff mails

`duplicate-charge-detected.tsx`, `mark-escalated.tsx`, `revocation-refund-failed.tsx` and `manual-installment-unpaid.tsx` each render one paragraph with ids inlined. None links to the panel, even though `createBillingReconciliationRenderers` already receives `adminUrl` and `readSubjects` (`services/outbox/billing-reconciliation-renderers.tsx:253-270`). It only passes them to the summary. Unused payload fields: `refundReason`, `sourceKind` and `sourceId` (refund failed); `vertical` and `firstInstallment` (manual installment). `mark-escalated`'s catalog name is "Marca de conciliación escalada", but its subject is "Marca de conciliación sin resolver".

The reconciliation summary (`reconciliation-summary.tsx:340-367`) renders each item as one `Text` built by `joinParts` with ` · ` (`:147-149`). The fallback reads like `COBRO_DUPLICADO · subscription <uuid> · 2 veces`.

Admin routes that exist (`apps/admin/src/routes/_authed/billing/`): `reconciliation/index.tsx`, `reconciliation/$markId.events.tsx`, `reconciliation/refunds.tsx`, `subscriptions/$subscriptionId.index.tsx` and `settings.tsx` (holds the provider-watch cards, `features/billing-provider-watch/`). Manual installments are registered from the partner page (`apps/admin/src/routes/_authed/partners/$id.tsx`, `features/partners/hooks/usePartnerManualPayments.ts`), which is keyed by partner id. The unpaid payload carries no partner id.

The Spanish reason labels already exist in `packages/i18n/src/locales/es/admin-billing.json` (`reconciliationMarks.reasons.*`, e.g. `COBRO_DUPLICADO` at `:2157`). `apps/api` depends on `@repo/i18n`. `@repo/notifications` does not.

### 2.6 Layout, assets, social links and preferences

- `packages/email/src/templates/email-layout.tsx`: a white header with the logo and tagline, a 4px brand bar, body padding `32px 24px`, and a footer with two brand lines, a `hospeda.com.ar` link and an optional preferences link (`footerLink: 'preferences' | 'none'`, default `'none'`). No template passes `'preferences'` today. There is an MSO ghost table for Outlook, and `<meta name="color-scheme" content="light">`.
- `packages/email/src/email-assets.ts` (HOS-2540): `configureEmailAssets({ siteUrl })` sets the asset origin at startup, and `resolveEmailLogoUrl()` returns `<origin>/email/hospeda-logo@2x.png`. Only the logo follows the environment.
- `apps/web/public/email/` holds only `hospeda-logo@2x.png` (360x108, 8-bit RGB, no alpha channel).
- The site wave is an inline SVG (`apps/web/src/layouts/Footer.astro:198-203`, `viewBox="0 0 1440 80"`, a single path). SVG is forbidden in email HTML (HOS-2519 AC-1.2).
- `SOCIAL_PROFILES` (`apps/web/src/lib/constants.ts:78-84`): facebook, instagram, x and youtube are literal URLs. The whatsapp entry is derived at module load from `HOSPEDA_BRAND_PHONE` (`getBrandPhoneWhatsAppUrl`, `apps/web/src/lib/brand-phone.ts:110`). Web guards import it from `lib/constants` (`apps/web/test/static-guards/whatsapp-link-construction.test.ts:54`, `outbound-href-sanitization.test.ts:128-130`). There is no LinkedIn profile.
- **The preferences page controls little.** `PreferenceToggles.client.tsx` writes `settings.notifications.allowEmails` and the newsletter toggle. `PreferenceService` reads `emailEnabled` and `disabledCategories` (`packages/notifications/src/services/preference.service.ts:42-44`). `allowEmails` is honoured only by the AI questions digest (`apps/api/src/services/ai-questions-digest.helpers.ts:115`). This is why `packages/email/CLAUDE.md` says that today no template qualifies for `footerLink="preferences"`.
- Unsubscribe: only the newsletter campaign has one (per-recipient HMAC link in its body). No `List-Unsubscribe` header is sent. `NotificationCategory.TRANSACTIONAL` is documented as "Always sent, cannot be opted out" (`types/notification.types.ts:315-316`).
- HOS-2519 email-safety checks (`apps/api/test/services/email-preview/email-catalog-layout.test.ts`): HTML under 90 KB, exactly one `<html lang="es"`, none of `oklch(`, `var(--`, `display:flex`, `display:grid`, `<svg`, no `{{`, and the text part without the logo.

## 3. Goals

- **G-1** Every catalog entry declares its audience, and the previewer can show only user or only staff mails.
- **G-2** Every callout has a visible tinted background and a 4px left border, from one component. Every button comes from one component that is full width on mobile.
- **G-3** A Spanish render contains no English sentence, no raw enum code and no ISO timestamp.
- **G-4** No URL is printed as bare text. Every user mail that asks for an action has a CTA button to the place where the action happens.
- **G-5** A staff member understands each staff mail without opening the code: labeled rows, human labels and a link to the right admin page.
- **G-6** User mails get the owner-approved look (wave header, more space and color, social footer). Staff mails look exactly as before.
- **G-7** Every HOS-2519 safety constraint still holds, including the 90 KB budget, in Gmail, Outlook desktop and web, and Apple Mail, in light and dark mode.

## 4. Decisions

| # | Decision | Alternatives and reason |
|---|---|---|
| D1 | `audience` is a **required** field of `defineEmailCatalogEntry`, `defineNotificationEntry` and `defineOutboxEntry`. The `simple()` helper in `outbox-billing-cancellation.ts` passes `'user'` | Rejected: deriving it from `domain` (unreliable, §2.1); an optional field defaulting to `'user'` (a new staff mail would silently become a user mail). Required makes TypeScript refuse an entry without it. A runtime test also freezes the staff set |
| D2 | `Callout` and `Button` live in **`@repo/email`** (`src/components/`), exported from its index. `packages/notifications/src/templates/components/button.tsx` is deleted, and its ~58 importers are rewritten to `@repo/email` (codemod, no re-export shim) | The auth templates live in `@repo/email`, and that package cannot import `@repo/notifications` (§2.2). Same move as HOS-2519 D1 for the layout. Rejected: two copies (drift) or a shim (two import paths forever) |
| D3 | Callout colors come from **new `emailPalette` roles** mapped to `info`, `success`, `warning` and `danger` (`colors.ts:187-207`): background `[50]`, border `[500]`, text `[800]`. The existing drift test covers them. A new contrast test requires text on background ≥ 4.5:1 | "Matches the conversation-verify reference" means the same geometry (tinted background, 4px left border, radius 8px, padding `16px 20px`, margin `24px 0`, tinted text). The exact hex then comes from the brand tokens, not from Tailwind's `sky`. Rejected: copying `#f0f9ff`/`#0ea5e9` (a hard-coded off-brand hex, against the owner's rule) |
| D4 | The button is **content width by default** (inline styles). One `<style>` block in `EmailLayout`'s `<head>` holds a single media query, `max-width: 480px`, that makes `.hospeda-btn` `display:block !important; width:auto !important`. Where `<style>` is stripped (some Gmail account types, older clients), the button stays content width, which is today's behavior | Rejected: always full width (wide buttons on desktop, against the owner's request); a fluid table capped at ~360px without a media query (not content width on desktop). This deliberately narrows the HOS-2519 "no `<style>`-dependent layout" rule: the layout must stay correct with the block removed, and the block may hold only this one rule (AC-2.6) |
| D5 | Outlook desktop gets **graceful fallbacks, not VML**. Square corners on buttons and callouts (Word ignores `border-radius`). Padding and background live on the `<td>`. The react-email `Button` MSO spacers keep the whole button clickable. The wave is an `<img>`, not a CSS background | Rejected: VML `v:roundrect` buttons. They repeat the label and the href inside a conditional comment for ~65 buttons (bytes against the 90 KB budget, and two hrefs that can drift) for rounded corners in one client |
| D6 | The static guard (PR-2) is **source-based and fail-closed**, one per package (`packages/notifications/test/templates/email-components.guard.test.ts`, `packages/email/test/templates/email-components.guard.test.ts`). Rules in §6.4 | Rejected: a render-based check (it cannot tell a callout from a card in HTML). The guard header lists its blind spots, as the repo's guards do |
| D7 | Billing-cycle labels move to one helper `formatBillingCycleLabel({ cycle })` in `templates/utils/format-helpers.ts`, used by `purchase-confirmation`, `plan-price-change-notice` and `reconciliation-summary`. An unknown value renders as received | One map instead of three. The raw fallback keeps the information visible instead of hiding a row, and the Spanish test (AC-3.1) catches the known English values |
| D8 | Staff-facing reason labels are resolved **in `apps/api`** and injected into `createBillingReconciliationRenderers` as an optional port `resolveReasonLabel({ reason }) → string \| null`. It reads `admin-billing.reconciliationMarks.reasons.<code>` (es) through `@repo/i18n`. When the port is absent or the key is missing, the raw code is shown | Single source of truth for labels the admin already shows. Rejected: a new `@repo/i18n` dependency in `@repo/notifications` (a dependency change for one map); a copied map in the template (drift) |
| D9 | The four staff mails are enriched **at render time**, through the existing optional `readSubjects` reader and `adminUrl` that the reconciliation factory already receives. Their payloads do not change. A failed reader never blocks the send, as in HOS-1971. Missing optional rows are omitted | The payloads lack holder and plan. Changing the producers would need a migration of already-queued rows. The reader exists, batches, and is fault-tolerant |
| D10 | `EmailLayout` gets `variant?: 'user' \| 'staff'`, **default `'user'`**. The 13 staff templates pass `variant="staff"`. A catalog-wide test asserts that each render's `data-layout-variant` equals the entry's `audience` | 13 edits instead of 112. Rejected: an explicit prop on every template (a 112-file codemod for the same result). The consistency test makes a wrong default impossible to ship |
| D11 | The user header is **one composite PNG** (wave band plus logo), `apps/web/public/email/hospeda-header-user@2x.png` (1200x240, rendered 600x120, fluid), resolved per environment through a generalized `resolveEmailAssetUrl({ path })` | One opaque image is never inverted by dark mode, so the logo never sits in a darkened box (§8.4). Rejected: logo plus a separate wave strip (in Gmail's partial inversion the logo row's padding turns dark around a white logo); a CSS background (Outlook needs VML for it). Cost: a brand change means re-exporting two assets |
| D12 | The shared social list lives in **`@repo/config`** (`src/brand-social-profiles.ts`, `BRAND_SOCIAL_PROFILES`) with the four static profiles (facebook, instagram, x, youtube). Web builds `SOCIAL_PROFILES = [...BRAND_SOCIAL_PROFILES, whatsapp]` in `lib/constants.ts`. Emails show the four. `@repo/email` gains a dependency on `@repo/config` | `@repo/config` depends only on `dotenv` and `zod`, and web, notifications and api already use it. `@repo/utils` pulls `undici` and `date-fns`. WhatsApp stays in web because its URL depends on `HOSPEDA_BRAND_PHONE`. The owner's reference showed LinkedIn, but Hospeda has no LinkedIn profile |
| D13 | **No one-click unsubscribe on transactional mails.** User mails get "Gestioná tus avisos" (preferences page). The newsletter keeps its own unsubscribe | Billing, security and listing-state mails are notices the user needs: a charge, a suspension, a listing about to be archived. `TRANSACTIONAL` is "always sent, cannot be opted out" by design. One-click unsubscribe (RFC 8058) is what Gmail and Yahoo require for marketing and subscribed mail, not for transactional mail. A link that let a user silence suspension notices would cause harm. HOS-2519 OQ-2 already rejected a tokenized unsubscribe |
| D14 | Scenarios get an optional `locale: 'es' \| 'en' \| 'pt'` (default `'es'`) so the Spanish test (AC-3.1) knows which renders must be Spanish | Scenario ids are not a reliable signal (`outbox-partner.ts:55` has an `en` payload under a non-`en` id). Rejected: a frozen exemption list keyed by scenario id (it rots silently) |
| D15 | The design draft for PR-4 is produced **on the PR-4 branch**, not merged: the previewer runs locally, and screenshots plus the HTML files are posted to HOS-2565 for approval (§8.6) | Production code never carries an unapproved design. Alternative in OQ-2 |

## 5. Design: PR-1, audience

- `types.ts`: `export type EmailAudience = 'user' | 'staff';` and `readonly audience: EmailAudience` on `EmailCatalogEntry` and on the three define inputs (§9.1).
- Every entry file sets `audience`. The 13 staff keys of §2.1 get `'staff'`. Everything else gets `'user'`.
- Test `packages/notifications/test/catalog/catalog-audience.test.ts`:
  - every entry's `audience` is `'user'` or `'staff'` (runtime check, in case a cast slips through);
  - the set of staff keys equals a frozen list of the 13 keys, so reclassifying a mail is a deliberate test edit.
- Schema: `EmailAudienceSchema = z.enum(['user', 'staff'])`, added as `audience` to `EmailPreviewEntrySummarySchema`. `email-preview.service.ts` maps `entry.audience`.
- Admin:
  - `filterEmailCatalog` gets `audience: 'all' | 'user' | 'staff'`.
  - `EmailCatalogList` shows a three-option segmented control ("Todos", "Usuarios", "Staff") above the domain filter, with default "Todos".
  - Staff entries show a "Staff" badge. The count "N de M" reflects every filter.
  - "Limpiar filtros" resets audience to "Todos".
- i18n (`admin-pages.json`, es/en/pt): `emailPreviews.audienceFilterLabel` ("Destinatario" / "Recipient" / "Destinatário"), `emailPreviews.audiences.all|user|staff` (es: "Todos", "Usuarios", "Staff"), `emailPreviews.staffBadge` ("Staff").
- Docblock fix in `ai-cost-threshold-alert.tsx`: "Rendered once per address in `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` (see `apps/api/src/services/ai-cost-alert.service.ts`), with `recipientName: 'Admin'`."

## 6. Design: PR-2, shared callout and button

### 6.1 Palette (`packages/design-tokens/src/tokens/email-palette.ts`)

New roles, each with a JSDoc line naming its token: `calloutInfoBackground` (`info[50]`), `calloutInfoBorder` (`info[500]`), `calloutInfoText` (`info[800]`), and the same three for `Success`, `Warning` and `Danger`. Also `buttonPrimary` (`river[600]`), `buttonPrimaryText` (white) and `buttonSecondaryBorder` (`river[600]`). The drift test covers them automatically. A new `email-palette-contrast.test.ts` (same style as the existing `*-contrast.test.ts`) asserts:

- callout text on callout background ≥ 4.5:1;
- button text on button background ≥ 4.5:1.

If a proposed shade fails, the shade moves one step (for example `[900]` text) and the JSDoc follows. The final shades are confirmed in the PR-2 visual review.

### 6.2 `Callout` (`packages/email/src/components/callout.tsx`)

- Props: `tone: 'info' | 'success' | 'warning' | 'danger'`, optional `title?: string` (bold first line), and `children`.
- Markup: a `role="presentation"` table, `width="100%"`, with one `<td>` that carries every style: tinted background, `border-left: 4px solid <border>`, `border-radius: 8px`, padding `16px 20px`, and text color `<text>`, 14px/22px. The table has margin `24px 0`. Styles sit on the `<td>` for Outlook (HOS-2519 layout note).
- `data-callout-tone="<tone>"` on the `<td>` so tests can count callouts.
- Children that are `Text` keep their own margins. The component resets the last child's bottom margin through its own `Text` wrapper when given a string.

### 6.3 `Button` (`packages/email/src/components/button.tsx`)

- Props: `href`, `children`, `variant?: 'primary' | 'secondary'` (default `'primary'`).
- Renders react-email `Button` with `className="hospeda-btn"`, inline `display: inline-block`, radius 6px, padding `14px 28px`, 16px/24px semibold, and colors from §6.1.
- It wraps itself in a centered block with margin `24px 0`, so templates stop hand-rolling `buttonContainer` styles. Templates that place two buttons side by side keep their wrapper.
- `EmailLayout` adds to `<head>`: `<style>@media only screen and (max-width:480px){.hospeda-btn{display:block !important;width:auto !important;}}</style>` (D4). Rendered once per email, about 100 bytes.

### 6.4 Migration and guard

- Codemod: `../components/button.js` imports become `import { Button } from '@repo/email'`. `components/index.ts` drops the button re-export.
- Each inline callout is replaced by `<Callout tone=…>`. Tone mapping:
  - blue, sky, cyan, slate and teal borders, and `#f8fafc` boxes → `info`;
  - green → `success`;
  - amber, yellow and orange → `warning`;
  - red and rose → `danger`.

  The PR lists every file with old style → tone, for review.
- The `#f8fafc` borderless boxes in `purchase-confirmation.tsx` and `payment-success.tsx` hold `InfoRow` receipts. They are **cards, not callouts**: they keep a background, which changes to `emailPalette.pageBackground`, plus a 1px `emailPalette.border` border. They enter the guard's card allowlist.
- `verify-email.tsx`, `reset-password.tsx` and `admin-lead-received.tsx` switch to the shared `Button` and `Callout`. Their copy does not change.
- `trial/trial-series-shared.ts` (`calmBox`, `warningBox`, …) maps its tones to `Callout`.
- Guard rules (fail-closed, over every `.ts` and `.tsx` under the package's templates directory):
  1. A `borderLeft` property outside `src/components/callout.tsx` fails, unless the file and style name are in a frozen `CARD_ALLOWLIST` with a reason (for example `alerts/PriceDropItem.tsx#card`).
  2. Importing `Button` from `@react-email/components` outside `src/components/button.tsx` fails.
  3. A `backgroundColor` with a hex literal fails, unless it is in `CARD_ALLOWLIST`.
  4. Every `CARD_ALLOWLIST` entry must still match a style in its file, or the guard fails (no stale exemptions).
  5. The parser is checked on fixtures before it is trusted: a fixture with each forbidden form must be detected.
- Blind spots, written in the guard header:
  - a style built through spreads or computed keys;
  - a raw `<a>` styled as a button;
  - colors passed as props.

## 7. Design: PR-3, content

### 7.1 English text

- `subscription-access-ending-soon.tsx`, `subscription-cancel-confirmed.tsx` and `plan-being-retired.tsx` are translated to Rioplatense Spanish (voseo, the same register as the billing mails). This covers the preheader, heading, greeting, paragraphs, `InfoRow` labels and the CTA. Their three `SUBJECT_PATTERNS` entries in `utils/subject-builder.ts` are translated too, with the same placeholders. Proposed subjects:
  - "Confirmamos tu baja: seguís con {planName} hasta el {accessUntil}"
  - "Tu acceso a {planName} termina en {daysRemaining} días"
  - "{planName} deja de ofrecerse: tu acceso sigue hasta el {accessUntil}"
- Every new string is listed in the PR for owner sign-off.
- The implementer confirms on the Linear issue that these three types have no producer (§2.3) and files a follow-up to retire or wire them. That decision is not taken here.

### 7.2 Raw values

- `purchase-confirmation.tsx`: `formatBillingCycleLabel` (D7), so "monthly" renders as "Mensual".
- `mark-escalated`, `duplicate-charge-detected`, `revocation-refund-failed` and the summary:
  - `subjectType` renders as "Suscripción" or "Complemento" (one map `SUBJECT_TYPE_LABELS` in a shared `templates/billing/reconciliation-labels.ts`);
  - `reason` renders through the D8 port.
  - The refund-failed template also gets a local map: `refundReason` (`REVOCATION` → "Revocación", `ADDON_ORPHAN` → "Complemento sin suscripción", `ONE_TIME_ADDON_REVOCATION` → "Revocación de complemento único") and `sourceKind` (`payment` → "Pago con Mercado Pago", `manual_payment` → "Pago manual"). No admin label exists for these, so the map is email-only.
- `provider-watch-alert.tsx`:
  - `finishedAt` goes through a new `formatDateTime({ dateString })` helper (es-AR, `America/Argentina/Buenos_Aires`, "21/11/2026 09:00").
  - Each alert becomes a block of labeled rows: "Medición", "Qué pasó", "Esperaba", "Obtuvo", "Detalle".
  - `expected` and `obtained` are **provider values, kept verbatim** in a monospace style, because translating a measured value would misreport what the provider returned. The Spanish test (AC-3.1) exempts these two rows by their `data-raw-value` attribute.
- `revocation-refund-failed` with a null currency renders "{amount} (moneda no registrada)" instead of "N centavos".

### 7.3 Locale of scenarios

`EmailScenario` and the scenario summary gain `locale?: 'es' | 'en' | 'pt'` (D14). The non-Spanish scenarios set it: `outbox-billing-ops.ts:285, 325, 378`, `notification-community.ts:321, 354`, `outbox-partner.ts` (the `en` payload at `:55` and `pt` at `:79`), `notification-admin.ts:288` and `alert-digest.ts:88`. A completeness test asserts that a scenario whose input carries `locale` (payload or top level) declares the same scenario `locale`.

### 7.4 Plain-text URLs

Each URL of §2.4 becomes a `Button` when it is the mail's main action, or an inline `Link` with descriptive text when it is secondary.

| Template | Main action (`Button`) | Secondary (`Link`) |
|---|---|---|
| `grace-reminder`, `grace-started` | "Ir a Mi Suscripción" | none |
| `signup-declined` | "Volver a intentarlo" (Mi Suscripción) | none |
| `chargeback-suspension` | "Volver a suscribirme" (Mi Suscripción) | none |
| `paid-after-cancellation` | "Ver Mi Suscripción" | none |
| `listing-business-lines-changed` | "Ver mi ficha" (`accountUrl`) | "escribinos" (`contactUrl`) |
| `listing-content-edited-by-support` | none (informational) | "escribinos" (`contactUrl`) |
| `listing-notice-shared` | keeps its existing button | "Mi Suscripción" (`subscriptionUrl`) |

### 7.5 CTA in every user mail that asks for an action

The audit of the user templates without a `Button` gives this list. Each one asks the reader to do something.

| Catalog key | Action asked | Button and target |
|---|---|---|
| `outbox.billing.grace-started` | update the card before the deadline | "Ir a Mi Suscripción" → `/es/mi-cuenta/suscripcion/` |
| `outbox.billing.grace-reminder` | same | same |
| `outbox.billing.signup-declined` | retry the signup | "Volver a intentarlo" → same |
| `outbox.billing.chargeback-suspension` | resubscribe if it was a mistake | "Volver a suscribirme" → same |
| `outbox.billing.arrears-suspension` | resubscribe or pay the installment | "Volver a suscribirme" → same |
| `outbox.billing.signup-incomplete` | resubscribe | "Volver a suscribirme" → same |
| `outbox.billing.plan-migration-announced` | cancel or pick another plan before the change | "Ver mi suscripción" → same |
| `outbox.verticals.listing-retention-before-archive` | publish, or recover coverage | "Ir a mi ficha" → per-vertical account path |
| `outbox.verticals.listing-retention-before-deletion` | move it to draft | same |
| `outbox.verticals.listing-archived` | move it to draft | same |
| `outbox.verticals.listing-business-lines-changed` | check the listing | "Ver mi ficha" → `accountUrl` |

- The per-vertical account paths (`vertical-listing-renderers.tsx:50-54`) move to one shared module, `services/outbox/account-listing-paths.ts`, used by the vertical, archived and retention renderers. These renderers already receive `siteUrl` (`apps/api/src/services/email-outbox/outbox-renderer-registry.ts:119-125`). Templates that lack a URL prop gain a required `actionUrl` prop, built by the renderer.
- Reviewed with **no CTA added**, because they ask nothing: the 14 cancellation mails (`outbox-billing-cancellation.ts`), `billing.payment-credited`, `billing.renewal-upcoming`, `billing.promo-ending`, `billing.courtesy-revoked` and `billing.plan-migration-upcoming`/`-cancelled`.

### 7.6 Reconciliation summary

- Each item becomes its own block: a bold lead line ("Cobro por debajo del esperado") followed by `InfoRow`-style labeled rows. The rows are "Titular", "Plan", "Suscripción", "Motivo", "Esperado", "Cobrado", "Diferencia", "Pago", "Período", "Próximo cobro" and "Días de regalo", whichever apply.
- Then "Qué hacer" (when present) and a secondary `Link` "Abrir en el panel".
- A hairline divider separates items. Section headings stay.
- `joinParts` is no longer used for item rendering. The bare fallback (no enrichment) renders the same rows with the short id and the reason label (D8), never `COBRO_DUPLICADO · subscription <uuid>`.
- The closing sentence's raw URL becomes `Button` "Abrir el listado de conciliación".
- The file is 380 lines today. If the rewrite passes 500, the row builders split into `reconciliation-summary-rows.tsx`.

### 7.7 The four staff mails

All four use `InfoRow` rows, a one-sentence intro, a `Callout tone="warning"` with the required action, and a `Button` to the panel when `adminUrl` is configured. Without `adminUrl`, a sentence names the menu path instead ("Facturación → Conciliación"). The renderer factory passes `adminUrl`, `readSubjects` (D9) and `resolveReasonLabel` (D8) to the three immediate notices. `createBillingManualPaymentRenderers` gains an optional `adminUrl`, and the registry passes it.

| Mail | Rows | Panel link |
|---|---|---|
| `duplicate-charge-detected` | Motivo (label), Sujeto (Suscripción/Complemento + short id), Titular and Plan (enrichment, optional), Pago (when present), Abierta el | `/billing/reconciliation/<markId>/events` |
| `mark-escalated` | Motivo (label), Sujeto, Titular and Plan (optional), Abierta el, Escaló el, Plazo ("N días") | same |
| `revocation-refund-failed` | Reembolso (short id), Motivo del reembolso, Origen del pago (label + short id), Sujeto (when present), Monto, Falló el | `/billing/reconciliation/refunds` |
| `manual-installment-unpaid` | Suscripción (short id), Vertical (`formatTrialVerticals`), Cuota ("Primera cuota"/"Renovación"), Período desde, Abierta el, Titular (optional) | `/billing/subscriptions/<subscriptionId>` |

- `mark-escalated`'s catalog name changes to "Marca de conciliación sin resolver" to match its subject.
- **Data gap:** the manual installment is registered on `/partners/<partnerId>`, and the payload has no partner id. PR-3 links to the subscription page, which exists. A follow-up issue proposes adding `partnerId` to the renderer enrichment (subscription → owner → partner lookup) to deep-link the action itself.
- `provider-watch-alert` (§7.2) gets a `Button` "Abrir la vigilancia del proveedor" → `/billing/settings` when `adminUrl` is passed. `createBillingProviderWatchRenderers` gains an optional `adminUrl`.

## 8. Design: PR-4, user layout variant

### 8.1 Variant

- `EmailLayoutProps.variant?: EmailLayoutVariant` (`'user' | 'staff'`, default `'user'`, D10). The root `<Body>` carries `data-layout-variant`.
- `variant="staff"` renders exactly today's markup (AC-4.1).
- The 13 staff templates pass `variant="staff"`.

### 8.2 User header

- One `<img>` of the composite header (D11): `src={resolveEmailAssetUrl({ path: EMAIL_USER_HEADER_PATH })}`, `width={600}`, `height={120}`, `alt="Hospeda"` (styled as the wordmark, as today), `style="display:block;width:100%;height:auto;border:0"`.
- The header `<td>` has `bgcolor` and `background-color` set to the wave's dominant color, so a blocked image still shows a colored band with the alt wordmark.
- Marked `data-skip-in-text="true"`.
- The asset is produced by the implementer: the `Footer.astro` wave path rasterized at 2x (1200x240), in `emailPalette` colors, with the logo composited on a white area. It is opaque RGB, under 40 KB, and committed to `apps/web/public/email/`. The owner approves it in the draft (§8.6).
- `email-assets.ts` gains `resolveEmailAssetUrl({ path })`. `resolveEmailLogoUrl()` becomes a wrapper and keeps its behavior.
- The staff variant keeps the logo plus tagline plus 4px bar.

### 8.3 User body and footer

- Page background `emailPalette.userPageBackground` (new role, proposal `sky[50]`). Card radius 12px (ignored by Outlook). Body padding `40px 32px` (fluid: at 320px width this still leaves 256px of content). `Callout` and `Button` keep their PR-2 margins, and the extra space comes from the layout's padding only, so the components need no variant awareness.
- Footer on `emailPalette.footerBackground` (new role, proposal `neutral[100]`), in this order:
  1. a social row: 4 icons, 32x32 rendered, spaced 12px, centered, each a `Link` to the `BRAND_SOCIAL_PROFILES` URL with `alt` "Hospeda en Facebook" (and so on);
  2. the two existing brand lines, verbatim;
  3. the `hospeda.com.ar` link;
  4. "Gestioná tus avisos" → `EMAIL_PREFERENCES_URL` (`data-layout-link="preferences"`), shown unless the template passes `footerLink="none"`;
  5. "© {year} Hospeda" (year from the render date).
- Icon assets: `apps/web/public/email/social/{facebook,instagram,x,youtube}@2x.png` (64x64). They are **PNG with alpha**: a white glyph on a mid-tone brand circle, so they read on light and dark backgrounds. They are resolved through `resolveEmailAssetUrl`. The social row is marked `data-skip-in-text`.
- `footerLink` defaults by variant: `'preferences'` for user, `'none'` for staff. Recipients without an account pass `footerLink="none"`:
  - the 2 auth mails (the reader cannot log in yet);
  - the 5 anonymous conversation mails (verify, access link, new message anon, token day 15 and day 25);
  - the 3 newsletter mails (subscribers may have no account);
  - `notification.alliance_claim_invite`, `outbox.verticals.partner-claim-notice` and `outbox.verticals.partner-application-rejected`.

  The implementer confirms each one against its producer, and a test freezes the set. The link text changes from "Administrar preferencias de notificaciones" to "Gestioná tus avisos" (owner wording).
- The newsletter campaign keeps its in-body unsubscribe. The layout adds nothing that unsubscribes (D13).

### 8.4 Dark mode

- `color-scheme: light` metas stay. They stop inversion in Apple Mail and Outlook.com.
- Gmail apps apply partial inversion, which darkens light backgrounds but never images. The header is one opaque image, so it stays intact as a light banner. The social icons are transparent with a mid-tone fill, so they read on both. The logo inside the staff header is opaque RGB, unchanged from HOS-2519 (R-11 residual accepted there).
- Accepted residual: in Gmail iOS dark mode the card turns dark and the header banner stays light. This is checked in the smoke (AC-4.8).

### 8.5 Outlook desktop

The header is an `<img>` with `width`/`height` attributes inside the existing 600px ghost table, so no VML is needed. Card and button radius degrade to square corners (D5). The social row is a nested `role="presentation"` table with fixed `width` attributes per cell.

### 8.6 Design draft gate

PR-4 starts as a draft PR. Before any of the work beyond the layout itself (template edits, tests, docs), the implementer:

1. implements `variant="user"` in `EmailLayout` and the assets on the branch;
2. runs the local previewer (`hops servers-up` in the worktree) and captures desktop (600px) and mobile (375px) screenshots of six user mails (`auth.verify-email`, `outbox.billing.grace-started`, `notification.payment_success`, `outbox.verticals.listing-archived`, `conversation.new-message`, `notification.trial_ending_reminder`) and one staff mail (`outbox.billing.reconciliation-summary`) to show it unchanged;
3. saves the rendered HTML of the same seven (`renderEmailBodies`) and screenshots of the user header in a dark-mode emulation;
4. posts all of it as one comment on HOS-2565 and waits.

The owner approves, or asks for changes and the loop repeats. Only after approval does PR-4 continue to completion. The approval comment is linked from the PR description.

## 9. Contracts

### 9.1 Catalog (`packages/notifications/src/catalog/types.ts`)

```ts
/** Who reads the email. Drives the layout variant and the previewer filter. */
export type EmailAudience = 'user' | 'staff';

/** Locale of a scenario's rendered copy (HOS-2565 D14). */
export type EmailScenarioLocale = 'es' | 'en' | 'pt';

export interface EmailScenario<TInput> {
    readonly id: string;
    readonly label: string;
    readonly input: TInput;
    /** Defaults to 'es'. */
    readonly locale?: EmailScenarioLocale;
}

export interface EmailCatalogScenarioSummary {
    readonly id: string;
    readonly label: string;
    readonly locale: EmailScenarioLocale; // resolved, never undefined
}

export interface EmailCatalogEntry {
    // ...HOS-2519 fields unchanged...
    readonly audience: EmailAudience;
}
```

`DefineEmailCatalogEntryInput`, `DefineNotificationEntryInput` and `DefineOutboxEntryInput` gain `readonly audience: EmailAudience` (required).

### 9.2 API schema (`packages/schemas/src/api/email-preview/email-preview.schema.ts`)

```ts
export const EmailAudienceSchema = z.enum(['user', 'staff']);
export type EmailAudience = z.infer<typeof EmailAudienceSchema>;

// EmailPreviewEntrySummarySchema gains:
//   audience: EmailAudienceSchema,
// and its scenario objects gain (PR-3):
//   locale: z.enum(['es', 'en', 'pt'])
```

### 9.3 `@repo/email`

```ts
export type CalloutTone = 'info' | 'success' | 'warning' | 'danger';
export interface CalloutProps {
    readonly tone: CalloutTone;
    readonly title?: string;
    readonly children: ReactNode;
}
export function Callout(props: CalloutProps): ReactElement;

export type ButtonVariant = 'primary' | 'secondary';
export interface ButtonProps {
    readonly href: string;
    readonly children: ReactNode;
    readonly variant?: ButtonVariant;
}
export function Button(props: ButtonProps): ReactElement;

export type EmailLayoutVariant = 'user' | 'staff';
// EmailLayoutProps gains: readonly variant?: EmailLayoutVariant; // default 'user'
// footerLink default becomes variant-dependent: 'preferences' (user), 'none' (staff).

export function resolveEmailAssetUrl(input: { readonly path: `/email/${string}` }): string;
export const EMAIL_USER_HEADER_PATH = '/email/hospeda-header-user@2x.png';
```

### 9.4 `@repo/config`

```ts
/** Hospeda's own social profiles that do not depend on env (HOS-2565 D12). */
export const BRAND_SOCIAL_PROFILES = [
    { platform: 'facebook', url: 'https://www.facebook.com/hospeda.com.ar' },
    { platform: 'instagram', url: 'https://www.instagram.com/hospeda.com.ar' },
    { platform: 'x', url: 'https://x.com/HospedaLitoral' },
    { platform: 'youtube', url: 'https://www.youtube.com/@hospeda.com.ar' }
] as const;
export type BrandSocialPlatform = (typeof BRAND_SOCIAL_PROFILES)[number]['platform'];
```

### 9.5 Renderer ports (`@repo/notifications`)

```ts
/** Resolves a reconciliation reason code to a Spanish label, or null when unknown. */
export type ReconciliationReasonLabelResolver = (input: { readonly reason: string }) => string | null;
// createBillingReconciliationRenderers input gains: readonly resolveReasonLabel?: ReconciliationReasonLabelResolver;
// createBillingManualPaymentRenderers and createBillingProviderWatchRenderers gain: input?: { readonly adminUrl?: string; ... }
```

## 10. Acceptance criteria

### US-1. Audience (PR-1)

- **AC-1.1** Given an entry definition without `audience`, when `pnpm typecheck` runs on `@repo/notifications`, then it fails.
- **AC-1.2** Given `EMAIL_CATALOG`, then every entry's `audience` is `'user'` or `'staff'`, and the set of `'staff'` keys equals exactly the 13 keys of §2.1 (a test with a frozen list).
- **AC-1.3** Given `GET /api/v1/admin/email-previews` as an admin with `NOTIFICATION_TEMPLATE_PREVIEW`, then each entry carries `audience`, the body parses with the updated schema, and 13 entries have `audience: 'staff'`.
- **AC-1.4** Given the previewer with "Staff" selected, then exactly the 13 staff entries are listed and the count reads "13 de 125". Given "Usuarios", then 112 are listed. Given "Todos", then all are listed. Given "Staff" plus the search "conciliación", then only staff entries matching the search remain.
- **AC-1.5** Given "Limpiar filtros", then the audience returns to "Todos" and the search and domain filters reset.
- **AC-1.6** Given the en and pt locales of the admin, then the audience control and badge labels come from `admin-pages.json`. A test fails if a key is missing in any of the three locales.
- **AC-1.7** Given `ai-cost-threshold-alert.tsx`, then its docblock names `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` and does not contain "SUPER_ADMIN".

### US-2. Callout and button (PR-2)

- **AC-2.1** Given each `Callout` tone rendered to HTML, then the `<td>` carries `data-callout-tone`, a background equal to that tone's `emailPalette` role, `border-left:4px solid <border role>`, and `border-radius:8px`.
- **AC-2.2** Given `email-palette.test.ts`, then every new role equals its source token. Given `email-palette-contrast.test.ts`, then each callout text on its background and the button text on its background are ≥ 4.5:1.
- **AC-2.3** Given the repo after PR-2, then `packages/notifications/src/templates/components/button.tsx` does not exist, and `rg "from '@react-email/components'" -l | xargs rg -l "\bButton\b"` over both template trees returns only `packages/email/src/components/button.tsx`.
- **AC-2.4** Given the guard, when a fixture template adds a `borderLeft` style, a raw react-email `Button` import, or a hex `backgroundColor` outside `CARD_ALLOWLIST`, then the guard fails, naming the file and line. Given a stale allowlist entry, then it fails.
- **AC-2.5** Given every catalog scenario rendered, then no element outside a `data-callout-tone` cell or an allowlisted card has a `border-left` style (catalog-wide test in `apps/api/test/services/email-preview/`).
- **AC-2.6** Given any rendered email, then it contains exactly one `<style>` element, its content is exactly the one media rule of §6.3, and every `<a>` produced by `Button` has `class="hospeda-btn"` and inline `display:inline-block`.
- **AC-2.7** Given a Playwright render of `auth.verify-email` and `outbox.billing.grace-started` at 375px width, then the button's width equals its container's content width (±1px). At 600px, the button is narrower than its container.
- **AC-2.8** Given `verify-email`, `reset-password` and `admin-lead-received`, then their text parts are byte-identical to before PR-2 (copy unchanged).
- **AC-2.9** Given every catalog scenario, then the HOS-2519 checks still pass: under 90 KB, one `<html lang="es"`, and no `oklch(`, `var(--`, `display:flex`, `display:grid`, `<svg` or `{{`.

### US-3. Content (PR-3)

- **AC-3.1** Given every scenario with `locale === 'es'`, when its subject and text part are checked (excluding `data-raw-value` rows), then none matches the denylist. The denylist holds the English words `\b(the|your|you|and|will|access|cancellation|choose|reactivate|Hi)\b` (case-insensitive), the raw values `monthly|annual|quarterly|semiannual|subscription|addon_instance`, any `[A-Z]{3,}_[A-Z_]+` code, and any ISO timestamp `\d{4}-\d{2}-\d{2}T\d{2}:`.
- **AC-3.2** Given a scenario whose input carries a `locale`, then the scenario declares the same `locale` (completeness test).
- **AC-3.3** Given `notification.subscription_purchase` scenarios `monthly` and `annual`, then the "Período" row reads "Mensual" and "Anual". Given an unknown cycle `'weekly'`, then it reads "weekly" (D7 fallback).
- **AC-3.4** Given the 8 templates of §2.4 rendered, then no text node contains `http://` or `https://`, and each former URL is the `href` of a `Button` or `Link` with the label in §7.4.
- **AC-3.5** Given each of the 11 entries of §7.5, then the rendered HTML has at least one `a.hospeda-btn` whose `href` equals the target in the table, built from the scenario's `siteUrl`.
- **AC-3.6** Given `outbox.billing.reconciliation-summary` scenario `populated`, then each item renders as a separate block with labeled rows, no text node contains ` · `, and no text contains `COBRO_DUPLICADO` when the reason label port is present. Given the port absent, then the code appears only inside the "Motivo" row.
- **AC-3.7** Given `duplicate-charge-detected` and `mark-escalated` with `adminUrl = 'https://admin.example.com'`, then the button `href` is `https://admin.example.com/billing/reconciliation/<markId>/events`. Given `revocation-refund-failed`, it is `.../billing/reconciliation/refunds`. Given `manual-installment-unpaid`, it is `.../billing/subscriptions/<subscriptionId>`. Given `provider-watch-alert`, it is `.../billing/settings`. Given no `adminUrl`, then there is no button and the menu-path sentence is present.
- **AC-3.8** Given the four staff mails, then each renders at least 4 `InfoRow` rows, and `revocation-refund-failed` shows "Motivo del reembolso", "Origen del pago" and a currency-less amount as "(moneda no registrada)", never "centavos".
- **AC-3.9** Given `readSubjects` that throws, then the three immediate notices still render, without the Titular and Plan rows, and the failure goes to `onEnrichmentError`.
- **AC-3.10** Given `provider-watch-alert` scenario `value-changed`, then "21/11/2026 09:00" appears, the ISO `finishedAt` does not, and "authorized" and "pending" appear only inside `data-raw-value` cells.
- **AC-3.11** Given `apps/api`'s `resolveReasonLabel`, then `COBRO_DUPLICADO` → "Cobro duplicado" and an unknown code → `null`.

### US-4. User layout (PR-4)

- **AC-4.1** Given `EmailLayout` with `variant="staff"` and fixed children, then its HTML equals the inline snapshot captured from the pre-PR-4 `EmailLayout` in the first commit of PR-4.
- **AC-4.2** Given every catalog scenario, then `data-layout-variant` equals the entry's `audience`.
- **AC-4.3** Given a user scenario, then the HTML has the header `<img>` with `src` ending in `/email/hospeda-header-user@2x.png`, `width="600"`, `height="120"` and `alt="Hospeda"`. With `configureEmailAssets({ siteUrl: 'https://staging.hospeda.com.ar' })`, the `src` starts with that origin. No `.svg` appears.
- **AC-4.4** Given a user scenario, then the footer contains 4 social links whose `href`s equal `BRAND_SOCIAL_PROFILES` URLs in order, each wrapping a `.png` `<img>` with explicit `width`/`height` and non-empty `alt`. It also contains the two brand lines verbatim, the `hospeda.com.ar` link and "© ". "Gestioná tus avisos" links to `https://hospeda.com.ar/es/mi-cuenta/preferencias/`, except for the frozen no-account set (§8.3), which has no preferences link.
- **AC-4.5** Given a staff scenario, then there is no social row, no "Gestioná tus avisos" and no header image other than the logo.
- **AC-4.6** Given any scenario, then the text part contains no social icon URL, no header asset URL and no logo URL. A user scenario's text part contains "Gestioná tus avisos".
- **AC-4.7** Given every scenario, then the AC-2.9 checks pass with PR-4 in place, including under 90 KB.
- **AC-4.8** Given the staging smoke, then `auth.verify-email`, `outbox.billing.grace-started` and one staff mail are received and checked in Gmail web, Gmail Android or iOS (light and dark), Outlook desktop (Windows), Outlook web and Apple Mail iOS (light and dark). The header, the social icons, the full-width mobile button and the unchanged staff layout are confirmed, and the result is recorded as a sign-off comment.
- **AC-4.9** Given `apps/web`, then `SOCIAL_PROFILES` still exports the same 5 platforms in the same order, built from `BRAND_SOCIAL_PROFILES` plus whatsapp, and the existing web social and whatsapp guards pass.
- **AC-4.10** Given HOS-2565's Linear comments, then an owner approval of the §8.6 draft exists before PR-4 is marked ready for review.

## 11. Risks

| # | Risk | Mitigation |
|---|---|---|
| R-1 | PR-2 and PR-4 change the look of every mail at once | PR-2 is reviewed in the previewer (no text change). PR-4 goes through the design gate (§8.6) and AC-4.1 freezes the staff layout. Staging smoke (AC-4.8) |
| R-2 | The `<style>` block is stripped, or rejected whole because of one bad rule | One rule only (AC-2.6). The fallback is today's content-width button |
| R-3 | Assets live on the web deployment, so the new header and icons show only after web deploys that environment | Same mechanism as HOS-2540. The blocked-image fallback is a colored band plus the alt wordmark. The smoke runs after the web deploy |
| R-4 | Dark mode in Gmail apps renders a light header on a dark card | Accepted residual (§8.4), checked in AC-4.8 |
| R-5 | The codemod of ~58 Button imports, plus `@repo/email` gaining `@repo/config`, leave a stale `dist` (`undefined` exports in notifications tests) | Build `@repo/config` and `@repo/email` after pulling. Turbo `^build` orders CI. Run the guards (`pnpm check:guards`) before the PR |
| R-6 | Moving the social URLs out of `lib/constants.ts` trips web guards that expect them hard-coded there (`outbound-href-sanitization.test.ts:128-130`) | AC-4.9. Update that guard's allowlist reason in the same PR |
| R-7 | Translating 3 subjects touches `SUBJECT_PATTERNS`, which `subject-placeholders.test.ts` and `subject-coverage.guard.test.ts` cover | Same placeholders. Run both suites |
| R-8 | Snapshot tests and e2e mail-capture assertions on layout or button markup break | Update snapshots with the visual diff reviewed. Grep `apps/e2e` for "Administrar preferencias" and button styles before PR-4 |
| R-9 | The Spanish denylist gives false positives (for example a listing name in English in sample data) | Sample data is fictional and Spanish. A false positive is fixed in the sample, never by widening the denylist without review |
| R-10 | Enriching the staff mails adds a DB read at send time | Same batched reader as the summary, optional, never blocks (AC-3.9) |
| R-11 | The "Gestioná tus avisos" link promises control the page does not give for most mails (§2.6) | Neutral wording (it does not say "darte de baja"). OQ-1 |

## 12. Open questions for the owner

- **OQ-1 The "Gestioná tus avisos" link on mails the page does not control.** Today `/es/mi-cuenta/preferencias/` only governs the AI questions digest and the newsletter (§2.6). Options:
  1. **(Recommended)** Show it on every user mail with an account holder, as requested. The neutral wording promises nothing it cannot do, and `packages/email/CLAUDE.md`'s rule is updated to say so. Wiring the page to `PreferenceService` becomes a follow-up issue.
  2. Show it only on the mails the page controls today (just the AI digest), until the follow-up lands.
- **OQ-2 Where the design draft is reviewed.** Options:
  1. **(Recommended)** Screenshots plus HTML from the PR-4 branch, posted on HOS-2565 (D15). There is no extra PR, and unapproved design never reaches staging.
  2. An extra small PR that ships the user variant behind a preview-only switch in the staging previewer, so the owner can click through all 112 user mails himself. It costs one more PR and a dormant code path in production until PR-4 flips it.

## 13. Implementation plan: PR split

| PR | Content | Visual change to real emails? |
|---|---|---|
| **PR-1** audience | `audience` type and field on all 125 entries; audience test; schema and service mapping; previewer filter and badge; i18n es/en/pt; AI cost docblock (US-1) | No |
| **PR-2** callout and button | Palette roles and contrast test; `Callout` and `Button` in `@repo/email`; layout `<style>` media rule; Button codemod; ~50 callout migrations; auth and admin-lead migration; two guards; catalog-wide border check (US-2) | **Yes**: callouts become visible and buttons become full width on mobile. No copy change |
| **PR-3** content | Translations and three subjects; cycle helper; label maps and reason port; `formatDateTime`; scenario `locale`; URL conversions; 11 CTAs plus the shared account paths; summary restructure; four staff rewrites and renderer enrichment; follow-up issues (manual installment deep link, the 3 producer-less templates) (US-3) | **Yes**: copy and structure. Every new or changed string is listed in the PR description for sign-off |
| **PR-4** user variant | Design gate (§8.6) first; `variant`; composite header and social assets; `resolveEmailAssetUrl`; `BRAND_SOCIAL_PROFILES` in `@repo/config` plus web refactor; footer; `variant="staff"` on 13 templates; no-account `footerLink` set; docs (`packages/email/CLAUDE.md`, `packages/notifications/docs/guides/email-templates.md`, `.claude/skills/hospeda-email/SKILL.md`) (US-4) | **Yes**: every user mail. Staff mails unchanged (AC-4.1) |

- Order: PR-1 → PR-2 → PR-3 → PR-4. Each PR targets `staging`.
- PR titles carry `[HOS-2565]`. Spot-check the issue's Linear state after each open and each merge, since the title automation moves it.
- Only PR-4 carries `Closes HOS-2565`.
- If PR-2 or PR-3 passes ~1,500 changed lines, split by domain (billing / everything else) without changing the order.

**Smoke** (`status-needs-smoke-staging`), after each PR is deployed to staging (API and web):

1. After PR-1: open `/platform/emails`, switch "Todos / Usuarios / Staff", and confirm the counts (125 / 112 / 13) and the Staff badge. Switch the admin locale to en and pt.
2. After PR-2: in the previewer, check one callout of each tone and the button at 600px and 375px. Trigger a password reset to a real inbox and check the button on a phone.
3. After PR-3: in the previewer, check the 4 staff mails, the reconciliation summary and the three translated mails. On staging, trigger a grace or signup-declined mail if a sandbox flow allows it, and confirm the CTA opens Mi Suscripción.
4. After PR-4: run the AC-4.8 client matrix, confirm the social links open the right profiles and "Gestioná tus avisos" opens the preferences page (login required), and confirm a staff mail looks as before.

Sign-off goes in a `<!-- smoke-signoff v1 -->` comment on HOS-2565 (`/smoke HOS-2565` or the `smoke-tanda` skill).

## 14. Linear

Canonical tracking:
HOS-2565
