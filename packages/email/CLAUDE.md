# CLAUDE.md - Email Package

> **Main documentation**: for project-wide guidelines see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Email package (`@repo/email`).

## Overview

`@repo/email` is Hospeda's email presentation and send package (HOS-2519 D1):

- **`EmailLayout`**: the ONE layout every Hospeda email renders inside, including the 114 templates in `@repo/notifications`.
- **`renderEmailBodies`**: the single place that turns a React Email element into the HTML body and the text/plain alternative (HOS-2107, HOS-2519 D4).
- **`sendEmail`**: a provider call over the **Brevo** REST API (`POST /smtp/email`). There is no Resend anymore; "resend" in some file and class names elsewhere is legacy.
- The two auth templates (`VerifyEmailTemplate`, `ResetPasswordTemplate`) and their subject constants.

It depends only on `@repo/logger`, `@repo/design-tokens` (for `emailPalette`) and `@react-email/*`. It must never depend on `@repo/notifications` or `@repo/db` (`@repo/notifications` depends on it).

## Key Commands

```bash
pnpm build             # tsup (dist is what consumers resolve; rebuild after pulling)
pnpm test              # Vitest
pnpm typecheck         # tsc --noEmit
pnpm lint              # Biome
```

`@repo/notifications` resolves this package through `dist`, so a stale build makes a new export arrive `undefined` in its tests. Run `pnpm --filter @repo/email build` after changing anything here (and `pnpm --filter @repo/design-tokens build` if the palette changed).

## Architecture

```
packages/email/
├── src/
│   ├── client.ts               # createEmailClient({ apiKey, baseUrl? }) → opaque EmailClient (Brevo)
│   ├── render.ts               # renderEmailBodies({ react }) → { html, text }
│   ├── send.ts                 # sendEmail(input) → { success, messageId?, error? } (never throws)
│   ├── subjects.ts             # RESET_PASSWORD_EMAIL_SUBJECT, VERIFY_EMAIL_SUBJECT
│   ├── templates/
│   │   ├── email-layout.tsx    # EmailLayout + EMAIL_* URL constants
│   │   ├── greeting.ts         # resolveGreeting (auth templates)
│   │   ├── verify-email.tsx    # VerifyEmailTemplate
│   │   └── reset-password.tsx  # ResetPasswordTemplate
│   └── index.ts                # Public API
└── test/                       # Vitest, mirrors src/
```

## EmailLayout

```tsx
import { EmailLayout } from '@repo/email';

export function MyEmail() {
    return (
        <EmailLayout previewText="Tu reserva fue confirmada">
            <Text>Contenido</Text>
        </EmailLayout>
    );
}
```

| Prop | Type | Default | Purpose |
|---|---|---|---|
| `previewText` | `string?` | none | Inbox preheader. Omitted: no `<Preview>` is rendered |
| `children` | `ReactNode` | required | Email body |
| `footerLink` | `'preferences' \| 'none'` | `'none'` | `'preferences'` adds "Administrar preferencias de notificaciones" linking to `EMAIL_PREFERENCES_URL` |

What it renders (HOS-2519 §5.1):

- `<html lang="es" dir="ltr">` with `color-scheme: light` metas (limits dark-mode inversion).
- A centered card, `width="100%"`, `max-width: 600px`, fluid down to 320px with no media query.
- Outlook desktop (Word) ignores `max-width` and padding on `<table>` styles, so the card sits in an MSO-only 600px "ghost table" (`<!--[if mso]>` comments, each emitted from an empty wrapper `<div>` because React cannot render a bare comment), and every section's padding, background and the accent border live on the `<td>` (`Row`/`Column`), not on the table.
- The footer links carry `data-layout-link="home"` / `"preferences"` so tests can tell layout chrome from body links.
- A white header with the hosted transparent isotipo PNG (`resolveEmailIsotipoUrl()`, `EMAIL_ISOTIPO_WIDTH` x `EMAIL_ISOTIPO_HEIGHT`, `alt=""`) next to the live-text wordmark "hospeda" (bold, `emailPalette.brandStrong`), laid out with a nested two-cell table (`vertical-align: middle`, no flex/grid) that carries `role="img" aria-label="Hospeda"` so the mark has one accessible name. The tagline "Turismo en el Litoral" and a 4px brand accent bar. The header carries `data-skip-in-text="true"`, which React Email's plain-text conversion honours: the text part starts at the body copy.
- Body padding `32px 24px`; templates keep their own typography.
- Footer: divider, "Hospeda - Turismo en el Litoral", the platform description line, a `hospeda.com.ar` link to the home, and the optional preferences link.

Rules that keep it email-client-safe:

- Inline styles only. No flexbox, grid, CSS variables, `oklch()`, web fonts, `<style>`-dependent layout or SVG.
- Colors come from `emailPalette` in `@repo/design-tokens`: hex literals derived from the brand tokens, with a test there that fails on drift. Never hard-code a new brand hex in the layout.
- Absolute URLs come from module constants (`EMAIL_PUBLIC_SITE_URL = 'https://hospeda.com.ar'`, `EMAIL_PREFERENCES_URL`), never from `siteUrl`: emails always point at production. The ONE exception is the logo, whose origin follows the deployment (see below).
- Keep it lean: Gmail clips messages over 102 KB. `apps/api/test/services/email-preview/email-catalog-layout.test.ts` asserts every catalog email stays under 90 KB, plus the AC-1.2/2.1/3.2 checks on every scenario.

