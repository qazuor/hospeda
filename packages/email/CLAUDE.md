# CLAUDE.md - Email Package

> **Main documentation**: for project-wide guidelines see [CLAUDE.md](../../CLAUDE.md) in the project root.

This file provides guidance for working with the Email package (`@repo/email`).

## Overview

`@repo/email` is Hospeda's email presentation and send package (HOS-2519 D1):

- **`EmailLayout`**: the ONE layout every Hospeda email renders inside, including the 114 templates in `@repo/notifications`.
- **`renderEmailBodies`**: the single place that turns a React Email element into the HTML body and the text/plain alternative (HOS-2107, HOS-2519 D4). It takes a **required** `attribution` and applies it (HOS-2359).
- **`applyEmailAttribution`**: the single implementation of email attribution (HOS-2359): UTMs on every link to our web domain and one Umami open pixel per email. See [Attribution](#attribution-hos-2359).
- **`sendEmail`**: a provider call over the **Brevo** REST API (`POST /smtp/email`). There is no Resend anymore; "resend" in some file and class names elsewhere is legacy.
- The two auth templates (`VerifyEmailTemplate`, `ResetPasswordTemplate`) and their subject constants.

It depends only on `@repo/logger`, `@repo/design-tokens` (for `emailPalette` and `emailDarkPalette`), `@repo/analytics` and `@repo/config` (the UTM vocabulary, and the brand social profiles and contact data; both bundled into the CJS output because they are ESM-only), `@repo/help` (footer FAQ titles), `@repo/schemas` (the D16 account-link rule) and `@react-email/*`. It must never depend on `@repo/notifications` or `@repo/db` (`@repo/notifications` depends on it).

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
│   ├── attribution.ts          # applyEmailAttribution, EmailAttribution, UMAMI_PIXEL_PATH (HOS-2359)
│   ├── render.ts               # renderEmailBodies({ react, attribution }) → { html, text }
│   ├── send.ts                 # sendEmail(input) → { success, messageId?, error? } (never throws)
│   ├── subjects.ts             # RESET_PASSWORD_EMAIL_SUBJECT, VERIFY_EMAIL_SUBJECT
│   ├── templates/
│   │   ├── email-layout.tsx    # EmailLayout: dispatches on `variant` + EMAIL_* URL constants
│   │   ├── staff-layout.tsx    # the HOS-2519 layout, frozen for the 13 staff mails
│   │   ├── email-layout-context.ts # per-send layout data (illustration, help ids, verticals)
│   │   ├── user-layout/        # the user variant: header, footer, styles, assets, help + account links
│   │   ├── greeting.ts         # resolveGreeting (auth templates)
│   │   ├── verify-email.tsx    # VerifyEmailTemplate
│   │   └── reset-password.tsx  # ResetPasswordTemplate
│   └── index.ts                # Public API
└── test/                       # Vitest, mirrors src/
```

## Attribution (HOS-2359)

Every send path passes an `EmailAttribution`:

```ts
type EmailAttribution =
    | { medium: 'transactional'; templateKey: string; includePixel: boolean } // catalog key, e.g. 'auth.reset-password'
    | { medium: 'campaign'; campaignSlug: string; pixelSlug: string | null }; // newsletter
```

- **Links**: every `<a href>` on our web domain (`buildOwnWebOrigins` from `@repo/analytics`: the configured site origin plus `hospeda.com.ar`, `www.`, `staging.`) gets `utm_source=email`, `utm_medium`, `utm_campaign` (the key as a token, or the campaign slug) and `utm_content` = the anchor's `data-utm-content`, else its `data-layout-link`, else `body-link`. API/admin hosts, `mailto:`, `tel:`, anchors and links that already carry UTMs stay byte-identical. The text part gets the same replacements.
- **Pixel**: `<img src="{pixelBaseUrl}/p/{slug}" width="1" height="1" alt="">` before `</body>`, only when `configureEmailAssets({ pixelBaseUrl })` got an `https:` URL. No query string, identical for every recipient (no recipient id). Slug: `email-<key token>` or the campaign's `pixelSlug`. `includePixel: false` / `pixelSlug: null` render none (admin preview, newsletter test send).
- `applyEmailAttribution` never throws: a link the vocabulary rejects is left as is and logged once.

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
| `variant` | `'user' \| 'staff'` | `'user'` | Who reads it (HOS-2565 D10). Staff templates pass `'staff'` |
| `footerLink` | `'preferences' \| 'none'` | `'preferences'` (user), `'none'` (staff) | User: `'none'` hides the account sentence, "Elegí qué correos recibís" and the account link (readers without an account). Staff: `'preferences'` adds the old preferences link |

### The user variant (HOS-2565 PR-4, owner-approved 2026-11-23)

- Header: the blue-to-teal wave PNG, the isotipo next to the live wordmark "hospeda" (bold, `brandStrong`), and the tagline "Descubrí el Litoral" as a teal PNG. All `data-skip-in-text`.
- First title row (`EmailTitle`): a teal section bar above the mail's first title and, to its right on the same row, the illustration the mail declares (`payments`, `listings`, `account`, `plan`, `messages`, `alerts`; absent = none; 84px under 480px). The layout opens a slot and the first `EmailTitle` claims it; later ones, and any outside the user layout, are plain headings. Templates draw more bars through `SectionBar` or the notifications `Heading accent`.
- Footer on a light blue band with a wave: "¿Necesitás ayuda?", "Preguntas frecuentes" (the declared help articles, titles from `@repo/help`, default set otherwise; hidden with `footerLink="none"` because the articles need a login, and "Centro de ayuda" then links the public `EMAIL_PUBLIC_FAQ_URL`), "Nuestros canales", the trust strip, the logo with Instagram/Facebook/X (`BRAND_SOCIAL_PROFILES`), and the small print with "Elegí qué correos recibís" and the D16 account link ("Gestioná tus publicaciones" or "Gestioná tu cuenta", from `resolveEmailAccountLink` in `@repo/schemas`; never a branch on `VerticalEnum`, a test enforces it).
- Per-send data (illustration, help ids, recipient verticals) does NOT come through props: the host passes `renderEmailBodies({ layout })`, which fills `EmailLayoutContext`. `@repo/notifications` builds it from the catalog declarations (`catalog/layout-declarations.ts`).
- Dark mode: `color-scheme: light dark` metas and ONE `@media (prefers-color-scheme: dark)` block in its own second `<style>` (`EMAIL_USER_DARK_STYLE_BLOCK`; classes only, no attribute selectors or `*`, so Gmail dropping it never takes the button rule in `EMAIL_USER_STYLE_BLOCK` along; light tinted boxes carry `EMAIL_TINTED_BOX_CLASS`), with the mockup's own dark palette (`emailDarkPalette`, the Apple Mail look the owner picked, not Gmail's inversion). The wordmark turns white. No `u + .body` trick. Clients that strip `<style>` get the correct light mail.
- Images: every PNG lives in `apps/web/public/email/user/` and is resolved with `resolveEmailAssetUrl({ path })`, so it follows the deployment origin like the isotipo.

### The staff variant

What it renders (HOS-2519 §5.1, frozen byte for byte by `email-layout-staff-snapshot.test.tsx` apart from `data-layout-variant="staff"`):

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

The staff variant keeps `color-scheme: light` and no dark block.

### `footerLink="none"`: who passes it

HOS-2565 §8.3 made the preferences link the user default (owner decision, 2026-11-22; it replaces HOS-2519 OQ-2). Readers who may have no account pass `footerLink="none"`: the 2 auth mails, the 5 anonymous conversation mails, the 3 newsletter mails, `alliance_claim_invite`, `partner-claim-notice` and `partner-application-rejected`. `apps/api/test/services/email-preview/email-catalog-layout.test.ts` freezes that set.

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

Both render inside the user `EmailLayout` with no preheader and `footerLink="none"` (the reader has no account yet). Their copy is owner-approved: do not change it without sign-off. Used by `apps/api/src/lib/auth.ts`.

## Adding a template

Most templates belong in `@repo/notifications` (`src/templates/<domain>/`), not here. Wherever it lives:

1. Wrap the body in `EmailLayout` from `@repo/email`.
2. Inline styles only, Spanish copy, no `{{placeholder}}` strings (nothing substitutes them).
3. Add a catalog entry with scenarios (`packages/notifications/src/catalog/`) so the admin previewer and the catalog-wide tests cover it.

## Testing

- `test/templates/email-layout-user.test.tsx`: the user variant (header, illustration, dark mode, footer, account links, text part).
- `test/templates/email-layout.test.tsx` + `email-layout-staff-snapshot.test.tsx`: the staff variant.
- `test/templates/user-layout-parts.test.tsx`: assets on disk, help links, D16 link, `SectionBar`, `OptionCard`, the no-vertical-branch guard.
- `test/templates/{verify-email,reset-password}.test.tsx`: copy and transactional signals.
- `test/send.test.ts`, `test/render.test.tsx`: Brevo request shape and the HTML/text pairing (fetch is mocked).
- Catalog-wide layout assertions live in `apps/api/test/services/email-preview/`.

## Notes

- All copy is Spanish (Argentina market).
- `sendEmail` never throws; email failures must not block user flows.
- The env var is `HOSPEDA_EMAIL_API_KEY` (Brevo), read by the host app, not by this package.
