---
title: One improved email layout, a central template catalog and an admin email previewer
linear: HOS-2519
statusSource: linear
created: 2026-11-20
type: feature
smoke:
  - staging
areas:
  - admin
  - api
  - content
---

# One improved email layout, a central template catalog and an admin email previewer

## 1. Summary

Stage 1 of making Hospeda's emails editable. Four deliverables, all owner-approved:

1. **One layout.** Merge `@repo/email`'s `BaseLayout` (2 auth emails) and `@repo/notifications`' `EmailLayout` (115 template files) into a single `EmailLayout` and delete the duplicate.
2. **A better layout.** Logo image, colors derived from `@repo/design-tokens`, a stronger header and footer, mobile-friendly and email-client-safe. Fix the broken footer link (§2.3).
3. **A central template catalog.** One typed list of every email the platform can send, across all send paths. Each entry has a key, a name, a domain, 1..N sample scenarios and a render function that reuses the production component and the production subject code. A guard keeps it complete.
4. **An admin previewer, not an editor.** An admin page lists every catalog entry, grouped and filterable by domain. It shows the rendered subject and HTML body (desktop/mobile width) for a chosen scenario. The HTML is rendered on the server by an admin endpoint through the real pipeline and gated by a new permission.

### 1.1 Out of scope (non-goals)

