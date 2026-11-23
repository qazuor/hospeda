---
title: Campaign attribution in Umami — UTM on emails, share buttons, QR codes and presentations, plus email open pixels
linear: HOS-2359
statusSource: linear
created: 2026-11-23
decisionsResolvedOn: 2026-11-23
type: feature
areas:
  - web
  - api
  - db
  - content
  - devops
smokeLabels:
  - status-needs-smoke-staging
delivery: single-pr
builds-on: HOS-2119
---

# Campaign attribution in Umami

## 1. Summary

Owner request (2026-11-18, HOS-2359): use Umami's UTM campaigns and Pixels to know where
visits come from — emails, links shared on WhatsApp and other networks, printed QR codes
and the commercial presentations the team sends by hand.

This spec delivers, in **one PR** (owner decision 8):

- **A.** UTMs on every link to our web domain in every email, plus one Umami open pixel per
  transactional template (~125 templates), rendered from ONE place.
- **B.** One Umami pixel per newsletter campaign, created through the Umami API at dispatch,
  fail-open, with a new write-capable env var.
- **C.** UTMs on share buttons, an edge rule so `?utm_*` stops defeating the Cloudflare
  cache, and `Cache-Control: no-store` on middleware redirects that copy the query.
- **D.** UTMs on the `/qr/<slug>` redirect destination, `/go/<slug>` short links for the
  presentations, and copy/share-per-network buttons on the `/presentacion/` index.
- **E.** A privacy-policy section (es/en/pt), an `Attribution` board and per-template
  pixels created by `pnpm umami:setup`.

All of it goes through one helper, `withUtm()`, over a closed vocabulary. It builds on the
Umami stack from HOS-2119 (`.specs/HOS-2119-posthog-to-umami/spec.md`).

## 2. Owner decisions (FINAL — do not reopen)

Source: Linear comment "Owner decisions (2026-11-23)" on HOS-2359. Each is a requirement.

| # | Decision | Where it lands |
|---|---|---|
| OD-1 | Open pixels on **every** email: all transactional templates, `auth.reset-password` and `auth.verify-email` included, plus Brevo campaign sends | §6.A, §6.B |
| OD-2 | One Umami pixel per transactional template, created automatically by `umami:setup` from the template list. A guard test fails if a template ships without a pixel | §6.A.4, §6.E.3 |
| OD-3 | One pixel per campaign, created through the Umami API at dispatch time and inserted into the HTML. New env var with Umami credentials on the API. If Umami is down, the campaign still goes out without a pixel | §6.B |
| OD-4 | Closed UTM vocabulary (below), enforced by `withUtm()`. UTMs only on links that leave the site and come back, never on internal links | §6.0 |
| OD-5 | Presentations: `/go/<slug>` short links (302 to the presentation URL with UTMs, like `/qr/[slug]`), plus copy and share-per-network buttons on the `/presentacion/` index that hand out the short link. Canonical presentation URLs never redirect to a UTM version | §6.D.2, §6.D.3 |
| OD-6 | Cloudflare: exclude exactly `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` from the cache key; other params untouched. Locale redirect gets explicit `Cache-Control: no-store` plus a test. The Cloudflare change is applied with the owner's OK | §6.C.2, §6.C.3 |
| OD-7 | Privacy policy: new es/en/pt section on email open pixels (aggregate, no recipient id), campaign parameters on links, and Brevo's existing open tracking. No per-user opt-out | §6.E.1 |
| OD-8 | One spec, one PR | §12 |
| OD-9 | `/qr/[slug]` adds UTMs to its redirect destination, so printed codes don't change | §6.D.1 |
| OD-10 | An `Attribution` board built by `umami:setup` (breakdown by `utm_source` / `utm_campaign` and conversions) | §6.E.2 |

OD-4 vocabulary, verbatim:

- Email: `source=email`, `medium=transactional|campaign`, `campaign=<template id|campaign slug>`, `content=<link slot>`.
- Share buttons: `source=whatsapp|facebook|x|telegram|share|copy`, `medium=share`, `campaign=<entity type>`.
- Printed QR codes: `source=qr`, `medium=print`, `campaign=<listing kind|certificate>`.
- Presentations: `source=whatsapp`, `medium=direct-outreach`, `campaign=presentacion-<audience>`.
- Profiles: `source=instagram|google-business|...`, `medium=profile`, `campaign=bio`.

### 2.1 Where this spec had to interpret a decision

Each item below is derived from the decisions and the code. None of them reverses a
decision. Items marked **default, reversible** are cheap to change later.

1. **OD-6 mechanism (measured constraint).** The zone `hospeda.com.ar` is on the
   Cloudflare **Free** plan (`infra/cloudflare/README.md:43`). On that plan a Cache Rule
   cannot exclude individual query parameters from the cache key: "Query string" cache-key
   control is Enterprise-only (Cloudflare docs, *Cache Keys → Availability*), and the repo
   already records that `Ignore query string` / `No query parameters except` are not
   available (`infra/cloudflare/rules/cache-rules.md:689`). The current cache rules also
   require `http.request.uri.query eq ""` (`cache-rules.md:75`), which is exactly why
   `?utm_source=` measured `DYNAMIC`. The same effect is achieved with Free-plan
   primitives: a **URL Rewrite Rule** (Transform Rules, all plans) that removes exactly
   the five `utm_*` params from the query, using `remove_query_args()`, before the cache
   phase. Requests whose only params are `utm_*` then match the existing cache rules and
   share the plain URL's cache object; any other param stays in the query and keeps
   today's behaviour. Details and residual risk in §6.C.2. The owner applies it (OD-6),
   so they see this mechanism before it goes live.
2. **OD-6 scope of `no-store`.** The decision names the locale redirect. Two other
   middleware redirects copy the query into `Location` the same way (trailing slash and
   legacy aliases, `apps/web/src/middleware.ts:294-311`). The decision's stated reason ("a
   cached redirect must never carry another visitor's UTM") applies to them identically,
   so all three get `no-store` when the query is non-empty.
3. **OD-5 sources.** "Share-per-network buttons" hand out one short link per network, so
   the presentation vocabulary uses `source=whatsapp|facebook|x|telegram|copy` (the
   network the button targets), keeping `medium=direct-outreach` and
   `campaign=presentacion-<audience>`. **Default, reversible:** the copy button uses
   `source=copy`.
4. **OD-4 `campaign` for transactional email** is the catalog entry **key** (for example
   `auth.reset-password`), normalized to kebab-case. The bare catalog `id` is not unique
   across send paths (`conversation.verify` and `newsletter.verify` both have id `verify`).
5. **OD-9 campaign for codes with no entity.** Operator-made codes (`source = MANUAL`,
   no `entity_type`) get `campaign=manual`. **Default, reversible.** `utm_content` carries
   the code purpose (`listing`, `menu`, `brochure`, `host-trade-usage`, `certificate`).
6. **Admin email preview** renders UTMs but **omits the pixel**, so opening a preview
   never counts as an open. This is the one place where the preview differs from what an
   inbox receives (HOS-2519 D4), and it is stated in code.
7. **Board name** is `Attribution`, literally as the owner wrote it, even though the
   other boards are numbered Spanish names (`00 Resumen` … `05 Calidad`).

## 3. Goals

- G-1 Every link to our web domain in every email carries `utm_source=email`,
  `utm_medium`, `utm_campaign` and `utm_content`, and a guard proves it for every catalog
  template.
- G-2 Every email carries exactly one 1x1 Umami pixel whose URL identifies the template or
  campaign and never the recipient.
- G-3 Every newsletter campaign gets its own pixel at dispatch; an Umami failure never
  blocks or delays the send beyond a bounded timeout.
- G-4 Share buttons, printed QR codes and presentation short links land with UTMs; the
  canonical URLs, `<link rel=canonical>`, sitemap and printed codes do not change.
- G-5 `?utm_*` stops turning cacheable pages into origin hits, and no redirect carrying a
  query is ever cached.
- G-6 The privacy policy describes all of the above before any pixel fires in production.
- G-7 `pnpm umami:setup` creates the per-template pixels and the `Attribution` board
  idempotently.

## 4. Non-goals

- No per-recipient tracking of any kind: no recipient id, hash, delivery id or token in a
  pixel URL or in a UTM value.
- No per-user opt-out (OD-7).
- No UTMs on internal links, ever, and no UTMs on canonical URLs.
- No change to Brevo's own `trackOpens`/`trackClicks` on campaigns
  (`newsletter-delivery.service.ts:673-674`).