### The isotipo asset

Only the drawing is an image: `apps/web/public/email/hospeda-isotipo@2x.png` (89x96 RGBA, transparent background, rendered at 44x48). The word "hospeda" is live HTML text. Gmail darkens the email but never touches images, so the old flattened `hospeda-logo@2x.png` (black wordmark on a baked-in white background) showed as a white rectangle in dark mode; a transparent PNG with the black wordmark would have vanished instead. Dark-mode clients that recolor text (Gmail iOS/Android) now keep the wordmark legible. That old PNG stays in the repo only because emails already sent reference it; the layout never renders it.

The layout renders `resolveEmailIsotipoUrl()`, which follows the origin set by `configureEmailAssets({ siteUrl })` (HOS-2540). The host app calls it once at startup with its validated site URL (`apps/api/src/index.ts`, `HOSPEDA_SITE_URL`); the default is production, so an app that never configures it gets `EMAIL_ISOTIPO_URL` (`https://hospeda.com.ar/email/hospeda-isotipo@2x.png`, kept as the production default constant). `siteUrl` must be an absolute http(s) URL (`TypeError` otherwise); a trailing slash is stripped. Tests call `resetEmailAssets()` to restore the default. Only the isotipo follows it: the footer link and `EMAIL_PREFERENCES_URL` stay on production. If the asset changes, keep `EMAIL_ISOTIPO_WIDTH`/`EMAIL_ISOTIPO_HEIGHT` at the asset's aspect ratio (Outlook desktop honours the `height` attribute).

No `prefers-color-scheme: dark` rule on purpose: the card, header and body copy are hard-coded light, so turning the wordmark white for Apple Mail/Outlook would put white text on a white header unless the whole layout and every template got a dark variant. The `color-scheme: light` metas stay.

### `footerLink="preferences"`: when it is allowed

Only when the recipient has an account AND the web preferences page (`/es/mi-cuenta/preferencias/`) really controls that email. Today no template qualifies: the page writes `settings.notifications.allowEmails`, while `PreferenceService` reads `emailEnabled` / `disabledCategories`, so REMINDER opt-outs are not driven by it (HOS-2519 OQ-2). Anonymous recipients (conversation token mails) never get it.

## Rendering and sending

```ts
import {
    createEmailClient,
    renderEmailBodies,
    sendEmail,
    VERIFY_EMAIL_SUBJECT,
    VerifyEmailTemplate
} from '@repo/email';

const react = VerifyEmailTemplate({ name, verificationUrl });

// Preview or tests: exactly the bodies an inbox receives.
const { html, text } = await renderEmailBodies({ react });

// Send (never throws; branch on the result).
const client = createEmailClient({ apiKey: env.HOSPEDA_EMAIL_API_KEY });
const result = await sendEmail({ client, to: email, subject: VERIFY_EMAIL_SUBJECT, react });
if (!result.success) {
    logger.warn('Verification email failed', { error: result.error });
}
```

- `sendEmail` posts `htmlContent` and `textContent` (both from `renderEmailBodies`) to Brevo with a 10s timeout. Default sender `Hospeda <noreply@hospeda.com.ar>` (`fromEmail` / `fromName` / `replyTo` override it).
- In `apps/api`, do not call `sendEmail` directly: use `sendAppEmail` (`apps/api/src/utils/email-sender.ts`), which adds the `[STAGING]` subject prefix outside production. A guard test enforces it.
- The notifications transport (`packages/notifications/src/transports/email/`) also renders through `renderEmailBodies`.

## Auth templates

| Template | Subject constant | Props | Expiry copy |
|---|---|---|---|
| `VerifyEmailTemplate` | `VERIFY_EMAIL_SUBJECT` | `name?`, `verificationUrl` | 24 hours |
| `ResetPasswordTemplate` | `RESET_PASSWORD_EMAIL_SUBJECT` | `name?`, `resetUrl` | 1 hour |

Both render inside `EmailLayout` with no preheader and `footerLink` `'none'` (transactional). Their copy is owner-approved: do not change it without sign-off. Used by `apps/api/src/lib/auth.ts`.

## Adding a template

Most templates belong in `@repo/notifications` (`src/templates/<domain>/`), not here. Wherever it lives:

1. Wrap the body in `EmailLayout` from `@repo/email`.
2. Inline styles only, Spanish copy, no `{{placeholder}}` strings (nothing substitutes them).
3. Add a catalog entry with scenarios (`packages/notifications/src/catalog/`) so the admin previewer and the catalog-wide tests cover it.

## Testing

- `test/templates/email-layout.test.tsx`: layout structure, footer link, email-safe CSS, text part.
- `test/templates/{verify-email,reset-password}.test.tsx`: copy and transactional signals.
- `test/send.test.ts`, `test/render.test.tsx`: Brevo request shape and the HTML/text pairing (fetch is mocked).
- Catalog-wide layout assertions live in `apps/api/test/services/email-preview/`.

## Notes

- All copy is Spanish (Argentina market).
- `sendEmail` never throws; email failures must not block user flows.
- The env var is `HOSPEDA_EMAIL_API_KEY` (Brevo), read by the host app, not by this package.