| Item | Why |
|---|---|
| Editing templates or the layout from the admin | Stage 2 (owner's "option 1": DB-editable templates). The catalog is shaped so stage 2 can reuse it (§6.6), but stage 2 is not designed here |
| Storing templates in the DB | Stage 2 |
| Changing any template body copy, or any subject | Copy is owner-approved (legal and billing). The only text changes are the layout's own header/footer (§6.2, listed for sign-off) |
| i18n of email copy | Most templates are Spanish-only; the few localized outbox mails stay as they are (§2.6) |
| Changing send behaviour (who, when, which transport, retries, preferences) | Preview only. The previewer never sends |
| A tokenized one-click unsubscribe | Separate feature if wanted (rejected for this spec in OQ-2) |
| A "send me a test email" button | Not requested; real-client checks happen in the staging smoke (§11) |
| Wiring the newsletter double opt-in emails | Found unwired (§2.6); a separate issue, not this spec |

## 2. Current baseline (verified on `origin/staging`, 2026-11-20)

### 2.1 Two layouts, no dependency between the packages

- `packages/email/src/templates/base-layout.tsx`: `BaseLayout({ children, showUnsubscribe = true })`. No `<Preview>`, no `lang`, white header with text "Hospeda", footer "Hospeda - Alojamientos turísticos en Concepción del Uruguay y el Litoral", unsubscribe link to `https://hospeda.com.ar/unsubscribe` (no such web page exists). Its only users are `reset-password.tsx` and `verify-email.tsx`, and both pass `showUnsubscribe={false}`.
- `packages/notifications/src/templates/components/layout.tsx`: `EmailLayout({ previewText, children, showUnsubscribe = false })`. `<Html lang="es">`, `<Preview>`, dark header `#1e293b` with text logo "Hospeda" and tagline "Turismo en el Litoral", footer "Hospeda - Turismo en el Litoral" plus one description line. All 115 `.tsx` template files under `templates/` (minus `components/`) import it. No consumer outside the package imports either layout.
- `@repo/email` depends only on `@repo/logger` and `@react-email/*`. `@repo/notifications` depends on `@repo/config`, `@repo/db`, `@repo/logger`, `@repo/utils` and `@react-email/*`. **Neither depends on the other**. `apps/api` depends on both. `@repo/service-core` depends on neither, by design: the newsletter dispatcher contract says "email-template imports stay out of `@repo/service-core`" (`packages/service-core/src/services/newsletter/newsletter-subscriber.service.ts:96-101`).
- Rendering uses `render` from `@react-email/render` (not `@repo/react-email`). Both transports render twice from the same element: HTML, then `render(react, { plainText: true })` as the `textContent` part (HOS-2107): `packages/email/src/send.ts` and `packages/notifications/src/transports/email/resend-transport.ts:43-46`. Transport is Brevo REST in both; "resend" in file and class names is legacy.

### 2.2 Six send paths, not three

| Path | Where the template is chosen | Where the subject is built | Count |
|---|---|---|---|
| **notification** | `NotificationService.selectTemplate` (private, `notification.service.ts:353`, 49 `case` labels, 48 branches) | `generateSubject` (private, `:937`) over `buildSubjectData` + `getSubject` (`utils/subject-builder.ts`, `SUBJECT_PATTERNS: Record<NotificationType, string>`) with the unresolved-placeholder fallback (H-64/H-75) | 49 of the 55 `NotificationType` values |
| **outbox** | renderer registry composed in `apps/api/src/cron/jobs/email-outbox-sender.job.ts:94-153` (`buildOutboxSenderRender`) from 19 `create*Renderers` factories in `packages/notifications/src/services/outbox/*-renderers.tsx`. `OUTBOX_MAIL_RENDERERS` itself is empty on purpose | each renderer returns `{ subject, react }` (`OutboxMailRenderer`, `email-outbox-delivery.service.ts:74-82`) | 64 template keys (`billing.*`, `verticals.*`, listing keys, and 9 trial keys that reuse `NotificationType` values) |
| **auth** | `apps/api/src/lib/auth.ts:327-331, 411-415` (`ResetPasswordTemplate`, `VerifyEmailTemplate` from `@repo/email`) | string literals inline in `auth.ts` | 2 |
| **conversation** | `apps/api/src/lib/conversation-mailer.ts:81,114`, `apps/api/src/cron/jobs/conversation-notification.resolve.ts:169-191`, `conversation-token-reminder.job.ts:419-435` (templates from `@repo/notifications`) | string literals and template literals inline in `apps/api` | 6 (verify, access link, new message, new message anon, token day 15, token day 25) |
| **alert-digest** | `packages/notifications/src/services/channels/email-alert.channel.tsx:72-77` (`AlertDigestEmail`) | `DIGEST_SUBJECT_BY_LOCALE` in the same file | 1 |
| **newsletter** | `apps/api/src/services/newsletter/delivery-factory.ts:148-157` (`NewsletterCampaign`) | the campaign's own `subject` (data) | 1 |

Six `NotificationType` values have no `selectTemplate` case: `trial_ending_2d`, `trial_ending_today`, `trial_win_back_15d` (sent only through the outbox) and `newsletter_verification`, `newsletter_welcome`, `newsletter_campaign`. Six trial types exist in **both** the notification and outbox paths with different prop mappings, so a catalog key must name the path (§7.1).

All `apps/api` sends through `@repo/email` go through `sendAppEmail` (`apps/api/src/utils/email-sender.ts`), which prefixes the subject with `[STAGING] ` outside production; `apps/api/test/utils/email-sender.guard.test.ts` enforces that.

### 2.3 The unsubscribe link is broken in production today

`EmailLayout` renders `href="{{unsubscribe_url}}"` when `showUnsubscribe` is true (`layout.tsx:57`). `rg "unsubscribe_url"` over the whole repo finds only that line and tests asserting the text is absent or present. Nothing substitutes it: both transports post the rendered `htmlContent` to Brevo `/smtp/email` with no `params`, and `{{unsubscribe_url}}` is not a Brevo transactional placeholder anyway. **15 templates ship that literal link to real inboxes**: 12 trial templates (`trial-ending-*`, `trial-win-back-*`, `trial-ending-reminder`), `billing/renewal-reminder.tsx`, and the two anonymous-guest `conversation-token-expiring-day15/25.tsx`. The link text is "Administrar preferencias de notificaciones". A logged-in preferences page exists at `apps/web/src/pages/[lang]/mi-cuenta/preferencias/index.astro` (`PreferenceToggles`). `NewsletterCampaign` carries its own per-recipient unsubscribe URL in its body (`newsletter-campaign.tsx`) and does not use the layout link.

### 2.4 Design tokens are OKLCH; email needs hex

`@repo/design-tokens` exports OKLCH palettes (`river`, `forest`, `sand`, `accent`, `neutral`, …, `src/tokens/colors.ts`) and theme records of CSS custom properties. The OKLCH→sRGB converter (`formatSRGB`, `src/generators/srgb.ts`) is build-time only: it uses `culori` (a devDependency) and outputs `rgb(r g b)` space syntax, which Outlook does not parse. Email clients need hex literals in inline styles. Today only `apps/web` and `apps/admin` depend on the package.

### 2.5 Logo assets

No email-ready logo exists. `apps/web/src/assets/images/logo.webp` is bundled by Astro (hashed URL, and WebP is not supported by Outlook desktop). `apps/admin/src/logo.svg` is a template leftover (`apps/api/src/utils/qr-center-logo.ts:29-30` says so). `apps/web/public/` holds only favicons (`android-chrome-512x512.png`, the isotype). SVG is not safe in email (Gmail strips it).

### 2.6 Other findings that shape the design

- **Some outbox copy is already localized**: `resolveManualInstallmentMailCopy`, `resolveLatePaymentRefundMailCopy`, `resolveOneTimeAddonActivatedMailCopy` and `resolvePartnerMailCopy` (`apps/api/src/utils/*-mail-copy.ts`) use `trans` from `@repo/i18n`, and conversation and alert-digest templates take a `locale`. So "Spanish-only" holds for most templates, not all. Scenarios may carry a locale (§7.1).
- Some outbox renderers need runtime readers: `readListingNames`, `readReconciliationSubjects` (DB reads) and `issuePartnerClaimSecret`, which **writes** a claim secret. A preview must inject fakes, never the defaults (`buildOutboxSenderRender` already accepts them as inputs).
- **The newsletter verify and welcome emails are never sent.** Both routes build `NewsletterSubscriberService` without a dispatcher (`apps/api/src/routes/newsletter/protected/_singletons.ts:46-52`, same in `profile/protected`), so the `NO_OP_DISPATCHER` runs. The templates and subjects exist. To be reported as a separate issue, not fixed here.
- Template fixtures are inline in each test file (`packages/notifications/test/templates/*.test.tsx`, `test/services/outbox/*.test.tsx`); none are exported. `test/services/subject-placeholders.test.ts` already exercises the real subject path per type.
- Admin has `CampaignPreview.tsx` (`apps/admin/src/routes/_authed/newsletter/campaigns/-components/`): a fake 600px email chrome around TipTap HTML injected through DOMPurify. It is not reusable for full email documents (it adds its own footer, and full documents must be isolated in an iframe), but its chrome styling can be borrowed.
- The admin CSP is report-only and allows `img-src https:` (`apps/admin/src/lib/csp-helpers.ts:91`), so a remote logo loads inside a `srcdoc` iframe.
- Stale docs: `packages/email/CLAUDE.md` says Resend and documents `BaseLayout`; `.claude/skills/hospeda-email/SKILL.md` says "reutilizá `BaseLayout`"; `packages/notifications/docs/guides/email-templates.md` documents `showUnsubscribe`.

## 3. Goals

- **G-1** A single `EmailLayout` renders every Hospeda email. No second layout implementation remains.
- **G-2** The layout uses a hosted logo and design-token colors, renders correctly in Gmail (web, Android, iOS), Outlook (desktop and web), and Apple Mail (macOS and iOS), works at 320px width, and keeps a readable text/plain part.
- **G-3** No email ships a broken footer link.
- **G-4** One catalog lists every email across the six send paths. Each entry renders through the same component and subject code production uses. A test fails when an email exists without an entry and at least one scenario.
- **G-5** An admin with the new permission previews any entry and scenario (subject plus HTML, desktop/mobile) without sending anything.

## 4. Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | The unified `EmailLayout` lives in **`@repo/email`**. `@repo/notifications` gains a dependency on `@repo/email`. `BaseLayout` and `notifications/src/templates/components/layout.tsx` are deleted, and the 115 imports are rewritten (mechanical codemod, no re-export shim) | No cycle: `@repo/email` depends on neither `@repo/notifications` nor `@repo/db`. `@repo/email` becomes the email presentation + Brevo send package. Alternative B (move the auth templates into `@repo/notifications`, leaving `@repo/email` as transport only) is rejected because it makes `apps/api/src/lib/auth.ts` pull the DB-backed notifications package for two static templates |
| D2 | Props keep the shape the notifications templates already use: `previewText?` (optional, because the two auth templates have none and adding one would be new copy), `children`, `footerLink?: 'preferences' \| 'none'` (default `'none'`). `showUnsubscribe` is renamed in the same codemod, since it never unsubscribed anyone | The name described a feature that does not exist (§2.3) |
| D3 | `@repo/design-tokens` gains an `emailPalette` export of **hex literals** (role → `#rrggbb`). A test inside design-tokens (where `culori` is available) asserts that each literal equals the sRGB conversion of its source token | Consumers stay `culori`-free and get Outlook-safe hex. The test blocks drift between brand and email |
| D4 | `renderEmailBodies({ react }) → { html, text }` is added to `@repo/email` and used by `send.ts`, the notifications transport and the preview | The preview must produce the HTML and text the inbox receives. One function instead of three copies |
| D5 | The catalog lives in **`@repo/notifications`** (`src/catalog/`), and entries carry their sample scenarios in the same files. Runtime-only collaborators (the outbox registry, `siteUrl`) are injected at render time by `apps/api` | Every template component and subject builder is reachable from there once D1 lands. Sample data next to the entry is what stage 2 reuses. Moving the existing inline test fixtures is optional follow-up, not required |
| D6 | Subjects are reused, never copied. `selectTemplate` and `generateSubject` are extracted into an exported pure `renderNotificationEmail`. The auth subject literals move to exported constants in `@repo/email`, and the conversation and alert-digest subjects move to exported builders next to their templates in `@repo/notifications`. Every caller switches to them with byte-identical strings | AC-4.4. The extraction also brings `notification.service.ts` (1058 lines today) closer to the 500-line rule |
| D7 | `buildOutboxSenderRender` is split: a new exported `buildOutboxRendererRegistry(input) → Record<string, OutboxMailRenderer>` holds the composition, and `buildOutboxSenderRender` wraps it with `createOutboxMailRenderer`. The preview builds the registry with fake readers and a fake, **non-writing** claim-secret issuer | The guard needs the key set (AC-4.2) and the preview needs the real renderers without DB writes (§2.6) |
| D8 | New permission `PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW = 'notification.template.preview'`. It is derived into the existing `NOTIFICATION` category by key prefix, so the `SYSTEM` fallback guard is untouched. Stage 2 would add `notification.template.update` | It follows the existing `notification.status.manage` / `notification.softDelete.view` shape. `notification` + `template` does not merge into an existing camelCase family, so the dual-spelling guard stays green. A new `EMAIL_TEMPLATE` category was rejected: it means a new category value, its labels and more frozen lists, for one permission |
| D9 | Recommended PR order: **catalog + endpoint → admin page → layout** (§12) | The owner can sign off the new layout in the previewer on staging, across all ~125 entries, before it reaches real inboxes in production |

## 5. Proposed design: layout (PR-3)

### 5.1 Structure (`packages/email/src/templates/email-layout.tsx`)

- `<Html lang="es" dir="ltr">`, `<Head>` with `<meta name="color-scheme" content="light">` and `<meta name="supported-color-schemes" content="light">` (limits dark-mode inversion in Apple Mail and Outlook.com), and `<Preview>` only when `previewText` is set.
- The body background is `emailPalette.pageBackground`. A centered `Container` (react-email emits a table) has `width="100%"` and `max-width: 600px`. Every style is inline. No flexbox, grid, CSS variables, `oklch()`, web fonts or `<style>`-dependent layout. Fluid widths, so no media query is needed at 320px.
- **Header**: a white band with a hosted PNG logo (`<Img width={140} height={…} alt="Hospeda" />`, explicit size, `display:block`, `border:0`), the tagline "Turismo en el Litoral" in `emailPalette.mutedText`, and a 4px bottom accent bar in `emailPalette.brand`. The decorative header is marked `data-skip-in-text="true"` so the text part does not start with image noise. The text part keeps the content and footer.
- **Content**: padding 32px 24px, with no typography override (the templates' own styles stay authoritative).
- **Footer**: a `Hr`, then the existing two lines verbatim ("Hospeda - Turismo en el Litoral" and "Plataforma de alojamientos turísticos en Concepción del Uruguay y la región del Litoral argentino"). Then a plain link `hospeda.com.ar` to the site home (new). When `footerLink === 'preferences'`, the link "Administrar preferencias de notificaciones" points to an absolute URL (OQ-2).
- Absolute URLs come from module constants (`EMAIL_PUBLIC_SITE_URL = 'https://hospeda.com.ar'`, `EMAIL_LOGO_URL` per OQ-1). They do not come from `siteUrl`, because templates do not pass it to the layout and threading it through 115 files is not worth it. The existing `BaseLayout` already hard-codes the production domain.

### 5.2 Colors (`packages/design-tokens/src/tokens/email-palette.ts`)

`emailPalette` is `as const`, with roles `pageBackground`, `surface`, `brand`, `brandStrong`, `text`, `mutedText`, `border`, `link`. Each role is mapped to a token (proposal: `neutral[50]`, `#ffffff`, `river[500]`, `river[700]`, `neutral[900]`, `neutral[500]`, `neutral[200]`, `river[600]`), with the final shades confirmed at visual sign-off. Each role has a JSDoc line naming its source token. Exported from the package index. `@repo/email` adds `@repo/design-tokens` as a dependency.

### 5.3 Text part

`renderEmailBodies` keeps `render(react, { plainText: true })` with default options. After the change, the text part must contain the body copy and the footer lines, and must not contain `{{`, the logo URL or the tagline.

## 6. Proposed design: catalog, endpoint, previewer

### 6.1 Extractions (no behaviour change)

- `packages/notifications/src/services/notification-render.ts`: `renderNotificationEmail({ payload, siteUrl }) → { subject, react, unresolvedPlaceholders }`. It holds the moved switch and subject logic. `NotificationService.send` calls it and keeps the error-log-and-fallback behaviour when `unresolvedPlaceholders` is non-empty. The unknown-type `default` still throws.
- `@repo/email`: `RESET_PASSWORD_EMAIL_SUBJECT = 'Restablece tu contraseña de Hospeda'` and `VERIFY_EMAIL_SUBJECT = 'Verifica tu cuenta de Hospeda'`, used by `apps/api/src/lib/auth.ts`.
- `@repo/notifications` `templates/conversation/subjects.ts`: `CONVERSATION_VERIFY_SUBJECT`, `CONVERSATION_ACCESS_LINK_SUBJECT`, `buildConversationNewMessageSubject({ accommodationName })`, `buildConversationTokenDay15Subject(...)`, `buildConversationTokenDay25Subject(...)`, used by the three `apps/api` call sites. `email-alert.channel.tsx` exports `resolveAlertDigestSubject({ locale })`.
- `apps/api/src/cron/jobs/email-outbox-sender.job.ts`: `buildOutboxRendererRegistry` (D7), moved to its own module `apps/api/src/services/email-outbox/outbox-renderer-registry.ts` so the preview does not import a cron module.

### 6.2 Catalog (`packages/notifications/src/catalog/`)

- `types.ts` (contracts, §7.1). `define-entry.ts` holds `defineEmailCatalogEntry<TInput>(...)`, which keeps scenarios typed and returns the type-erased `EmailCatalogEntry`.
- `entries/notification-<domain>.ts`: one entry per `NotificationType` with a template (49). The render calls `renderNotificationEmail`. Scenario inputs are typed `NotificationPayload` objects (`satisfies` the specific payload interface).
- `entries/outbox-<domain>.ts`: one entry per outbox key (64). A scenario input is the row `payload` (JSON) plus optional row overrides. The render builds a synthetic `EmailOutboxRow` (`buildPreviewOutboxRow`) and calls `deps.outboxRenderer`, so the renderer's own runtime validation checks the sample.
- `entries/auth.ts` (2), `entries/conversation.ts` (6), `entries/alert-digest.ts` (1), `entries/newsletter.ts`: campaign (wired) plus verify and welcome, which are marked `wired: false` (§2.6) so the UI says "sin envío en producción".
- `index.ts` exports `EMAIL_CATALOG` (a readonly array) and `findEmailCatalogEntry({ key })`. `render-scenario.ts` exports `renderEmailCatalogScenario({ key, scenarioId, deps }) → { subject, html, text, warnings }` through `renderEmailBodies`.
- Scenarios cover the real variants. Examples: billing interval monthly/annual, locale `es`/`en` where the copy resolver is localized, conditional subjects (`CONDITIONAL_SUBJECT_PATTERNS`), with and without optional sections. Each scenario has a Spanish `label`. Sample data is fictional: `@example.com` addresses, `https://hospeda.com.ar/...` links, obviously fake tokens, no real names, no secrets.
- Domains (`EmailCatalogDomain`) follow the template folders: `auth`, `billing`, `subscription`, `trial`, `listing`, `host-trade`, `alliance`, `partner`, `conversation`, `admin`, `newsletter`, `alerts`, `contact-feedback`, `ai`.
- Each file stays under 500 lines. Split by domain wherever billing grows.

### 6.3 API (`apps/api`)

- Service `apps/api/src/services/email-preview/email-preview.service.ts`. It builds `EmailCatalogRenderDeps` once per process: `siteUrl = env.HOSPEDA_SITE_URL`, and an `outboxRenderer` from `buildOutboxRendererRegistry` with fakes (`readListingNames` returns fixed names, `readReconciliationSubjects` returns fixed subjects, `issuePartnerClaimSecret` returns `'preview-claim-secret'` without I/O, `adminUrl = env.HOSPEDA_ADMIN_URL`, `environmentLabel = getEmailEnvironmentLabel()`). It exposes `listEntries()` and `render({ key, scenarioId })`. It reports `subjectPrefix` from `getEmailSender().subjectPrefix` so the UI shows what the inbox would show.
- Routes `apps/api/src/routes/email-preview/admin/{list.ts,render.ts,index.ts}`, mounted at `/api/v1/admin/email-previews`, built with `createAdminRoute` and `requiredPermissions: [PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW]`:
  - `GET /api/v1/admin/email-previews`: the whole catalog summary, unpaginated (~125 small rows, a static list; `createAdminListRoute`'s `page`/`pageSize` contract does not fit a non-DB list).
  - `GET /api/v1/admin/email-previews/render?key=…&scenarioId=…`
- Error order per `apps/api/docs/error-contract.md`: 401 guest → 403 without admin access or without the permission → 400 `VALIDATION_ERROR` for a bad query shape → 404 `NOT_FOUND` for an unknown key or scenario → 500 `INTERNAL_ERROR` when a sample fails to render (a bug that the CI render test prevents). The 500 body never echoes the error message (R1b). The failure is logged with key and scenario.
- No caching header. Read-only: no DB write, no send, no outbox row.

### 6.4 Admin (`apps/admin`)

- Route `apps/admin/src/routes/_authed/platform/emails/index.tsx`, wrapped in `RoutePermissionGuard permissions={[PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW]}`. Sidebar link `id: 'email-previews'` in the `config-general` group of `plataformaSidebar` (`apps/admin/src/config/ia/sidebars.ts`), with the same permission (the route gate and the menu gate must match, as in HOS-981). The group's `permissions` list must include it, or the group hides.
- Hooks `apps/admin/src/hooks/use-email-previews.ts`: `useEmailPreviewList()` and `useEmailPreviewRender({ key, scenarioId })` (TanStack Query through `fetchApi` in `apps/admin/src/lib/api/client.ts`).
- Components under `routes/_authed/platform/emails/-components/`: `EmailCatalogList` (search box, domain filter, send-path badge, "sin envío en producción" badge), `EmailPreviewPane` (subject line with prefix, scenario `<select>` shown only when there are 2+ scenarios, a desktop 600px / mobile 375px toggle, and an `<iframe srcDoc={html} sandbox="">` with no `allow-scripts` and no `allow-same-origin`), and a collapsible "Texto plano" panel showing `text`.
- Page chrome copy goes through `@repo/i18n` (`packages/i18n/src/locales/{es,en,pt}/admin-pages.json`, `emailPreviews.*`). The email content itself is not translated. Tailwind + Shadcn only.

### 6.5 Permission, migration and seeding

- `packages/schemas/src/enums/permission.enum.ts`: add `NOTIFICATION_TEMPLATE_PREVIEW = 'notification.template.preview'` next to the `NOTIFICATION_*` block.
- `pnpm db:generate` produces `ALTER TYPE "public"."permission_enum" ADD VALUE 'notification.template.preview'` (precedent: `0216_hos1498_partner_empty_presence.sql`).
- Seed dual-write (the CLAUDE.md rule applies, because `role_permission` rows are required seed data in live envs). The baseline is `packages/seed/src/required/rolePermissions.seed.ts`, and a data-migration is created with `pnpm db:seed:make hos2519-email-template-preview` (next free number, today after `0188`). It grants `SUPER_ADMIN` and `ADMIN` with `onConflictDoNothing` (precedent: `0145-hos1498-partner-empty-presence.ts`). Roles per OQ-3.
- Run order on live envs: `db:migrate` → `db:apply-extras` → `db:seed:migrate`. The migration only adds an enum value, so there is no expand/contract issue.

### 6.6 What stage 2 reuses

The catalog `id` is the stable template identity a future DB row would key on. `name`, `domain` and `scenarios` feed an editor's list and its live preview, and `renderEmailCatalogScenario` is the preview pipeline an editor would call. Stage 2 would swap the component behind an entry for a DB-sourced one. Nothing here commits to how.

## 7. Contracts

### 7.1 Catalog types (`packages/notifications/src/catalog/types.ts`)

```ts
import type { ReactElement } from 'react';
import type { OutboxMailRenderer } from '../services/outbox/email-outbox-delivery.service.js';

/** Production path that sends the email. */
export type EmailSendPath = 'notification' | 'outbox' | 'auth' | 'conversation' | 'alert-digest' | 'newsletter';

/** Grouping shown in the admin previewer. */
export type EmailCatalogDomain =
    | 'auth' | 'billing' | 'subscription' | 'trial' | 'listing' | 'host-trade' | 'alliance'
    | 'partner' | 'conversation' | 'admin' | 'newsletter' | 'alerts' | 'contact-feedback' | 'ai';

/** One named sample input for an entry. */
export interface EmailScenario<TInput> {
    readonly id: string; // kebab-case, unique within the entry
    readonly label: string; // Spanish, shown in the admin
    readonly input: TInput;
}

/** Runtime collaborators injected by the host app. */
export interface EmailCatalogRenderDeps {
    readonly siteUrl: string;
    readonly outboxRenderer: OutboxMailRenderer;
}

/** Output of rendering one scenario, before HTML/text serialization. */
export interface EmailCatalogRendered {
    readonly subject: string;
    readonly react: ReactElement;
    readonly warnings: readonly string[]; // e.g. 'subject-fell-back-to-generic'
}

/** Type-erased catalog entry (built only through defineEmailCatalogEntry). */
export interface EmailCatalogEntry {
    readonly key: `${EmailSendPath}.${string}`; // e.g. 'outbox.billing.renewal-upcoming'
    readonly id: string; // NotificationType value, outbox template key, or path-local id
    readonly sendPath: EmailSendPath;
    readonly name: string; // Spanish human name
    readonly domain: EmailCatalogDomain;
    readonly wired: boolean; // false: template exists, no production sender
    readonly scenarios: readonly { readonly id: string; readonly label: string }[];
    readonly renderScenario: (input: {
        readonly scenarioId: string;
        readonly deps: EmailCatalogRenderDeps;
    }) => Promise<EmailCatalogRendered>;
}
```

`defineEmailCatalogEntry<TInput>({ ..., scenarios: readonly [EmailScenario<TInput>, ...EmailScenario<TInput>[]], render: (input: { scenario: TInput; deps }) => EmailCatalogRendered | Promise<EmailCatalogRendered> })` enforces at least one scenario at the type level and rejects duplicate scenario ids at module load.

### 7.2 API schemas (`packages/schemas/src/api/email-preview/email-preview.schema.ts`)

```ts
export const EmailSendPathSchema = z.enum(['notification', 'outbox', 'auth', 'conversation', 'alert-digest', 'newsletter']);
export const EmailCatalogDomainSchema = z.enum([/* the 14 domains of §7.1 */]);

export const EmailPreviewEntrySummarySchema = z.object({
    key: z.string().min(1),
    id: z.string().min(1),
    sendPath: EmailSendPathSchema,
    name: z.string().min(1),
    domain: EmailCatalogDomainSchema,
    wired: z.boolean(),
    scenarios: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1)
});
export const EmailPreviewListResponseSchema = z.object({
    entries: z.array(EmailPreviewEntrySummarySchema),
    total: z.number().int().nonnegative()
});

export const EmailPreviewRenderQuerySchema = z.object({
    key: z.string().min(1).max(200),
    scenarioId: z.string().min(1).max(100)
});
export const EmailPreviewRenderResponseSchema = z.object({
    key: z.string(),
    scenarioId: z.string(),
    subject: z.string(), // exactly what the production path builds, without the env prefix
    subjectPrefix: z.string().nullable(), // '[STAGING] ' outside production, else null
    html: z.string(),
    text: z.string(),
    warnings: z.array(z.string())
});
```

The types are inferred with `z.infer` and exported. The catalog types in §7.1 stay in `@repo/notifications` because they reference React and renderers. The API surface uses only the Zod shapes.

## 8. UX / UI behaviour

- The page opens with the full list on the left (desktop) or on top (mobile), grouped by domain, with each entry's name and send path. The first entry is selected.
- Search filters by name, key or id (case- and accent-insensitive, client-side). The domain filter is a multi-select. The count shows "N de M".
- Selecting an entry renders its first scenario. Changing the scenario or width does not refetch on width change: width only resizes the iframe.
- Loading shows a skeleton in the pane. An error shows "No se pudo generar la vista previa" with a retry button, and the list stays usable.
- The iframe has a fixed 900px height with internal scroll. Auto-height would need `allow-same-origin` to read `contentDocument`, which AC-7.5 forbids. Links in the preview do not navigate the admin.

## 9. Acceptance criteria

### US-1. One layout (PR-3)

- **AC-1.1** Given the repo after PR-3, then `packages/email/src/templates/base-layout.tsx` and `packages/notifications/src/templates/components/layout.tsx` do not exist, `rg "BaseLayout" packages/email packages/notifications` finds nothing, and every template imports `EmailLayout` from `@repo/email`.
- **AC-1.2** Given any catalog scenario rendered to HTML, then the document contains exactly one `<html lang="es"`, the logo `<img` with `alt="Hospeda"` and explicit `width`, the footer line "Hospeda - Turismo en el Litoral", and no `oklch(`, `var(--`, `display:flex`, `display:grid` or `<svg`.
- **AC-1.3** Given `ResetPasswordTemplate` and `VerifyEmailTemplate`, then they render inside `EmailLayout` with `footerLink='none'`, and their body copy is byte-identical to before (existing `packages/email/test/templates/*` assertions pass unchanged except layout-specific ones).
- **AC-1.4** Given `emailPalette`, then every value matches `/^#[0-9a-f]{6}$/`, and a design-tokens test asserts each one equals the hex of `formatSRGB(<source token>)`.

### US-2. No broken footer link (PR-3)

- **AC-2.1** Given any rendered scenario, then its HTML contains no `{{` and no `unsubscribe_url` (catalog-wide test).
- **AC-2.2** Given a template with `footerLink='preferences'`, then the link href is the absolute URL OQ-2 decides and the link text is "Administrar preferencias de notificaciones".
- **AC-2.3** Given the outcome of OQ-2 for anonymous-guest emails, then `conversation-token-expiring-day15/25` render with `footerLink='none'` (no preferences link).

### US-3. Email-client safety (PR-3)

- **AC-3.1** Given a render at 320px viewport width (Playwright screenshot of the HTML in a test page, or manual), then there is no horizontal scroll and the logo scales down.
- **AC-3.2** Given the text part of any scenario (`renderEmailBodies(...).text`), then it is non-empty, contains the footer brand line, and does not contain `EMAIL_LOGO_URL` or the tagline.
- **AC-3.3** Given the staging smoke, then reset-password, one trial reminder (with footer link) and one billing outbox mail are received and visually checked in Gmail web, Gmail Android or iOS, Outlook desktop (Windows), Outlook web and Apple Mail iOS, with the logo visible and the layout intact. The result is recorded as a sign-off comment.

### US-4. Catalog completeness and fidelity (PR-1)

- **AC-4.1** Given `Object.values(NotificationType)`, then each of the 49 values that `renderNotificationEmail` supports has a `notification.<value>` entry. The other 6 are covered elsewhere and listed in the test as an explicit, frozen exception map: `trial_ending_2d`, `trial_ending_today` and `trial_win_back_15d` map to `outbox.<value>`, and the three newsletter values map to `newsletter.*`. A new enum value with neither an entry nor an exception fails the test.
- **AC-4.2** Given `Object.keys(buildOutboxRendererRegistry(fakes))`, then the set equals the set of catalog `outbox.*` ids exactly (missing and stale both fail). This test lives in `apps/api`.
- **AC-4.3** Given the catalog, then the auth (2), conversation (6), alert-digest (1) and newsletter (3) entries exist, keys are unique, each entry has 1+ scenarios with unique ids, and every name and label is non-empty.
- **AC-4.4** Given every scenario of every entry, when rendered through the `apps/api` preview service with fakes, then it resolves without throwing, the subject is non-empty and contains no `{placeholder}`, `warnings` is empty, and HTML and text are non-empty. Rendering all scenarios is one test in `apps/api`.
- **AC-4.5** Given the D6 extractions, then `NotificationService.send` hands the transport the same `subject` and the same element type as before for each type (the existing `subject-placeholders.test.ts` and `notification.service*.test.ts` pass unedited). The `auth.ts`, conversation and alert-digest call sites pass byte-identical subjects (unit tests on the extracted constants and builders against the old literals).
- **AC-4.6** Given the preview service, then `issuePartnerClaimSecret`, `readListingNames` and `readReconciliationSubjects` are the fakes: a test asserts that a preview of `outbox.verticals.partner-claim-notice` performs no DB call (the `@repo/db` mock records zero calls).

### US-5. Admin endpoint (PR-1)

- **AC-5.1** Given a guest, when calling either endpoint, then 401. Given an admin-panel user without `NOTIFICATION_TEMPLATE_PREVIEW`, then 403. Given an actor with it, then 200 and the body parses with the response schema.
- **AC-5.2** Given `GET /render` with no `key`, then 400 `VALIDATION_ERROR`. Given an unknown `key`, or a known key with an unknown `scenarioId`, then 404 `NOT_FOUND`.
- **AC-5.3** Given a renderer that throws (forced in a test), then 500 `INTERNAL_ERROR`, the body does not contain the thrown message, and the error is logged with key and scenario id.
- **AC-5.4** Given `GET /api/v1/admin/email-previews`, then `total` equals `EMAIL_CATALOG.length` and `entries` keeps catalog order.
- **AC-5.5** Given a render on staging, then `subjectPrefix` is `'[STAGING] '`. On production it is `null`.

### US-6. Permission (PR-1)

- **AC-6.1** `PermissionEnum.NOTIFICATION_TEMPLATE_PREVIEW === 'notification.template.preview'`, and its derived category is `NOTIFICATION`.
- **AC-6.2** A committed migration adds the enum value. `rolePermissions.seed.ts` and the new data-migration grant it to the OQ-3 roles. The migration is idempotent (`onConflictDoNothing`) and has a test in `packages/seed/test/data-migrations/`.
- **AC-6.3** The frozen guards in R-4 are updated in the same PR and pass.

### US-7. Admin previewer (PR-2)

- **AC-7.1** Given an admin with the permission, then "Emails" appears in Plataforma → Configuración general and `/platform/emails` loads the list with all entries and the count. Given one without it, the link is hidden and the route shows the guard's no-access state.
- **AC-7.2** Given the search "renov", then only entries whose name, key or id match remain (accent- and case-insensitive). Given a domain filter, only those domains show.
- **AC-7.3** Given an entry with 2+ scenarios, then the scenario selector is shown and switching re-renders. Given one scenario, no selector is shown.
- **AC-7.4** Given the width toggle, then the iframe is 600px or 375px wide with no refetch.
- **AC-7.5** The iframe has `sandbox=""` (no `allow-scripts`, no `allow-same-origin`) and receives the HTML through `srcDoc`.
- **AC-7.6** The subject line shows `subjectPrefix + subject`, and the plain-text panel shows `text`.
- **AC-7.7** Entries with `wired: false` show the "sin envío en producción" badge.

## 10. Risks

| # | Risk | Mitigation |
|---|---|---|
| R-1 | The layout change alters every email at once, including owner-approved legal and billing mails | Body copy untouched (AC-1.3, AC-4.5); D9 order allows sign-off in the previewer first; staging smoke across clients (AC-3.3); the footer text changes are listed in §5.1 for explicit sign-off |
| R-2 | Outlook desktop (Word engine) breaks rounded corners, padding on `<a>`, `max-width` | Table layout from react-email, explicit `width` attributes on image and container, no reliance on `border-radius` for structure; checked in AC-3.3 |
| R-3 | A new dependency `@repo/notifications` → `@repo/email` resolves through `dist`, so a stale build makes `EmailLayout` `undefined` in notifications tests | Turbo `^build` orders it. Note in the PR: build `@repo/email` after pulling. Check that `apps/api/test/scripts/tsx-jsx-coverage.guard.test.ts` still passes, since tsx scripts reach notifications source that now imports `@repo/email` |
| R-4 | A new `PermissionEnum` value trips frozen inventories | Run and update: `packages/schemas/test/enums/permission-naming-convention.guard.test.ts` (should stay green, per D8), `packages/schemas/test/utils/permission-system-fallback.guard.test.ts` (green when the category is derived), `packages/schemas/test/enums/permission.enum.test.ts`, `packages/schemas/test/utils/permission-grouping.test.ts`, `apps/admin/test/config/ia/{permission-bundles,role-acceptance.admin-super,sidebars}.test.ts`, `apps/api/test/integration/super-admin/exclusive-permissions.test.ts`, and the admin IA config tests under `apps/admin/src/config/ia/__tests__/`. Run the whole guard set (`pnpm check:guards`) before the PR |
| R-5 | The preview calls a renderer default that writes (`issuePartnerClaimSecret`) or reads the DB | D7 + AC-4.6 |
| R-6 | Sample data drifts from what producers really send (a scenario passes but a real payload would not) | Outbox scenarios go through the renderer's runtime validation. Notification scenarios are typed by the payload interfaces. Each entry's scenarios must cover the variants the template branches on (review checklist) |
| R-7 | The logo is hosted on the production domain (OQ-1), so it is not live while staging tests the new layout, and the owner's visual sign-off in the previewer would happen without it | The `alt="Hospeda"` text is styled so a missing image still reads as a brand mark. To sign off with the real logo, the PNG can ship in a tiny standalone PR ahead of PR-3 and ride the next `staging → main` promotion (the promotion stays the owner's call). Otherwise the logo is checked in production right after the promotion that carries PR-3 |
| R-8 | Gmail clips messages over 102 KB; the new header adds bytes | Keep the layout lean. A catalog test asserts every rendered HTML is under 90 KB |
| R-9 | Snapshot tests (`components.test.tsx`, `billing-chargeback-renderers.test.tsx`) and e2e mail-capture assertions on header text break | Update snapshots in PR-3 with the visual diff reviewed. Grep `apps/e2e` for layout strings ("Turismo en el Litoral") before the PR |
| R-10 | `notification.service.ts` extraction changes behaviour subtly (e.g. the `siteUrl` closure) | AC-4.5: existing service tests unedited are the gate |
| R-11 | The dark-mode inversion in Gmail apps recolors the white header | `color-scheme: light` meta. Accepted residual: Gmail iOS ignores it; the logo PNG gets a transparent-safe or white-backed variant |
| R-12 | Admin-page HTML injection | `srcDoc` in a fully sandboxed iframe; the HTML comes from server-side React rendering with escaped props and fictional data |

## 11. Owner decisions (resolved 2026-11-20)

- **OQ-1 Where the logo is hosted → `apps/web/public`.** The PNG lives at `apps/web/public/email/hospeda-logo@2x.png` and is served at `https://hospeda.com.ar/email/hospeda-logo@2x.png` (`EMAIL_LOGO_URL`). It is versioned and reviewed in the repo. Rejected: Cloudinary (an asset outside the repo), and inline `data:`/CID images (Gmail blocks `data:` images, and CID needs attachment support in the outbox path). Consequence: the URL only resolves once the file reaches `main` and production is deployed, so staging previews and staging emails show the `alt` text until then (R-7). The owner must supply or approve a PNG export (280px wide, 2x of 140px) from the brand source, since none exists today (§2.5). PR-3 is blocked on that file.
- **OQ-2 The footer link → link to preferences.** It points to `https://hospeda.com.ar/es/mi-cuenta/preferencias/` (login required) and keeps the current text. The two anonymous-guest conversation token emails get `footerLink='none'`, because their recipients have no account. Implementation must confirm that `PreferenceToggles` covers the categories of those types (`REMINDER`). If it does not, the uncovered ones get `'none'` and the gap is reported on the issue. A tokenized one-click unsubscribe is out of scope.
- **OQ-3 Roles for `NOTIFICATION_TEMPLATE_PREVIEW` → `SUPER_ADMIN` and `ADMIN`.** It is read-only and shows only fictional data, so widening it later costs one data-migration.
- **PR order → preview first** (D9): PR-1 catalog + endpoint, PR-2 admin page, PR-3 layout.

## 12. Implementation plan: PR split

| PR | Content | Visual change to real emails? |
|---|---|---|
| **PR-1** catalog + endpoint | D4 `renderEmailBodies` (both transports + `send.ts` switch to it); D6 extractions; D7 registry split; `src/catalog/` with all entries and scenarios; completeness and render-all tests (AC-4.x); permission + migration + seed baseline + data-migration (AC-6.x); schemas; service + routes (AC-5.x) | **No** |
| **PR-2** admin page | Route, hooks, components, sidebar entry, i18n (es/en/pt), component tests (AC-7.x) | No |
| **PR-3** unified layout | `emailPalette` (+ test); `EmailLayout` in `@repo/email`; `@repo/notifications` → `@repo/email` dependency; codemod 115 imports + `showUnsubscribe` → `footerLink`; delete both old layouts; logo constant (OQ-1); footer link (OQ-2); snapshot updates; catalog-wide HTML assertions (AC-1.2, AC-2.1, AC-3.2, R-8); docs (`packages/email/CLAUDE.md` rewritten for Brevo + `EmailLayout`, `packages/notifications/docs/guides/email-templates.md`, `.claude/skills/hospeda-email/SKILL.md`) | **Yes, every email.** Owner visual sign-off in the previewer on staging plus AC-3.3 |

The plan is PR-1 → PR-2 → PR-3 (D9). PR-1 is the largest. If it passes ~1,500 changed lines, split it into PR-1a (extractions, registry, catalog and its tests) and PR-1b (permission, migration, seed, schemas, endpoint). Only the PR that completes the spec carries `Closes HOS-2519`. The intermediate PR titles carry `[HOS-2519]` (the Linear title automation will move the issue; spot-check its state after open and after merge).

Smoke: `status-needs-smoke-staging`. Steps: (1) open `/platform/emails` as an admin, page through domains, toggle widths, switch scenarios on a multi-scenario entry; (2) after PR-3, trigger reset-password, a trial reminder and a billing outbox mail to real inboxes and check them in the AC-3.3 clients; (3) confirm the footer link target. Sign-off goes in the `<!-- smoke-signoff v1 -->` comment on HOS-2519.

## 13. Implementation notes

- Codemod scope: `rg -l "from '../components/layout.js'" packages/notifications/src/templates` gives 115 files. Rewrite the import to `import { EmailLayout } from '@repo/email';` and `showUnsubscribe={true}` to `footerLink="preferences"`. Remove `showUnsubscribe={false}`, since `'none'` is the default. Run `biome check` with `--max-diagnostics=400`.
- `templates/components/index.ts` drops its `layout` re-export. `Button`, `Heading` and `InfoRow` stay in notifications (out of scope).
- `email-outbox-sender.job.ts` keeps exporting `buildOutboxSenderRender` with an unchanged signature, so existing job tests pass.
- Follow-up issues to file (not this spec): the unwired newsletter double opt-in emails (§2.6); optionally, moving inline test fixtures to catalog scenarios.

## 14. Linear

Canonical tracking:
HOS-2519