- No aggregation board for pixels. Opens are read in Umami → Pixels.
- Profile/bio links (Instagram, Google Business): documented only, no code beyond the
  vocabulary (issue item 5, "only document the convention").
- No UTMs on links to the API host (verify/reset links point at the auth API) or the admin
  host. See §6.A.2 for why that is safe.
- No admin UI for generating links: the `/presentacion/` index is the tool (OD-5).

## 5. Current baseline

Measured on `origin/staging` @ `ab1320da9f` (2026-11-23).

### 5.1 Email rendering

- **One layout for every email:** `EmailLayout` (`packages/email/src/templates/email-layout.tsx:92`).
  Its footer links are tagged `data-layout-link="home"` (`:169`) and
  `data-layout-link="preferences"` (`:179`). The header logo is an `<Img>`, not a link.
- **One render function:** `renderEmailBodies({ react })` (`packages/email/src/render.ts:42`)
  renders HTML and text from the same element. Its callers:
  - `sendEmail` (`packages/email/src/send.ts:126`, render at `:141`), reached only through
    `sendAppEmail` (`apps/api/src/utils/email-sender.ts:148`), which is called from
    `apps/api/src/lib/auth.ts:330` (verify) and `:414` (reset),
    `apps/api/src/lib/conversation-mailer.ts:82` and `:115`,
    `apps/api/src/cron/jobs/conversation-notification.job.ts:334` and
    `apps/api/src/cron/jobs/conversation-token-reminder.job.ts:179`.
  - `BrevoEmailTransport.send` (`packages/notifications/src/transports/email/resend-transport.ts:80-86`),
    called from `notification.service.ts:145`, `outbox/email-outbox-delivery.service.ts:390`,
    `channels/email-alert.channel.tsx:90` and the newsletter test send
    (`packages/service-core/src/services/newsletter/newsletter-delivery.service.ts:967`).
  - The admin preview (`packages/notifications/src/catalog/render-scenario.ts:64`).
- **The transport input carries no template identity:** `SendEmailInput`
  (`packages/notifications/src/transports/email/email-transport.interface.ts:6-27`) has
  `to/subject/react/from/replyTo/tags/attachments` only.
- **The template registry is the email catalog** (HOS-2519): `EMAIL_CATALOG`
  (`packages/notifications/src/catalog/catalog.ts:27`), entries typed by
  `EmailCatalogEntry` (`catalog/types.ts:85`) with a unique `key` of the form
  `<sendPath>.<id>` (e.g. `auth.reset-password`, `notification.payment_success`,
  `outbox.verticals.listing-business-lines-changed`). Completeness is already guarded
  (`packages/notifications/test/catalog/catalog-completeness.test.ts`): 49 `notification`,
  2 `auth`, 6 `conversation`, 1 `alert-digest`, 3 `newsletter`, 64 `outbox` = **125
  entries**.
- **CTA button:** `Button` (`packages/notifications/src/templates/components/button.tsx:24`)
  wraps React Email's `Button`.
- **Asset origin:** `configureEmailAssets({ siteUrl })` (`packages/email/src/email-assets.ts`),
  called once at api startup (`apps/api/src/index.ts:72`).
- **No UTMs anywhere today** (`rg utm_ apps packages` finds only comments).

### 5.2 Newsletter campaigns

- Dispatch: `NewsletterCampaignService.send` (`packages/service-core/src/services/newsletter/newsletter-campaign.service.ts:646`),
  which asserts `DRAFT`, inserts deliveries and sets `SENDING` in one transaction
  (`:752`), then enqueues BullMQ batches (`:762`).
- Batch: `NewsletterDeliveryService.processBatch` renders TipTap once (`:613`), renders
  per-recipient HTML through the injected `renderCampaignEmailFn` (`:641`), and posts a
  Brevo batch with `trackOpens: true, trackClicks: true` (`:668-681`) through `sendBatch`
  (`packages/notifications/src/transports/email/brevo-batch.ts`).
- The production renderer is wired in `apps/api/src/services/newsletter/delivery-factory.ts:144-155`
  (`render(NewsletterCampaign(...))`, HTML only).
- `newsletter_campaigns` (`packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema.ts`)
  has no slug column.

### 5.3 Umami (from HOS-2119)

- Umami **3.5.0**, `ghcr.io/umami-software/umami:3.5.0`, hosts
  `pulso-staging.hospeda.com.ar` / `pulso.hospeda.com.ar` (`docs/analytics/umami-spike.md:14-20`).
- API env vars (`packages/config/src/env-registry.hospeda.ts:1518-1605`):
  `HOSPEDA_UMAMI_URL`, `HOSPEDA_UMAMI_WEBSITE_ID_WEB`, `HOSPEDA_UMAMI_WEBSITE_ID_ADMIN`,
  `HOSPEDA_UMAMI_API_KEY` (**view-only by registry contract**, `:1571-1586`),
  `HOSPEDA_UMAMI_DATABASE_URL`. The latter's text states "it never holds a Umami API write
  key" (`:1602`). OD-3 changes that, so the text must be amended.
- Setup script: `scripts/umami/setup.ts` (`pnpm umami:setup`, `package.json:154`),
  authenticated with `UMAMI_SETUP_API_KEY` or `UMAMI_SETUP_USERNAME/PASSWORD`
  (`setup.ts:16-20`, `:342-349`); client `scripts/umami/client.ts` (board types include
  `pixel`, `:39`); boards `scripts/umami/boards.ts` (`01 Adquisición` already has UTM
  source/campaign tables, `:87-108`); goals `scripts/umami/definitions.ts:278`;
  `MetricsTable` dimensions include `utmSource|utmMedium|utmCampaign|utmContent|utmTerm`
  (`definitions.ts:345-349`); segment "Llegan por campaña (UTM)"
  (`segment-definitions.ts:132`). API shapes measured in
  `.specs/HOS-2119-posthog-to-umami/docs/umami-spike-findings.md:111-147`.
- Root `package.json` depends on `@repo/config` only; scripts do not import other
  workspace packages.

### 5.4 Web

- Share buttons: `apps/web/src/components/ShareButtons.client.tsx` (props `:29-40`,
  native share `:122`, clipboard `:142`, network links `:158-206`). Call sites:
  `pages/[lang]/publicaciones/[slug].astro:540`, `pages/[lang]/eventos/[slug].astro:291`,
  and the accommodation gallery (`pages/[lang]/alojamientos/[slug].astro:615` →
  `components/ImageGalleryMobileTrack.client.tsx:172`). Each shares the canonical URL.
- QR landing: `apps/web/src/pages/qr/[slug].astro` (never cacheable `:52-60`, resolve
  `:103`, hand-built 302 `:127-130`). API side: `apps/api/src/routes/qr-code/public/resolve.ts`
  (scan row stores `targetUrlAtScan` `:196`, response `:210-214`), schema
  `QrCodeResolutionSchema` (`packages/schemas/src/entities/qr-code/qr-code.http.schema.ts:138`).
  The row carries `entity_type` and `purpose` (`qr_code.dbschema.ts:64`, `:94`);
  purposes: `HOST_TRADE_USAGE|LISTING|MENU|CERTIFICATE|BROCHURE`. Every printed entity
  code encodes `{site}/qr/{slug}/` (`apps/api/src/utils/entity-qr.ts:76`, `:140`),
  including the experience certificate (`routes/experience/protected/certificates.ts:321`).
- Presentations: six pages under `apps/web/src/pages/[lang]/presentacion/`; the index
  (`presentacion/index.astro`) holds the list `PRESENTATIONS` (`:47-90`), is cacheable
  (`:94-100`) and links each card to the canonical page (`:139-154`).
- Language-neutral routes: `LANGUAGE_NEUTRAL_PREFIXES = ['/qr/']` (`apps/web/src/lib/routes.ts:126`);
  two-letter segments are read as locales (`middleware-helpers.ts:71`), so `/go/` needs
  the same exemption as `/qr/` (`middleware.ts:328-341`).
- Redirects copying the query: trailing slash and legacy (`middleware.ts:290-311`),
  locale (`:341-346`, `buildLocaleRedirect` at `middleware-helpers.ts:399`). None sets
  `Cache-Control`.
- Privacy policy: `pages/[lang]/legal/privacidad/index.astro` (sections `:35-45`), copy in
  `packages/i18n/src/locales/{es,en,pt}/privacy.json`; precedent for a guarded section:
  `privacy.sections.sessionRecording` + `packages/i18n/test/session-recording-legal-copy.guard.test.ts`.
- Session-blind guard: `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts`
  (fail-closed over all of `src/pages`).

### 5.5 Cloudflare

- Cache rules mirrored in `infra/cloudflare/rules/cache-rules.md`: rule 1 (staging) and
  rule 4 (prod twin) match `http.request.uri.query eq ""` (`:75`), skip session cookies,
  and use `bypass_by_default` (`:615-635`). Free plan, 4 cache rules in use.
- Measured on staging (owner, OD-6): `/es/presentacion/alojamientos/` → `MISS` then `HIT`
  without query; `DYNAMIC` with `?utm_source=...`.

## 6. Design

### 6.0 The helper: `withUtm()` and the vocabulary

**Location:** `packages/analytics/src/attribution/` exported from `@repo/analytics`.
Why there: it is analytics vocabulary; the package has no internal dependencies (only
`zod`, `isbot`), is `sideEffects: false`, is browser-safe, and `apps/web` and `apps/api`
already depend on it. `@repo/utils` was rejected because it pulls `@repo/config` into
`@repo/email`. New consumers add `"@repo/analytics": "workspace:*"`: `packages/email`,
`packages/notifications`, `packages/service-core`.

Files:

- `vocabulary.ts` — `as const` lists and Zod schemas:
  - `UTM_SOURCES = ['email','whatsapp','facebook','x','telegram','share','copy','qr','instagram','google-business']`
  - `UTM_MEDIUMS = ['transactional','campaign','share','print','direct-outreach','profile']`
  - `SHARE_CAMPAIGNS = ['accommodation','event','post']` (the three entity types that render
    `ShareButtons` today; adding one is a one-line change)
  - `QR_CAMPAIGNS = ['accommodation','venue','experience','host-trade','certificate','manual']`
  - `PRESENTATION_AUDIENCES = ['alojamientos','comer-y-salir','experiencias','proveedores','aliados','editores']`
  - `UtmParamsSchema`: a Zod discriminated union on `medium` that pins the allowed
    `source`/`campaign` per medium:
    - `transactional` | `campaign`: `source: 'email'`, `campaign` matches
      `^[a-z0-9]+(?:-[a-z0-9]+)*$`, length ≤ 100, `content` required, same regex, ≤ 40.
    - `share`: `source ∈ {whatsapp,facebook,x,telegram,share,copy}`, `campaign ∈ SHARE_CAMPAIGNS`.
    - `print`: `source: 'qr'`, `campaign ∈ QR_CAMPAIGNS`, `content` optional (kebab).
    - `direct-outreach`: `source ∈ {whatsapp,facebook,x,telegram,copy}`,
      `campaign = 'presentacion-' + PRESENTATION_AUDIENCES`.
    - `profile`: `source ∈ {instagram,google-business}`, `campaign: 'bio'`.
- `with-utm.ts` —
  `withUtm(input: { url: string } & UtmParams): string`. Validates with
  `UtmParamsSchema` (throws a typed `InvalidUtmParamsError` on a bad combination — a
  programming error, caught by tests). Parses `url`; if it already has ANY `utm_*`
  param, returns it unchanged (an operator-set or upstream campaign is never
  overwritten). Otherwise appends `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_content` (when given) in that order, preserving existing params and the hash.
- `own-origin.ts` — `isOwnWebUrl({ url, ownOrigins }): boolean`. True for `http(s)` URLs
  whose origin is in `ownOrigins`. Callers build `ownOrigins` as
  `buildOwnWebOrigins({ siteUrl })` = `{siteUrl origin, https://hospeda.com.ar,
  https://www.hospeda.com.ar, https://staging.hospeda.com.ar}` (deduped). Admin and API
  hosts are deliberately not in it.
- `email-attribution-slugs.ts` —
  - `toUtmToken(value: string): string`: lowercase, every run of `[^a-z0-9]` → `-`,
    trimmed of `-`.
  - `buildEmailTemplateCampaign({ key })` = `toUtmToken(key)` (e.g.
    `auth.reset-password` → `auth-reset-password`).
  - `buildEmailTemplatePixelSlug({ key })` = `'email-' + toUtmToken(key)`.
  - `buildNewsletterCampaignSlug({ title, id })` = `toUtmToken(title)` cut at 40 chars
    (no trailing `-`) + `-` + first 8 hex chars of `id` without dashes. Empty title →
    `newsletter-<id8>`.
  - `buildNewsletterPixelSlug({ campaignSlug })` = `'newsletter-' + campaignSlug`.

  Why deterministic slugs (no lookup table): the renderer needs no network call and no
  DB read to know a template's pixel; `umami:setup` and the renderer compute the same
  string from the same key; a template rename changes its slug in both places at once.
  The cost — a renamed key starts a new pixel series — is acceptable (keys are stable by
  convention and guarded).

**Internal-link rule (OD-4) as a guard:** `apps/web/test/static-guards/utm-only-through-helper.guard.test.ts`
fails if any file under `apps/web/src` (except `packages`-imported helpers) contains the
literal `utm_`. Allowed: none — the web only calls `withUtm`. A second guard in
`apps/api/test/static-guards/` does the same for `apps/api/src`, and one in
`packages/notifications/test/` for `packages/notifications/src`.

### 6.A Emails — UTMs and per-template pixels

#### 6.A.1 Contract

New type in `packages/email/src/attribution.ts`:

```ts
export type EmailAttribution =
    | { readonly medium: 'transactional'; readonly templateKey: string; readonly includePixel: boolean }
    | { readonly medium: 'campaign'; readonly campaignSlug: string; readonly pixelSlug: string | null };
```

- `renderEmailBodies({ react, attribution })` — `attribution` becomes **required** (the
  compiler then forces every caller to decide; tests pass it explicitly).
- New pure export `applyEmailAttribution({ html, text?, attribution }): { html, text? }`
  — the single implementation. `renderEmailBodies` calls it after rendering.
- `configureEmailAssets({ siteUrl, pixelBaseUrl? })` gains `pixelBaseUrl`. The api passes
  `env.HOSPEDA_UMAMI_URL`. A pixel is rendered only when `pixelBaseUrl` is an `https:`
  URL; otherwise (dev, unset, or an internal `http://` URL) no pixel is rendered and UTMs
  still are. At api boot, when `NODE_ENV=production` and `HOSPEDA_UMAMI_URL` is set but
  not `https:`, log one warning (the pixel would be unreachable from a mail client).

#### 6.A.2 Link rewriting (UTMs)

`applyEmailAttribution` walks every `<a ... href="...">` in the rendered HTML (React's
output is deterministic: double-quoted attributes, `&amp;`-escaped). For each href:

1. HTML-decode; skip `mailto:`, `tel:`, `#…`, and anything `isOwnWebUrl` rejects.
2. Resolve the **link slot** (`utm_content`): the anchor's `data-utm-content` attribute if
   present; else its `data-layout-link` value (`home`, `preferences`); else `body-link`.
3. `withUtm({ url, source: 'email', medium, campaign, content: slot })` where `campaign`
   is `buildEmailTemplateCampaign({ key: templateKey })` for transactional and
   `campaignSlug` for campaigns. Re-escape and write back.
4. Record `originalHref → decoratedHref` (first occurrence wins).

Text part: every occurrence of a recorded `originalHref` in `text` is replaced by its
decorated value (longest key first). No HTML is re-rendered, so `data-skip-in-text`
behaviour is untouched.

Slots on shared components:

- `Button` (`notifications/src/templates/components/button.tsx`) gains an optional
  `utmContent?: string` prop (default `'cta'`) rendered as `data-utm-content`. The
  implementer verifies React Email's `Button` forwards `data-*` to the `<a>` (unit test);
  if it does not, `Button` wraps it so the attribute lands on the anchor.
- Layout footer links already carry `data-layout-link`; nothing to add.
- Templates with more than one CTA may set `utmContent` explicitly (e.g. `'secondary-cta'`);
  not required for acceptance.

Why links to the API/admin hosts stay untouched: the verify-email and reset-password CTAs
point at the auth API, which redirects into the web; UTMs there would be dropped by the
API redirect anyway and could interfere with signed callback URLs. Attribution for those
emails comes from the pixel and the footer links.

#### 6.A.3 Pixel

`applyEmailAttribution` inserts, immediately before `</body>` (or appended if absent):

```html
<img src="{pixelBaseUrl}/p/{slug}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />
```

- `slug` = `buildEmailTemplatePixelSlug({ key: templateKey })` (transactional, only when
  `includePixel`), or `pixelSlug` (campaign, when non-null).
- The URL has **no query string** and is byte-identical for every recipient of the same
  template/campaign (OD-7, "no recipient id").
- Exactly one pixel per email; the text part never contains it.
- The path `/p/<slug>` is **unverified** for Umami 3.5.0 (see §6.F, M-2). The path segment
  lives in one constant (`UMAMI_PIXEL_PATH`) so M-2 can correct it.

#### 6.A.4 Wiring every send path

- `@repo/notifications` `SendEmailInput` gains a **required**
  `attribution: EmailAttribution`. `BrevoEmailTransport.send` forwards it to
  `renderEmailBodies`. `MockEmailTransport` records it (tests assert on it).
- Callers set the catalog key their catalog entry already declares:
  - `notification.service.ts:145` → `{ medium:'transactional', templateKey: \`notification.${type}\`, includePixel: true }`.
  - `email-outbox-delivery.service.ts:390` → `templateKey: \`outbox.${row.template}\``.
  - `email-alert.channel.tsx:90` → `templateKey: 'alert-digest.<id>'` (the id its catalog
    entry declares).
  - Newsletter test send (`newsletter-delivery.service.ts:967`) →
    `{ medium:'campaign', campaignSlug: buildNewsletterCampaignSlug(...), pixelSlug: null }`
    (a test send never counts as an open). Its `SingleEmailTransport` port in
    service-core gains the same field.
- `@repo/email` `sendEmail` input gains required `attribution`; `sendAppEmail` passes it
  through. Callers: `auth.ts:330` → `auth.verify-email`, `auth.ts:414` →
  `auth.reset-password`, conversation mailer / crons → their `conversation.*` keys.
- Admin preview (`render-scenario.ts:64`) → `{ medium:'transactional', templateKey: entry.key, includePixel: false }`.
- A shared type `EmailCatalogKey = \`${EmailSendPath}.${string}\`` is used for
  `templateKey` in `@repo/notifications`;`@repo/email` stays string-typed (it cannot
  import the catalog — dependency direction).
- **Key-drift protection:** each caller's unit test asserts the exact `templateKey` it
  passes and that `findEmailCatalogEntry({ key })` finds it. A key that is not in the
  catalog would render a pixel no `umami:setup` run creates, so the notifications
  transport also logs one `warn` per unknown key at runtime (it cannot import the catalog
  into `@repo/email`, but `BrevoEmailTransport` lives next to it). If that import creates
  a module cycle, drop the runtime warning; the per-caller tests are the requirement.

#### 6.A.5 Guards (OD-2, issue "guard test")

`packages/notifications/test/catalog/catalog-attribution.guard.test.ts`, over every
`EMAIL_CATALOG` entry and every scenario, rendered through `renderScenario` +
`renderEmailBodies` with `includePixel: true`:

- every `href` that `isOwnWebUrl` accepts carries `utm_source=email`,
  `utm_medium=transactional`, `utm_campaign=<buildEmailTemplateCampaign(key)>` and a
  non-empty `utm_content`;
- the HTML contains exactly one `<img src="…/p/email-…">` and its slug equals
  `buildEmailTemplatePixelSlug(key)`;
- the text part contains no pixel URL;
- slugs are unique across the catalog and each is ≤ 90 chars and matches the slug charset
  measured in M-1;
- the committed manifest (§6.E.3) equals the catalog-derived list (drift fails CI).

Non-vacuity: the test asserts at least 125 entries were checked and at least one own-origin
link was found per send path.

### 6.B Campaign pixels and the new env var

#### 6.B.1 Env var (CLAUDE.md "Adding a new environment variable" workflow)

`HOSPEDA_UMAMI_PIXEL_API_KEY`

- Registry (`packages/config/src/env-registry.hospeda.ts`, next to the other Umami vars):
  `type: 'string'`, `required: false`, `secret: true`, `apps: ['api']`,
  `category: 'monitoring'`, `exampleValue: 'umami_xxx'`, `description`/`descriptionEs`:
  "Umami API key of a dedicated `user`-role account allowed to create pixels; used only
  to create one pixel per newsletter campaign at dispatch (HOS-2359). Unset: campaigns go
  out without a pixel." `howToObtain`: create a Umami user `hospeda-api-pixels` with role
  `user` (never admin), log in as it, mint an API key (`POST /api/me/api-keys` or UI).
- Amend the `HOSPEDA_UMAMI_DATABASE_URL` text (`:1602`): it is no longer true that the api
  holds no Umami API write key; say the pixel key is the only API write credential and it
  can only create pixels owned by that user.
- Zod: `HOSPEDA_UMAMI_PIXEL_API_KEY: blankAsUndefined(z.string().min(1))` in
  `apps/api/src/utils/env-schema.ts` (next to `:574`).
- `apps/api/.env.example`: commented placeholder `# HOSPEDA_UMAMI_PIXEL_API_KEY=umami_xxx`.
- `docs/guides/environment-variables.md`: new row next to `:129`.
- Update the count comment and assertion in `packages/config/src/__tests__/env-registry.test.ts`
  (+1). Run `pnpm env:check:registry`.
- Not required in production: the feature is fail-open by design (OD-3).
- **Operator step (§11):** set it in Coolify for `hospeda-api-staging` and `hospeda-api-prod`.

Why a new var instead of `HOSPEDA_UMAMI_API_KEY`: that key is view-only by registry
contract and is used on authenticated owner-panel renders; widening it would give every
stats read write power. `UMAMI_SETUP_*` are script-only and admin-level.

#### 6.B.2 Pixel client (api)

`apps/api/src/lib/umami-pixel-client.ts`, mirroring `umami-stats-client.ts` (native
fetch, `AbortController`, typed error kinds `http|network|timeout|schema`, token never in
messages):

- `ensureUmamiPixel({ slug, name }): Promise<{ slug: string } | null>`
  - Returns `null` immediately (and logs one `warn` per process) when
    `HOSPEDA_UMAMI_URL` or `HOSPEDA_UMAMI_PIXEL_API_KEY` is unset.
  - `POST {HOSPEDA_UMAMI_URL}/api/pixels` body `{ name, slug }`, bearer key, timeout
    **3000 ms** (`UMAMI_PIXEL_TIMEOUT_MS`, same budget as the stats client).
  - On a conflict answer (status measured in M-1), looks the slug up
    (`GET /api/pixels?search=<slug>&pageSize=100`, exact client-side match, as the setup
    client does) and returns it — so a retried dispatch reuses its pixel.
  - Any other failure (timeout, 5xx, network, schema) → logs `warn` with the error kind
    and returns `null`. It never throws.

#### 6.B.3 Dispatch

- Migration (structural carril, `pnpm db:generate`): add to `newsletter_campaigns`
  - `attribution_slug varchar(64)` nullable,
  - `umami_pixel_slug varchar(100)` nullable.
  Additive only (no backfill needed: campaigns already sent keep `NULL` and are never
  re-batched; a re-batch of a `SENDING` campaign with `NULL` falls back to a computed
  `attribution_slug` and no pixel).
- `NewsletterCampaignService` gains an optional injected port
  `campaignPixelProvisioner?: (input: { slug: string; name: string }) => Promise<{ slug: string } | null>`
  (service-core must not import apps/api). Wired in the api composition root to
  `ensureUmamiPixel`.
- In `send()`, after the eligibility early-return (`:~720`) and **before** the
  transaction: compute `attributionSlug = buildNewsletterCampaignSlug({ title, id })`,
  call the provisioner with `slug = buildNewsletterPixelSlug(...)`,
  `name = \`Newsletter · ${title}\``. The call is bounded by the client timeout and wrapped
  so a rejection is treated as`null`. Write`attributionSlug` and the returned slug (or
  `NULL`) in the same`UPDATE` that sets `SENDING`(`:752`).
- `processBatch` reads both columns and passes
  `{ medium:'campaign', campaignSlug, pixelSlug }` to `renderCampaignEmailFn`, whose
  signature gains `attribution`. The api renderer (`delivery-factory.ts:144`) becomes
  `applyEmailAttribution({ html: await render(element), attribution }).html`. The batch's
  top-level `htmlContent` (`bodyHtml`, `:672`) goes through the same function, so a
  fallback body is attributed too.
- UTMs on campaign links: links authored in TipTap that point at our web domain get
  `utm_medium=campaign`, `utm_campaign=<attribution_slug>`, `utm_content=body-link` (or the
  layout slot). Brevo's click tracking wraps them; the final destination keeps the UTMs.
- The unsubscribe URL is an own-origin link and receives UTMs too (harmless: the token
  param is independent of the others; covered by a test that the unsubscribe flow still
  verifies the token).

### 6.C Share buttons, edge cache, redirect `no-store`

#### 6.C.1 Share buttons

- Extract the four intent URL builders (`wa.me`, Facebook sharer, X intent, Telegram)
  from `ShareButtons.client.tsx:158-206` into `apps/web/src/lib/share-intents.ts`
  (`buildShareIntentUrl({ network, url, title })`) so the presentation index reuses them.
- `ShareButtons` gains a required prop `campaign: (typeof SHARE_CAMPAIGNS)[number]`.
  Each action shares `withUtm({ url, source, medium: 'share', campaign })` with `source`
  = the network (`whatsapp|facebook|x|telegram`), `share` for `navigator.share` (`:122`),
  `copy` for the clipboard (`:142`).
- Call sites pass `campaign`: `publicaciones/[slug].astro:540` → `'post'`,
  `eventos/[slug].astro:291` → `'event'`, `alojamientos/[slug].astro:615` (`share` prop
  consumed at `ImageGalleryMobileTrack.client.tsx:172`) → `'accommodation'`.
- The `url` prop stays the canonical URL. `SEOHead`, `<link rel=canonical>`, OG/Twitter
  tags and JSON-LD are untouched (asserted by a test on one detail page's head).

#### 6.C.2 Cloudflare edge rule (manual ops step, OD-6)

Not applied by the implementer. The implementer **documents** it; the owner applies it.

Document in `infra/cloudflare/rules/` (the directory `infra/cloudflare/README.md`
designates for dashboard rules): new file `infra/cloudflare/rules/transform-rules.md`
(or a section in an existing transform/redirect file if the implementer finds one), plus
a short cross-reference paragraph in `cache-rules.md` under rule 1/rule 4 ("requests whose
only params are `utm_*` reach these rules with an empty query because of the
`HOS-2359 strip utm` URL rewrite").

Rule, two twins (staging, production), each scoped by `http.host` (shared zone rule,
`infra/cloudflare/README.md:41-55`):

- **Type:** Rules → Transform Rules → URL Rewrite Rule.
- **Name:** `HOS-2359 - staging strip utm before cache` / `HOS-2359 - prod strip utm before cache`.
- **Filter expression:** the staging rule-1 expression with `http.request.uri.query eq ""`
  replaced by
  `any(starts_with(http.request.uri.args.names[*], "utm_"))`, plus
  `and ends_with(http.request.uri.path, "/")`. Everything else (host, method set, session
  cookie exclusion, the 36 exact paths and the prefix list) is copied verbatim from the
  live rule — **read the live dashboard expression first**, as `cache-rules.md` instructs.
  Expression must stay ≤ 4,096 chars (rule 1 is 3,070).
- **Then:** Path → Preserve. Query → Rewrite to → Dynamic:
  `remove_query_args(http.request.uri.query, "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term")`.

Effect: the cache phase runs after `http_request_transform`, so rule 1/4 see the
rewritten (now empty) query and cache under the plain URL's key. A request carrying any
other param keeps that param, fails `query eq ""`, and behaves exactly as today. The
browser URL is not changed (a rewrite is server-side), so the Umami tracker still reads
the UTMs from `location`. The origin no longer sees `utm_*` on these paths; nothing on
the server reads them (`rg utm_` in `apps/*/src` finds only comments).

Residual risk, stated: a redirect issued by the origin on a matched path loses the UTMs
(the origin never saw them). The filter excludes the cases that matter: locale-less paths
(no `/es|en|pt/` prefix → the locale redirect never matches) and slashless paths
(`ends_with "/"` → the trailing-slash redirect never matches). The implementer lists every
`resolveLegacyRedirectTarget` source under the cached prefixes in the doc; if one exists,
it is named as a known loss.

Verification curls (to paste in the doc, run by the owner after applying):

```bash
U=https://staging.hospeda.com.ar/es/presentacion/alojamientos/
curl -s -o /dev/null -D - "$U" | grep -i cf-cache-status                       # MISS then HIT
curl -s -o /dev/null -D - "$U?utm_source=whatsapp&utm_medium=share" | grep -i cf-cache-status  # HIT (same object)
curl -s -o /dev/null -D - "$U?utm_source=x&foo=1" | grep -i cf-cache-status     # DYNAMIC (other param untouched)
curl -s -o /dev/null -D - "https://staging.hospeda.com.ar/?utm_source=x" | grep -iE "location|cache-control"  # Location keeps ?utm_source=x, no-store
```

Use `GET` (never `curl -I`, which reads as a dead rule, `cache-rules.md:51-56`).

Plan check the implementer performs from docs before writing the file: Transform Rules
URL rewrite availability and rule count on the Free plan, and that
`http.request.uri.args.names` with `any(...[*])` is accepted in a URL Rewrite filter. If
either is not available on Free, write it down and stop at "documented, needs owner
decision" instead of improvising another mechanism.

#### 6.C.3 Redirect `no-store` (code)

- New helper in `apps/web/src/lib/middleware-helpers.ts`:
  `buildRedirectResponse({ location, status }): Response` — sets `Location`; when
  `location` contains `?`, also `Cache-Control: no-store`. JSDoc states why (OD-6).
- `middleware.ts` uses it for the three redirects that append `context.url.search`:
  trailing slash (`:298`, `:300`), legacy aliases (`:311`) and locale (`:346`). Auth/profile
  redirects (`:390+`) are out of scope (they are already per-user and uncached).
- Tests in `apps/web/test/middleware.test.ts` (and `lib/middleware-helpers.test.ts`):
  `/?utm_source=x` → 301, `Location: /es/?utm_source=x`, `Cache-Control: no-store`;
  `/alojamientos?utm_source=x` (slashless) same; a query-less redirect has no
  `Cache-Control: no-store`.

### 6.D QR codes, `/go` short links, presentation index

#### 6.D.1 QR redirect destination (OD-9)

Decorate in the API resolve route (`apps/api/src/routes/qr-code/public/resolve.ts`), which
has `entityType` and `purpose`:

- After recording the scan (the row keeps the raw `targetUrlAtScan`, `:196`), compute the
  response `targetUrl` with a pure helper
  `apps/api/src/utils/qr-attribution.ts`:
  `buildQrRedirectTarget({ targetUrl, entityType, purpose, siteUrl }): string`.
  - Only when `isOwnWebUrl` accepts `targetUrl`; external targets are returned unchanged.
  - `campaign`: `certificate` when `purpose = CERTIFICATE`; else from `entityType`:
    `ACCOMMODATION→accommodation`, `VENUE→venue`, `EXPERIENCE→experience`,
    `HOST_TRADE→host-trade`; no entity → `manual`; any other entity type → `manual`.
  - `content`: purpose in kebab-case when present (`listing`, `menu`, `brochure`,
    `host-trade-usage`, `certificate`), omitted when null.
  - `withUtm({ url: targetUrl, source: 'qr', medium: 'print', campaign, content })` —
    which leaves a target that already has UTMs alone.
- The web page (`apps/web/src/pages/qr/[slug].astro`) needs no change: it already 302s to
  `targetUrl` and is never cacheable. Printed codes and stored targets do not change.
- Tests: unit table for `buildQrRedirectTarget`; route test asserting the response
  `targetUrl` carries UTMs while the scan row stores the raw target.

#### 6.D.2 `/go/<slug>` short links (OD-5)

- **Slug table as code:** `apps/web/src/lib/attribution/presentation-links.ts`
  - `PRESENTATIONS` moves here from `presentacion/index.astro:47-90` (same fields), so the
    index and the short links share one list.
  - `PRESENTATION_CHANNELS = ['whatsapp','facebook','x','telegram','copy'] as const`.
  - Audience codes: `alojamientos→aloj`, `comer-y-salir→comer`, `experiencias→exp`,
    `proveedores→prov`, `aliados→aliados`, `editores→edit`. Channel codes:
    `whatsapp→wa`, `facebook→fb`, `x→x`, `telegram→tg`, `copy→link`.
  - `PRESENTATION_SHORT_LINKS`: the full product (6 × 5 = 30), each
    `{ slug: '<audience>-<channel>', audience, channel }`, built by a function so it
    cannot drift.
  - `resolvePresentationShortLink({ slug }): string | null` →
    `withUtm({ url: '/es/presentacion/<audience>/', source: channel, medium: 'direct-outreach', campaign: 'presentacion-<audience>' })`
    (relative URL; `withUtm` accepts a base-relative URL via `new URL(url, 'http://x')`
    and returns it relative). `/es/` because presentations are Spanish under every locale
    by design (index docblock `:8-13`).
  - `buildPresentationShortUrl({ siteUrl, slug })` → `https://hospeda.com.ar/go/<slug>/`.
- **Route:** `apps/web/src/pages/go/[slug].astro`, modelled on `qr/[slug].astro`:
  `applyCacheHeaders({ cacheable: false, … })`, no API call, no session, no cookie
  forwarding; unknown slug → `new Response(null, { status: 404 })`; known → hand-built
  `302` copying `Astro.response.headers` and setting `Location` and
  `Cache-Control: no-store`.
- Add `'/go/'` to `LANGUAGE_NEUTRAL_PREFIXES` (`apps/web/src/lib/routes.ts:126`); without
  it `go` is read as a locale and the route disappears (same reasoning as
  `middleware.ts:328-337`). Update the comment there to name both prefixes.
- `/go/` is excluded from the sitemap (`lib/seo-config.ts` → `SITEMAP_EXCLUDED_PATHS`) and
  disallowed in `robots.txt` if the implementer finds `/qr/` there.
- The canonical presentation pages are not touched: no redirect, no UTM, canonical stays
  `/<lang>/presentacion/<audience>/` (OD-5).

#### 6.D.3 Presentation index buttons

- Under each card of `presentacion/index.astro`, a new island
  `apps/web/src/components/presentacion/PresentationShareRow.client.tsx`
  (`client:visible`, CSS module `PresentationShareRow.module.css`, icons from
  `@repo/icons`) with five actions per presentation:
  - WhatsApp, Facebook, X, Telegram: `<a target="_blank" rel="noopener noreferrer">` to
    `buildShareIntentUrl({ network, url: shortUrl(<audience>-<channel>), title: headline })`.
  - Copy: copies `shortUrl(<audience>-link)` with `navigator.clipboard`, toast on
    success/failure (same pattern as `ShareButtons.client.tsx:142`).
  - The visible text shows the short URL (`hospeda.com.ar/go/aloj-link`).
- The card link itself (`:143`) stays the canonical internal URL with no UTMs.
- Labels through `@repo/i18n` (new keys `presentations.share.{copy,copied,copyFailed,whatsapp,facebook,x,telegram,label}`
  in es/en/pt). The page copy around them stays Spanish as the page already is.
- The page stays cacheable and session-blind: the island reads nothing per-user.

### 6.E Privacy policy, `Attribution` board, `umami:setup`

#### 6.E.1 Privacy policy (OD-7)

- New section in `pages/[lang]/legal/privacidad/index.astro` `sections` (`:35-45`), placed
  after `grabaciones`: `{ id: 'email-y-campanas', titleKey: 'privacy.sections.emailAttribution.title', contentKey: 'privacy.sections.emailAttribution.body', … }`
  with Spanish fallbacks identical to the `es` JSON.
- Copy in `packages/i18n/src/locales/{es,en,pt}/privacy.json` under
  `sections.emailAttribution.{title,body}`. Content (es wording drafted by the
  implementer, reviewed in the PR) must state: (1) our emails contain a small image that
  tells us, in aggregate, how many times an email of a given type was opened; (2) it does
  not identify the recipient — every recipient of the same email gets the same image; (3)
  links in our emails, in shared links, printed QR codes and presentation links carry
  campaign parameters (`utm_…`) that tell us which channel a visit came from, analysed
  with our self-hosted Umami; (4) our email provider Brevo also measures opens and clicks
  of newsletter emails; (5) image blocking and privacy features of mail apps make the
  count approximate; (6) there is no individual opt-out, and blocking images in the mail
  client prevents the count.
- Guard: `packages/i18n/test/email-attribution-legal-copy.guard.test.ts`, modelled on
  `session-recording-legal-copy.guard.test.ts`: the section exists in all three locales,
  non-empty, and each body mentions `Brevo` and `utm`.

#### 6.E.2 `Attribution` board (OD-10)

In `scripts/umami/boards.ts`, a seventh `BoardSpec` named `Attribution`:

- Row 1: `metricsTable` `utmSource` · `metricsTable` `utmMedium`.
- Row 2: `metricsTable` `utmCampaign` · `metricsTable` `utmContent`.
- Row 3: conversions — `goal` components for `Goal · Registros completados` and
  `Goal · Contactos completados` (existing goals, `definitions.ts:278`).
- New saved reports in `definitions.ts` (`HOSPEDA_ATTRIBUTION_REPORTS`), type
  `attribution`, parameters `{ model: 'first-click', type: 'event', step: <event> }`
  (shape measured in T-038) for `sign_up_completed` and `contact_owner_completed`. If the
  Umami 3.5.0 board editor registry has an attribution component (M-3), add them as
  row 4; otherwise they stay as saved reports and `docs/analytics/umami-dashboards.md`
  says where to open them.
- Board tests in `scripts/__tests__/umami-boards.test.ts` pin the name and rows.

#### 6.E.3 Per-template pixels in `umami:setup` (OD-2)

The setup script cannot import `@repo/notifications` (root depends on `@repo/config`
only, and the catalog pulls React templates). Repo pattern for this is a committed,
drift-guarded generated file:

- `packages/notifications/scripts/generate-email-pixel-manifest.ts` (script
  `email:pixel-manifest` in that package) writes
  `packages/notifications/generated/email-pixel-manifest.json`:
  `[{ key, name, utmCampaign, pixelSlug }]` sorted by key, from `EMAIL_CATALOG` and the
  `@repo/analytics` slug helpers. `name` = `Email · <entry.name>` (the catalog's Spanish
  name).
- The guard in §6.A.5 fails if the committed manifest differs from what the catalog
  produces (message: run `pnpm --filter @repo/notifications email:pixel-manifest`).
- `scripts/umami/pixels-client.ts`: `listPixels` (paginated, `GET /api/pixels`),
  `upsertPixel({ slug, name })` — create when the slug is absent, update the name
  (`POST /api/pixels/:id`, full body) when it differs, unchanged otherwise; dry-run
  performs reads only. Natural key: `slug`.
- `setup.ts` reads the manifest, upserts every pixel after the boards, adds a
  `pixels` row to its summary, and reports **unmanaged** pixels whose slug starts with
  `email-` but is not in the manifest (never deletes them). `newsletter-*` pixels are
  owned by the api and ignored.
- Tests in `scripts/__tests__/umami-setup.test.ts` with the existing `umami-fake.ts`:
  first run creates N, second run changes nothing (idempotent), renamed entry updates the
  name, unmanaged is reported.

### 6.F Umami facts to measure before coding (part of the PR, not a separate spike)

Measured against local Umami 3.5.0 (docker, as in HOS-2119 T-0) and recorded in
`.specs/HOS-2359-campaign-attribution/docs/umami-pixels-findings.md`. Context7 docs for the
Umami API confirm `POST /api/pixels` with body `{ slug, name }` returning
`{ id, name, slug, userId, teamId, … }`, `GET /api/pixels` with the list envelope, and
`GET|POST|DELETE /api/pixels/:id`; everything else below is **not verified**.

- M-1 `POST /api/pixels`: slug charset and max length, conflict status/body on a duplicate
  slug, and that a `user`-role API key can create pixels (and a `view-only` one cannot).
- M-2 Tracking URL: the public path (expected `/p/<slug>`), method, response
  (image/status), that one `GET` increments the pixel's count, and whether a Gmail image
  proxy User-Agent (`GoogleImageProxy`) is counted or dropped as a bot. If dropped, note it
  as a limitation in the findings and in `docs/analytics/umami-dashboards.md`; do not work
  around it.
- M-3 Board editor registry: whether an `attribution` or pixel component exists.
- M-4 `GET /api/pixels?search=` behaviour (substring like reports → exact match client-side).

If M-1 shows a slug limit below 90, shorten the prefixes (`e-`, `n-`) in one place and
update the guard; if M-2 shows a different path, change `UMAMI_PIXEL_PATH`.

## 7. Data model / contracts

| Kind | Change |
|---|---|
| DB | `newsletter_campaigns.attribution_slug varchar(64) NULL`, `newsletter_campaigns.umami_pixel_slug varchar(100) NULL` — one generated migration, additive. Record it on the Linear issue ("Migrations added") |
| Env | `HOSPEDA_UMAMI_PIXEL_API_KEY` (api, secret, optional). Label the PR `release-env-var-change` if that label is in use. Record on the Linear issue ("Env vars added/changed") |
| Types | `EmailAttribution` (`@repo/email`); required `attribution` on `renderEmailBodies`, `sendEmail`, notifications `SendEmailInput`, service-core `SingleEmailTransport`, `RenderCampaignEmailFn` |
| Package deps | `@repo/analytics` added to `packages/email`, `packages/notifications`, `packages/service-core` (workspace packages, no third-party dependency) |
| API response | `GET /api/v1/public/qr/:slug` — `targetUrl` now carries UTMs for own-origin targets. Schema unchanged |
| Routes | New web route `/go/<slug>/` (302/404) |
| Generated file | `packages/notifications/generated/email-pixel-manifest.json` (committed, drift-guarded) |
| Cloudflare | Two URL Rewrite Rules (manual, owner-applied), documented in `infra/cloudflare/rules/` |

## 8. Acceptance criteria

- **AC-1** Given any `EMAIL_CATALOG` entry and scenario, when it is rendered with
  `{ medium:'transactional', templateKey: entry.key, includePixel: true }`, then every
  link whose origin is in `buildOwnWebOrigins` has `utm_source=email`,
  `utm_medium=transactional`, `utm_campaign=<toUtmToken(key)>` and a non-empty
  `utm_content`, and links to other hosts are byte-identical to the unattributed render.
- **AC-2** Given the same render, then the HTML contains exactly one
  `<img src="<HOSPEDA_UMAMI_URL>/p/email-<toUtmToken(key)>" width="1" height="1" alt="">`
  before `</body>`, with no query string, and the text part contains no pixel URL.
- **AC-3** Given two renders of the same template for two different recipients, then the
  pixel `src` values are identical.
- **AC-4** Given `HOSPEDA_UMAMI_URL` unset or not `https:`, when any email renders, then
  it has UTMs and no pixel.
- **AC-5** Given the admin preview of any entry, then it has UTMs and no pixel.
- **AC-6** Given `auth.reset-password` and `auth.verify-email` are sent through
  `sendAppEmail`, then each carries its own pixel (`email-auth-reset-password`,
  `email-auth-verify-email`) and its footer links carry UTMs.
- **AC-7** Given a new catalog entry is added without regenerating the manifest, when CI
  runs, then the attribution guard fails naming the missing key.
- **AC-8** Given a link that already has `utm_source`, when `withUtm` runs, then the URL
  is returned unchanged.
- **AC-9** Given an invalid combination (e.g. `medium:'share', source:'qr'`), when
  `withUtm` runs, then it throws `InvalidUtmParamsError`.
- **AC-10** Given a draft campaign and a reachable Umami with a valid pixel key, when it
  is sent, then exactly one pixel `newsletter-<attribution_slug>` exists in Umami, both
  columns are stored, and every delivered message's HTML contains that pixel once and
  campaign UTMs on own-origin links.
- **AC-11** Given Umami times out (> 3000 ms), answers 5xx, or the pixel key is unset,
  when a campaign is sent, then `send()` succeeds within the timeout budget plus normal
  work, `umami_pixel_slug` is `NULL`, the messages have UTMs and no pixel, and one `warn`
  is logged.
- **AC-12** Given a pixel slug that already exists (retried dispatch), when the
  provisioner runs, then it returns the existing slug and creates nothing.
- **AC-13** Given a newsletter test send, then the message has campaign UTMs and no pixel.
- **AC-14** Given a share action on a post, event or accommodation detail page, then the
  shared URL is the canonical URL plus `utm_source=<whatsapp|facebook|x|telegram|share|copy>`,
  `utm_medium=share`, `utm_campaign=<post|event|accommodation>`, and the page's
  canonical/OG URLs carry no UTMs.
- **AC-15** Given `GET /?utm_source=x` (and `/alojamientos?utm_source=x`), when the
  middleware redirects, then `Location` keeps the query and the response has
  `Cache-Control: no-store`; a redirect without a query has no `no-store`.
- **AC-16** Given a QR code whose target is an own-origin URL, when `/qr/<slug>/` is
  scanned, then the 302 `Location` carries `utm_source=qr`, `utm_medium=print`,
  `utm_campaign=<accommodation|venue|experience|host-trade|certificate|manual>` and
  `utm_content=<purpose>` when the code has one, while `qr_code_scans.target_url_at_scan`
  stores the raw target; an external target is returned unchanged.
- **AC-17** Given each of the 30 `/go/<slug>/` slugs, then the route answers 302 to
  `/es/presentacion/<audience>/?utm_source=<channel>&utm_medium=direct-outreach&utm_campaign=presentacion-<audience>`
  with `Cache-Control: no-store`; an unknown slug renders the 404 page; `/go/aloj-wa`
  (slashless) gets the trailing-slash redirect, not a locale redirect.
- **AC-18** Given `/es/presentacion/alojamientos/` requested directly, then it is served
  (200) with no redirect and its canonical is unchanged.
- **AC-19** Given the `/presentacion/` index, then each of the six cards shows WhatsApp,
  Facebook, X, Telegram and Copy actions whose URLs are that presentation's short links,
  the card link has no UTMs, and the page still passes the session-blind guard.
- **AC-20** Given any file under `apps/web/src`, `apps/api/src` or
  `packages/notifications/src`, then it contains no `utm_` literal (guards).
- **AC-21** Given the privacy page in es, en and pt, then the "email and campaigns" section
  exists, and its body mentions Brevo and `utm` (guard).
- **AC-22** Given `pnpm umami:setup` runs twice against a fake Umami, then the second run
  reports zero created/updated pixels, boards and reports, and the `Attribution` board has
  the rows in §6.E.2.
- **AC-23** Given the Cloudflare doc, then it contains the exact filter expression, the
  rewrite expression, the plan checks and the verification curls, and no rule was applied
  from code.

## 9. Test plan

| Level | File (new unless noted) | Covers |
|---|---|---|
| Unit | `packages/analytics/test/attribution-with-utm.test.ts` | vocabulary per medium, ordering, hash/param preservation, existing-UTM no-op, invalid → throw (AC-8, AC-9) |
| Unit | `packages/analytics/test/attribution-slugs.test.ts` | `toUtmToken`, template/campaign/pixel slugs, 40-char cut, empty title |
| Unit | `packages/analytics/test/attribution-own-origin.test.ts` | own origins, admin/api/external hosts rejected |
| Unit | `packages/email/test/attribution.test.ts` | `applyEmailAttribution`: slots, `&amp;` round-trip, mailto/tel/anchors skipped, text replacement, pixel placement/absence, https-only (AC-2–AC-4) |
| Unit | `packages/email/test/render.test.tsx` (edit) | `renderEmailBodies` requires and applies `attribution` |
| Unit | `packages/email/test/send.test.ts` (edit) | `sendEmail` forwards attribution into the Brevo body |
| Unit | `packages/notifications/test/templates/button.test.tsx` | `data-utm-content` reaches the `<a>` |
| Guard | `packages/notifications/test/catalog/catalog-attribution.guard.test.ts` | AC-1, AC-2, AC-7, slug uniqueness/length, manifest drift, non-vacuity |
| Unit | notifications transport + `notification.service` + outbox + alert channel tests (edit) | each passes the exact catalog key |
| Unit | `packages/service-core/test/services/newsletter/*` (edit) | dispatch stores both columns; provisioner null/reject → no pixel; batch passes attribution; test send no pixel (AC-10–AC-13) |
| Unit | `apps/api/test/lib/umami-pixel-client.test.ts` | create, conflict → lookup, timeout, 5xx, unset env, token redaction (AC-11, AC-12) |
| Unit | `apps/api/test/utils/qr-attribution.test.ts` | campaign/content mapping table, external untouched |
| Route | `apps/api/test/routes/qr-code/resolve.test.ts` (edit) | decorated `targetUrl`, raw scan row (AC-16) |
| Unit | `apps/api/test/lib/auth*.test.ts`, conversation mailer/cron tests (edit) | correct `templateKey` per send |
| Unit | `apps/web/test/lib/share-intents.test.ts` | four intent builders |
| Component | `apps/web/test/components/ShareButtons.test.tsx` (edit or new) | per-action UTMs (AC-14) |
| Unit | `apps/web/test/lib/attribution/presentation-links.test.ts` | 30 slugs, uniqueness, resolution, every `PRESENTATIONS` entry covered |
| Page | `apps/web/test/pages/go-short-link.test.ts` | 302/404/no-store (AC-17) |
| Middleware | `apps/web/test/middleware.test.ts`, `test/lib/middleware-helpers.test.ts` (edit) | AC-15, `/go/` language-neutral |
| Component | `apps/web/test/components/presentacion/PresentationShareRow.test.tsx` | AC-19 |
| Guard | `apps/web/test/static-guards/utm-only-through-helper.guard.test.ts`, api + notifications twins | AC-20 |
| Guard | `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts` (existing, must stay green) | index + `/go` |
| Guard | `packages/i18n/test/email-attribution-legal-copy.guard.test.ts` | AC-21 |
| Script | `scripts/__tests__/umami-setup.test.ts`, `umami-boards.test.ts`, new `umami-pixels.test.ts` | AC-22 |
| Config | `packages/config/src/__tests__/env-registry.test.ts` (edit), `pnpm env:check:registry` | env var |

Also run before the PR: `pnpm check:guards`, the affected packages' typecheck with
`CI=true`, and `pnpm db:generate` drift (migration committed). Do not run whole-package
suites locally where the repo memory warns against it; run the touched files and let CI run
the rest.

## 10. Risks

- **R-1 Open counts are a trend, not a number.** Apple Mail Privacy Protection prefetches
  images (inflates), image blocking hides opens (deflates), Gmail proxies images (one
  proxy request may represent several opens, and may be dropped as a bot — M-2). Stated in
  the privacy copy and in `umami-dashboards.md`.
- **R-2 Pixel slugs are public and guessable.** Anyone can inflate a counter by requesting
  the URL. Accepted: the data is aggregate and non-critical.
- **R-3 Write credential on the api.** Mitigated: dedicated `user`-role account, used only
  to create pixels, secret in Coolify, never logged.
- **R-4 Edge rewrite drops UTMs for an origin redirect on a matched path.** Mitigated by
  the filter (§6.C.2); remaining legacy aliases are listed in the doc.
- **R-5 Deploy order.** Web and api deploy separately in Coolify. If the api ships first,
  pixels fire before the privacy section is public (OD-7). Mitigation in §11.
- **R-6 Template key renames** start a new pixel/campaign series. Accepted; the manifest
  guard makes it visible in review.
- **R-7 Regex-based HTML rewriting.** Bounded by React's deterministic output and covered
  by rendering all 125 templates in the guard.
- **R-8 Umami API shape differences** (pixels endpoint, path). Mitigated by M-1..M-4 before
  coding and by fail-open behaviour.

## 11. Rollout

1. Merge the single PR to `staging` (title `[HOS-2359] feat: campaign attribution in Umami`
   — the PR body carries `Closes HOS-2359` only if it completes the spec, which it does).
2. **Owner/ops, staging:** create Umami user `hospeda-api-pixels` (role `user`) on
   `pulso-staging`, mint its API key, `hops env-set api-staging HOSPEDA_UMAMI_PIXEL_API_KEY --secret`,
   then redeploy (redeploys need the owner's explicit OK).
3. **Owner/ops, staging:** run `pnpm umami:setup` against staging Umami (creates the
   125 pixels and the `Attribution` board).
4. **Owner, staging:** apply the staging URL Rewrite Rule from the Cloudflare doc and run
   its verification curls. Record the result in the doc (date, measurements).
5. Run the staging smoke (§12) and sign off with `/smoke HOS-2359`.
6. Promotion to `main`: **deploy web before api** in Coolify so the privacy section is live
   before any production email carries a pixel (R-5, OD-7). Then repeat steps 2–4 for
   production (`pulso`, `hospeda-api-prod`, the prod rewrite twin).

## 12. Staging smoke checklist (`status-needs-smoke-staging`)

- [ ] Privacy page `/es|en|pt/legal/privacidad/` shows the new section.
- [ ] Trigger a password reset to a real inbox: footer link has
  `utm_source=email&utm_medium=transactional&utm_campaign=auth-reset-password&utm_content=home`;
  opening the mail increments pixel `email-auth-reset-password` in Umami → Pixels.
- [ ] Trigger one notification and one outbox email (e.g. a listing notice): CTA link has
  `utm_content=cta`; its pixel increments.
- [ ] Send a newsletter test send: UTMs present, no pixel.
- [ ] Send a real newsletter campaign to a test segment: a `newsletter-…` pixel exists in
  Umami; the received mail's links carry `utm_medium=campaign`; opening increments it.
- [ ] With `HOSPEDA_UMAMI_PIXEL_API_KEY` temporarily unset (or Umami stopped), a campaign
  still sends without a pixel (only if the owner approves the env change/redeploy).
- [ ] Share a post via WhatsApp and copy: the landing visit appears in Umami with
  `utm_source=whatsapp|copy`, `utm_campaign=post`.
- [ ] Scan (or open) an accommodation QR `/qr/<slug>/`: lands with
  `utm_source=qr&utm_medium=print&utm_campaign=accommodation&utm_content=listing`; the
  experience certificate QR shows `utm_campaign=certificate`.
- [ ] Open `/go/aloj-wa/`: 302 to `/es/presentacion/alojamientos/?utm_source=whatsapp&…`;
  the visit shows in Umami under that campaign. `/presentacion/` index buttons hand out
  the short links.
- [ ] After the Cloudflare rule: the four verification curls answer as documented.
- [ ] `Attribution` board renders in Umami with UTM tables and goals.

## 13. Open questions for owner

None blocking. Two confirmations are folded into steps the owner already performs:

1. **Cloudflare mechanism (§2.1 item 1):** OD-6 is implemented as a URL Rewrite Rule
   because per-param cache-key exclusion is Enterprise-only on this Free zone. The owner
   sees the exact rule when applying it (rollout step 4).
2. **Defaults, reversible:** copy button `source=copy` on presentations; `campaign=manual`
   for entity-less QR codes; `utm_content` = QR purpose. Changing any is a one-line edit in
   the vocabulary/mapping.

## 14. File map

| Area | Files |
|---|---|
| analytics | `packages/analytics/src/attribution/{vocabulary,with-utm,own-origin,email-attribution-slugs,index}.ts`, `src/index.ts` (export) |
| email | `packages/email/src/attribution.ts`, `render.ts`, `send.ts`, `email-assets.ts`, `index.ts`, `package.json`, `README.md`, `CLAUDE.md` |
| notifications | `src/transports/email/{email-transport.interface,resend-transport,mock-transport}.ts`, `src/services/notification.service.ts`, `src/services/outbox/email-outbox-delivery.service.ts`, `src/services/channels/email-alert.channel.tsx`, `src/catalog/render-scenario.ts`, `src/templates/components/button.tsx`, `scripts/generate-email-pixel-manifest.ts`, `generated/email-pixel-manifest.json`, `package.json` |
| service-core | `src/services/newsletter/newsletter-campaign.service.ts`, `newsletter-delivery.service.ts`, `package.json` |
| db | `packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema.ts`, generated migration |
| api | `src/lib/umami-pixel-client.ts`, `src/utils/qr-attribution.ts`, `src/routes/qr-code/public/resolve.ts`, `src/services/newsletter/delivery-factory.ts`, `src/utils/email-sender.ts`, `src/lib/auth.ts`, `src/lib/conversation-mailer.ts`, the two conversation crons, `src/index.ts` (`configureEmailAssets`), `src/utils/env-schema.ts`, `.env.example` |
| config | `packages/config/src/env-registry.hospeda.ts`, `src/__tests__/env-registry.test.ts` |
| web | `src/lib/share-intents.ts`, `src/components/ShareButtons.client.tsx`, three call sites, `src/lib/attribution/presentation-links.ts`, `src/pages/go/[slug].astro`, `src/lib/routes.ts`, `src/lib/middleware-helpers.ts`, `src/middleware.ts`, `src/pages/[lang]/presentacion/index.astro`, `src/components/presentacion/PresentationShareRow.client.tsx` + `.module.css`, `src/pages/[lang]/legal/privacidad/index.astro`, `src/lib/seo-config.ts` |
| i18n | `packages/i18n/src/locales/{es,en,pt}/privacy.json`, presentation share keys |
| scripts | `scripts/umami/{boards,definitions,setup}.ts`, `scripts/umami/pixels-client.ts`, tests in `scripts/__tests__/` |
| docs | `infra/cloudflare/rules/transform-rules.md` (new) + note in `cache-rules.md`, `docs/analytics/umami-dashboards.md`, `docs/guides/environment-variables.md`, `docs/analytics/README.md` (attribution convention incl. profile/bio links), `.specs/HOS-2359-campaign-attribution/docs/umami-pixels-findings.md` |
