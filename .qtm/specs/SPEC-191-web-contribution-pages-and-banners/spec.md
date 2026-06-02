---
specId: SPEC-191
title: Web Contribution Pages & Banners — /colaborar hub, report link & recruitment banners
slug: web-contribution-pages-and-banners
type: feature
status: draft
complexity: medium
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-191-web-contribution-pages-and-banners
worktree: /home/qazuor/projects/WEBS/hospeda-spec-191-web-contribution-pages-and-banners
linearIssues:
  - BETA-69
  - BETA-68
  - BETA-65
tags:
  - web
  - contributions
  - contact
  - banners
  - analytics
  - i18n
---

# SPEC-191 — Web Contribution Pages & Banners

> Skeleton note: this is the formalized functional spec. Tasks and `index.json`
> updates are produced by the caller after this file lands — do not generate them here.

## 1. Origin & problem statement

Three Linear issues from the "Beta Feedback" backlog all ask the public web app
(`apps/web`) to give visitors a way to *contribute* something back — a correction, a
photo, or editorial help — and currently there is no surface for any of them. They are
independent symptoms of the same gap: the web app has a polished read path but no
"give back" path. This spec bundles them into a single **contribution hub** under
`/[lang]/colaborar/`, three deep-linkable forms, one reusable banner component, and
the surfaces that funnel visitors into them.

### BETA-69 (Medium) — "Reportar información incorrecta en destinos"

A visitor who spots wrong or incomplete information on a destination detail page has no
way to flag it. The ask: a link on the destination detail page that opens a report
form **pre-filled with the destination context**, so the team can act on the report
without the reporter having to re-state which destination they were on.

### BETA-68 (Low) — "Convocatoria de fotos de destinos"

Many destinations have weak or missing photography. The ask: a banner calling on the
community to submit photos of destinations, with a page that states the usage / license
terms and a submission form.

### BETA-65 (Low) — "Convocatoria de editores para blog y eventos"

The blog (publicaciones) and events sections need volunteer editors/contributors. The
ask: a banner recruiting editors on the blog and events listings, with a recruitment
page, and **the click-through must be measurable** so we can judge the campaign.

## 2. Current architecture (verified facts)

| Concern | Location | State today |
|---------|----------|-------------|
| Contact endpoint | `apps/api/src/routes/contact/submit.ts` (`POST /api/v1/public/contact`, `createSimpleRoute`, `skipAuth: true`) | Validates `ContactSubmitSchema`; honeypot (`website`); rate-limit 5 req / 60 s per IP; **sends an email** to the support inbox via `@repo/notifications` (`NotificationType.CONTACT_SUBMISSION`, Resend) + structured audit log. **No DB row, no Linear.** |
| Contact schema | `packages/schemas/src/contact/submit.ts` (`ContactSubmitSchema`, `ContactTypeEnumSchema`, `ContactSubmitInput`) | `type` enum: `general`, `support`, `publish_accommodation`, `subscriptions`, `suggestions`, `report`, `press`, `partnerships`, `event_submission`, `accommodation` (last is DEPRECATED, kept additive-only). Fields: `firstName`, `lastName`, `email`, `message` (10–2000), `type`, optional `accommodationId` (uuid), `website` (honeypot). |
| Contact form island | `apps/web/src/components/ContactForm.client.tsx` | React island (`client:visible`). `CONTACT_TYPE_OPTIONS` drives the `<select>`. **Deep-link prefill** via `useEffect` reading `?type=` (validated against allowed set) and `?message=` (capped 2000). Validates with `ContactSubmitSchema.safeParse`, POSTs to `${PUBLIC_API_URL}/api/v1/public/contact`, surfaces 429 specially, shows inline success. Honeypot `website` field hidden via CSS. |
| Contact page | `apps/web/src/pages/[lang]/contacto/index.astro` | `export const prerender = true`; `getStaticPaths` enumerates `es`/`en`/`pt`; mounts `<ContactForm locale={locale} client:visible />`. The template pattern to mirror for the new pages. |
| Banner pattern | `apps/web/src/components/newsletter/WhatsAppCTA.astro` | Icon + title + description + CTA `<a>`, scoped CSS via `*.module.css`, `data-source` prop, hoisted `<script>` that pushes a `dataLayer` event on click. Renders nothing when its env URL is unset. The structural template for `ContributionBanner.astro`. |
| Analytics wrapper | `apps/web/src/lib/analytics/posthog-client.ts` (`trackEvent(name, props)`) | Thin `window.posthog?.capture` wrapper; SSR no-op; safe before SDK load. |
| Analytics catalog | `apps/web/src/lib/analytics/events.ts` (`WebEvents`, `WebEventName`) | Typed `snake_case` `<entity>_<verb_past>` event-name catalog. Today: `accommodation_searched`, `accommodation_viewed`, `signup_completed`, `booking_initiated`, `newsletter_subscribed`. |
| Destination detail page | `apps/web/src/pages/[lang]/destinos/[...path].astro` | SSR + ISR. Description section at lines ~414-418 (`.dest-detail__description`). Sidebar slot (lines ~568-588) renders `DestinationSidebarCtas`. Exposes `slug`, `name`, `destId`. |
| Destination sidebar CTAs | `apps/web/src/components/destination/DestinationSidebarCtas.astro` | Card of icon+label+hint+arrow rows (props: `slug`, counts, `locale`). The row pattern to extend for the BETA-69 report link. |
| Destination listing | `apps/web/src/pages/[lang]/destinos/index.astro` + `destinos/page/[page].astro` | Listing mount points for the fotos banner. |
| Blog listing | `apps/web/src/pages/[lang]/publicaciones/index.astro` + `publicaciones/page/[page].astro` | Listing mount points for the editores banner. |
| Events listing | `apps/web/src/pages/[lang]/eventos/index.astro` + `eventos/page/[page].astro` | Listing mount points for the editores banner. |
| Web i18n | `apps/web/src/lib/i18n.ts` (`createTranslations(locale)` → `{ t, tPlural }`); locales at `packages/i18n/src/locales/{es,en,pt}/<namespace>.json` | One JSON file per namespace (e.g. `contact.json`). `t(key, fallback)` resolves against the merged namespaces with an inline fallback string. |

### Patterns NOT used here (explicit context)

- **`@repo/feedback` / Linear** is NOT used for these submissions. The Feedback FAB
  routes to its own pipeline; the owner decided contributions live under `/colaborar`
  and flow through the **contact** pipeline instead. (See §3 non-goals and §10 D-1.)
- **`GlobalAnnouncements`** (admin-managed global banner) is explicitly **rejected** for
  these banners: it has no per-CTA link, it is global rather than surface-scoped, and it
  is admin-CRUD-managed. The new banner is a hardcoded, surface-placed component.

### Project rules that constrain this work

- Web styling is **vanilla CSS / CSS Modules** (`*.module.css` colocated). NO Tailwind
  utility classes (Tailwind is admin-only).
- Web forms are native HTML + small custom hooks / React islands (NOT TanStack Form).
- Static info pages set `export const prerender = true` and enumerate `es`/`en`/`pt` in
  `getStaticPaths`.
- All user-facing copy comes from `@repo/i18n` (es/en/pt); never hardcode strings.
- Zod schemas in `@repo/schemas` are the single source of truth for types; schema
  changes are **additive-only** so historical fixtures keep parsing.
- Icons come from `@repo/icons`; data fetching from `apps/web/src/lib/api`.

## 3. Goals & non-goals

### Goals

1. A `/[lang]/colaborar/` contribution hub (SSG) with a landing page plus three
   sub-pages: `reportar`, `fotos`, `editores`.
2. A reusable `ContributionBanner.astro` component (pattern: `WhatsAppCTA.astro`) with
   built-in PostHog click tracking.
3. A "report incorrect information" link on the destination detail page that deep-links
   into `/colaborar/reportar` pre-filled with the destination context.
4. Banner mounts that funnel visitors: destination detail + destination listing →
   `/colaborar/fotos`; blog listing + events listing → `/colaborar/editores`.
5. Additive new contact types (`report_destination_info`, `photo_submission`,
   `editor_application`) so all three forms reuse the existing contact pipeline.
6. Typed PostHog events for banner clicks (per surface) and form submits (per
   contribution type), satisfying BETA-65's measurement requirement and applied to all
   three for consistency.
7. Full es/en/pt i18n via a new `contributions` namespace (en/pt fall back to es until
   translated).

### Non-goals (explicitly out of scope)

1. **Using `@repo/feedback` / Linear for the report.** The owner decided contributions
   route through `/colaborar` + the contact pipeline. Do not wire these into feedback.
2. **Using `GlobalAnnouncements` for the banners.** Rejected (no per-CTA link, global
   not surface-scoped, admin-CRUD). The banner is a hardcoded component.
3. **Admin CRUD of these banners.** Banner copy/placement is hardcoded in code per the
   earlier decision (consistent with how `WhatsAppCTA` works). No admin UI.
4. **Changing the contact pipeline's existing types or behavior.** The nine existing
   types, the honeypot, the rate limit, and the email-to-inbox dispatch are unchanged;
   only new enum values and their labels are added.
5. **A new persistence layer / DB table for submissions.** Submissions land where
   contact submissions land today (email + logs). See §6 risk on traceability and the
   conditional follow-up flag — but do NOT build a DB table in this spec.
6. **Any `apps/admin` changes.**

## 4. Functional requirements & acceptance criteria

### FR-1 — Additive contact types + pipeline verification (BETA-69/68/65)

Extend `ContactTypeEnumSchema` in `packages/schemas/src/contact/submit.ts` with three
new values, additive-only (appended, no reordering, existing values untouched):

- `report_destination_info` — content-error report from a destination page.
- `photo_submission` — destination photo contribution.
- `editor_application` — blog/events editor recruitment.

Add matching human-readable Spanish labels to `CONTACT_TYPE_LABELS` in
`apps/api/src/routes/contact/submit.ts` (e.g. "Reporte de información de destino",
"Aporte de fotos", "Postulación de editor") so triage in the support inbox is clear.

The submission still flows through `POST /api/v1/public/contact` → sanitize → honeypot →
email to support inbox via `@repo/notifications` + audit log. No new endpoint (see §10
D-2 for the justification that the contact pipeline can carry these).

```
Given the contact schema gains report_destination_info, photo_submission, editor_application
  When ContactSubmitSchema parses a payload with type "photo_submission"
  Then validation passes and the existing nine types still parse unchanged

Given a historical fixture using type "general" (or the deprecated "accommodation")
  When it is parsed by the extended schema
  Then it still parses (additive-only, no breaking change)

Given a submission with type "report_destination_info" reaches the contact handler
  When the honeypot is empty and the body is valid
  Then an email is dispatched to the support inbox with a label that identifies it as a destination-info report
  And the audit log records contactType "report_destination_info" without PII beyond the email domain
```

### FR-2 — `/colaborar/` hub landing page

Create `apps/web/src/pages/[lang]/colaborar/index.astro`, SSG (`prerender = true`,
`getStaticPaths` over `es`/`en`/`pt`), styled with vanilla CSS / a colocated CSS module,
linking the three contribution paths.

```
Given a visitor opens /es/colaborar/
  When the page renders
  Then it shows a hero plus three cards/links to /colaborar/reportar, /colaborar/fotos, /colaborar/editores
  And the page is statically prerendered (no SSR) for es, en and pt

Given the visitor switches locale to /en/colaborar/ or /pt/colaborar/
  When the page renders
  Then all copy resolves from the contributions i18n namespace (es fallback if en/pt missing)
```

### FR-3 — `/colaborar/reportar/` report form, pre-filled with destination context (BETA-69)

Create `apps/web/src/pages/[lang]/colaborar/reportar/index.astro` (SSG) that mounts the
contact form **preset to `report_destination_info`** and reads a destination-context
query param. Locked param name: **`?destino=<slug>`** (a human-readable slug, consistent
with how destination URLs are addressed on web). The page passes the slug into the form
so the submission's `message` is seeded with the destination context (e.g.
`"Reporte sobre el destino: <slug>. "`), giving the team the "which destination" answer.

Reuse `ContactForm` via its existing deep-link mechanism — the simplest path is to
navigate to it with `?type=report_destination_info&message=<seeded text>` — OR a thin
variant `ContributionForm.client.tsx` that hard-locks `type` and hides the type select
while keeping the same validation + POST. Step-1 confirms `ContactForm` already honors
`?type=` and `?message=`, so the reuse path is viable without a new component; choose the
thinner option at build time (see §10 D-3).

```
Given a visitor opens /es/colaborar/reportar?destino=colon
  When the form renders
  Then the contact type is preset to report_destination_info (and not user-changeable in the report context)
  And the message field is seeded with the destination slug "colon" as context

Given the report form has the destination context seeded
  When the visitor completes name/email/message and submits
  Then it POSTs to /api/v1/public/contact with type "report_destination_info"
  And on success the inline success confirmation is shown

Given /colaborar/reportar is opened with no destino param
  When the form renders
  Then it still works (generic content-error report, no seeded destination), preset to report_destination_info
```

### FR-4 — `/colaborar/fotos/` photo-call page + license terms (BETA-68)

Create `apps/web/src/pages/[lang]/colaborar/fotos/index.astro` (SSG): the call-for-photos
copy, an explicit **usage / license terms** section, and a submission form preset to
`photo_submission`. The license copy is product/legal content sourced from i18n (see §6
content dependency — owner/legal must sign off on the exact terms before launch).

```
Given a visitor opens /es/colaborar/fotos/
  When the page renders
  Then it shows the photo-call copy AND a clearly-labelled usage/license terms section
  And it mounts a contact form preset to type "photo_submission"

Given the visitor submits the photo form
  When the submission succeeds
  Then it POSTs type "photo_submission" to /api/v1/public/contact and shows the success confirmation
```

### FR-5 — `/colaborar/editores/` editor-recruitment page (BETA-65)

Create `apps/web/src/pages/[lang]/colaborar/editores/index.astro` (SSG): recruitment copy
plus a form preset to `editor_application`.

```
Given a visitor opens /es/colaborar/editores/
  When the page renders
  Then it shows recruitment copy and a contact form preset to type "editor_application"

Given the visitor submits the editor form
  When the submission succeeds
  Then it POSTs type "editor_application" to /api/v1/public/contact and shows the success confirmation
```

### FR-6 — `ContributionBanner.astro` reusable component (BETA-68/65)

Create `apps/web/src/components/contributions/ContributionBanner.astro` modeled on
`WhatsAppCTA.astro`. Props (locked):

- `title: string`, `description: string`, `ctaLabel: string` — display copy (callers
  pass already-translated strings, mirroring `WhatsAppCTA`).
- `ctaHref: string` — the internal link (e.g. a `buildUrl` to `/colaborar/fotos`).
- `source: string` — surface identifier forwarded to analytics (e.g.
  `destination_detail`, `destination_listing`, `blog_listing`, `events_listing`).
- `variant?: 'photos' | 'editors'` — selects the icon + accent styling.

Styling via a colocated `ContributionBanner.module.css` (vanilla CSS, no Tailwind). On
CTA click it fires a typed PostHog event (FR-9) carrying `source` and `variant`.

```
Given ContributionBanner is rendered with title/description/ctaLabel/ctaHref/source/variant
  When the page renders
  Then it shows the icon (per variant), title, description and a CTA anchor pointing at ctaHref

Given a visitor clicks the banner CTA
  When the click handler runs
  Then trackEvent fires the contribution_banner_clicked event with the banner's source and variant
  And the navigation to ctaHref proceeds

Given the banner is rendered on a narrow viewport
  When it lays out
  Then it reflows without horizontal overflow (icon/title/description/CTA stack)
```

### FR-7 — Destination-detail report link (BETA-69)

Add a "Reportar información incorrecta" affordance on the destination detail page
(`destinos/[...path].astro`) linking to
`buildUrl({ locale, path: 'colaborar/reportar' })` with `?destino=<slug>` appended. Locked
placement: a **row inside `DestinationSidebarCtas.astro`** (extend the existing card with a
third row using the established icon+label+hint+arrow pattern), AND an inline text link
directly after the description section (`.dest-detail__description`) for discoverability.
Both point to the same prefilled URL.

```
Given a destination detail page for slug "colon"
  When it renders
  Then DestinationSidebarCtas shows a "Reportar información incorrecta" row linking to /<lang>/colaborar/reportar?destino=colon
  And an inline report link appears after the description section pointing to the same URL

Given the visitor clicks the report link
  When they land on /colaborar/reportar?destino=colon
  Then the report form is preset to report_destination_info with the destination context seeded (FR-3)
```

### FR-8 — Banner mount points

Mount `ContributionBanner` on the four surfaces (locked):

- `/colaborar/fotos` banner (`variant: 'photos'`) on: destination **detail**
  (`destinos/[...path].astro`, `source: 'destination_detail'`) and destination **listing**
  (`destinos/index.astro` + `destinos/page/[page].astro`, `source: 'destination_listing'`).
- `/colaborar/editores` banner (`variant: 'editors'`) on: blog listing
  (`publicaciones/index.astro` + `publicaciones/page/[page].astro`,
  `source: 'blog_listing'`) and events listing (`eventos/index.astro` +
  `eventos/page/[page].astro`, `source: 'events_listing'`).

```
Given the destination listing page renders
  When the page loads
  Then a ContributionBanner with variant "photos" and source "destination_listing" links to /<lang>/colaborar/fotos

Given the blog listing and events listing render
  When each page loads
  Then each shows a ContributionBanner with variant "editors" linking to /<lang>/colaborar/editores
  And the source prop distinguishes blog_listing from events_listing
```

### FR-9 — Typed PostHog events (clicks + submits)

Add to `WebEvents` in `apps/web/src/lib/analytics/events.ts` (snake_case,
`<entity>_<verb_past>`):

- `contribution_banner_clicked` — props `{ source, variant }`.
- `contribution_report_submitted` — props `{ destino?, locale }`.
- `contribution_photo_submitted` — props `{ locale }`.
- `contribution_editor_submitted` — props `{ locale }`.

Banner clicks fire `contribution_banner_clicked` (FR-6). Each form's success path fires
its submit event via `trackEvent`. Server-side calls are no-ops (the wrapper guards
`window`); banner click tracking lives in the component's hoisted `<script>` (mirrors
`WhatsAppCTA`); form submit tracking lives in the React island after a 2xx response.

```
Given the banner CTA is clicked
  When trackEvent runs
  Then PostHog receives contribution_banner_clicked with { source, variant }

Given a report/photo/editor form submission returns 2xx
  When the success branch runs
  Then trackEvent fires the matching contribution_*_submitted event with its props

Given any contribution analytics call runs during SSG/SSR (no window)
  When trackEvent is invoked
  Then it is a no-op (no crash)
```

### FR-10 — i18n es/en/pt (`contributions` namespace)

Create `packages/i18n/src/locales/{es,en,pt}/contributions.json` with all copy for the
hub, the three pages (incl. the photo license terms text), the banners, and the report
link. es is authoritative; en and pt fall back to es until translated (the `t(key,
fallback)` mechanism + missing-key fallback already handle this).

```
Given the contributions namespace exists with es keys
  When any /colaborar page or banner renders in es
  Then all copy resolves from i18n (no hardcoded literals beyond inline fallbacks)

Given a key is present in es but missing in en/pt
  When the page renders in en or pt
  Then the es value (or the inline fallback) is shown, never a raw key
```

### FR-11 — Spam mitigation on the public forms

The contact endpoint already enforces a **honeypot** (`website` field, silent
fake-success) and a **rate limit** (5 req / 60 s per IP via `customRateLimit`). The
contribution forms inherit these unchanged because they reuse the same endpoint. No
CAPTCHA exists today and none is added here (out of scope), but the spec records the
current posture so reviewers know what protects these new public entry points.

```
Given a contribution form is submitted with a non-empty honeypot "website" field
  When it reaches the contact handler
  Then it returns a fake-success and is not dispatched (bot drop), identical to /contacto

Given more than 5 submissions in 60 s from one IP
  When the 6th arrives
  Then the endpoint returns 429 and the form surfaces the friendly rate-limit message (already implemented in ContactForm)
```

## 5. Phased implementation plan

Ordered so the backend/contract and shared component land first; the pages, the wiring
of surfaces, and i18n/closeout land last, each at a natural pause point.

### Phase 1 — Contact schema types + backend verification (FR-1, FR-11)

1. Append `report_destination_info`, `photo_submission`, `editor_application` to
   `ContactTypeEnumSchema` (additive-only).
2. Add Spanish labels for the three to `CONTACT_TYPE_LABELS` in the API handler.
3. Tests: additive schema test (new types parse, old types + deprecated `accommodation`
   still parse — historic-fixture compat); handler test asserting label + audit for a
   `report_destination_info` submission; confirm honeypot + rate-limit still apply.

**Pause point:** the pipeline accepts the three new types end-to-end; no UI yet.

### Phase 2 — `ContributionBanner` component + analytics events (FR-6, FR-9)

4. Add the four event names to `WebEvents`.
5. Build `ContributionBanner.astro` + `ContributionBanner.module.css` (variants
   photos/editors), with the hoisted click-tracking `<script>` firing
   `contribution_banner_clicked`.
6. Tests: banner renders title/description/CTA per variant; click fires the event with
   `source`/`variant`; responsive reflow.

**Pause point:** the banner exists and is testable in isolation; not yet mounted.

### Phase 3 — `/colaborar` pages + forms (FR-2, FR-3, FR-4, FR-5)

7. `/colaborar/index.astro` hub landing (SSG).
8. `/colaborar/reportar/index.astro` (preset `report_destination_info`, `?destino=`
   seeding), `/colaborar/fotos/index.astro` (+ license terms), `/colaborar/editores/index.astro`.
9. Decide and implement the form-reuse path (deep-link existing `ContactForm` vs. a thin
   `ContributionForm.client.tsx` that locks `type`); wire each form's submit-success
   `trackEvent`.
10. Tests: each page prerenders for es/en/pt; form preset/seed behavior;
    submit-success event fired.

**Pause point:** all four /colaborar pages work standalone.

### Phase 4 — Wire surfaces (FR-7, FR-8)

11. Extend `DestinationSidebarCtas.astro` with the report row + add the inline
    description-section report link on `destinos/[...path].astro`, both deep-linking
    `?destino=<slug>`.
12. Mount the fotos banner on destination detail + destination listing; the editores
    banner on blog listing + events listing — with the correct `source` per surface.
13. Tests: report link href carries `?destino=<slug>`; each banner mount has the right
    `variant`/`source`/`ctaHref`.

**Pause point:** every funnel surface links into the hub.

### Phase 5 — i18n es/en/pt + closeout (FR-10)

14. Add `contributions.json` for es/en/pt (en/pt fall back to es); ensure no hardcoded
    copy remains; i18n key-presence test.
15. Flip spec + task index to completed; manual smoke of each /colaborar page and each
    surface link in es/en/pt.

## 6. Risk and rollback

| Risk | Mitigation |
|------|------------|
| **Report loses Linear/DB traceability** — contact submissions land in the support inbox (email) + logs only; there is NO DB row and NO Linear issue, so `report_destination_info` reports have no structured follow-up queue. | Accepted tradeoff per owner (§10 D-1). Mitigate operationally: the distinct type + email label makes the report triageable in the inbox. **Flag (not built here):** if inbox triage proves lossy, a follow-up spec may route `report_destination_info` to a DB table or Linear for tracking — do NOT switch back to `@repo/feedback` (owner decided /colaborar). |
| **Public-form spam** — three new public entry points. | They reuse the existing endpoint, inheriting the honeypot + 5/60 s rate limit unchanged (FR-11). No new attack surface beyond more referrers; no CAPTCHA added (out of scope). |
| **Photo-license legal copy** — the usage/license terms on `/colaborar/fotos` are legal/product content, not a code decision. | Treated as a **content dependency**: owner/legal must sign off on the exact license text before launch. Engineering ships the i18n keys + layout; the final wording is filled/approved separately. Launch of `/colaborar/fotos` is gated on that sign-off. |
| **SSG page with a client form island (hydration)** | Mirror the proven `/contacto` pattern (`prerender = true` page + `client:visible` ContactForm). The form is the only interactive island; the rest is static. Manual smoke confirms hydration + submit per locale. |
| **Deep-link prefill misuse** — `?destino=` / `?message=` are attacker-controllable. | `ContactForm` already caps `?message` to 2000 chars and validates `?type` against the allowed set; the seeded message is plain text rendered into a textarea (no HTML injection). The API sanitizes all fields (`sanitizeString` STRICT) before the email template. |

## 7. Testing strategy

Per the project's Test-Informed Development rules (Vitest, AAA, ≥90% coverage):

- **Pure logic — tests first:** `ContactSubmitSchema` additive test (the three new types
  parse; all nine existing + deprecated `accommodation` still parse — historic-fixture
  compatibility); contact handler test for the new label + audit on a
  `report_destination_info` submission.
- **Components — tests alongside:** `ContributionBanner` renders per variant; CTA click
  fires `contribution_banner_clicked` with `source`/`variant`; responsive reflow. If a
  `ContributionForm.client.tsx` variant is built, test its locked `type` + hidden select
  + submit-success event; otherwise test the deep-link preset path on `ContactForm`.
- **Page integration:** each /colaborar page prerenders for es/en/pt and mounts the
  correct form preset; the report link on the destination detail carries
  `?destino=<slug>`; each banner mount passes the correct `variant`/`source`/`ctaHref`.
- **i18n:** key-presence test for the `contributions` namespace across es/en/pt
  (en/pt may fall back to es but must not surface raw keys).
- **Regression:** any bug found during wiring gets a reproducing test before the fix.
- **Manual smoke (Phase 5):** each /colaborar page + each surface link verified in the
  browser in es/en/pt, including a real submit per contribution type and confirmation
  that the analytics events fire (since banner click + form submit tracking and the SSG
  hydration are not fully captured by unit tests).

## 8. Out-of-scope / future work

- Routing `report_destination_info` reports to a DB table or Linear for structured
  follow-up (conditional follow-up; only if inbox triage proves lossy — see §6).
- A CAPTCHA on the public forms (current posture is honeypot + rate limit only).
- Admin CRUD / scheduling of these banners (hardcoded by code, per decision).
- Direct file/photo upload on `/colaborar/fotos` (this spec collects a textual
  submission via the contact pipeline; an actual upload flow is a separate effort).
- Any `apps/admin` changes; any change to the existing contact types or pipeline behavior.

## 9. Key file pointers

| File | Relevance |
|------|-----------|
| `packages/schemas/src/contact/submit.ts` | Append the three new contact types (additive-only) |
| `apps/api/src/routes/contact/submit.ts` | Add Spanish labels for the new types to `CONTACT_TYPE_LABELS` (pipeline otherwise unchanged) |
| `apps/web/src/components/ContactForm.client.tsx` | Reuse via `?type=`/`?message=` deep-link, or base for a thin locked-type variant |
| `apps/web/src/components/contributions/ContributionBanner.astro` (NEW) | Reusable banner; model on `WhatsAppCTA.astro` |
| `apps/web/src/components/contributions/ContributionBanner.module.css` (NEW) | Banner styling (vanilla CSS) |
| `apps/web/src/components/contributions/ContributionForm.client.tsx` (OPTIONAL NEW) | Thin locked-type form variant, if the deep-link path is not chosen |
| `apps/web/src/pages/[lang]/colaborar/index.astro` (NEW) | Hub landing (SSG) |
| `apps/web/src/pages/[lang]/colaborar/reportar/index.astro` (NEW) | BETA-69 report form, `?destino=` seeded |
| `apps/web/src/pages/[lang]/colaborar/fotos/index.astro` (NEW) | BETA-68 photo call + license terms |
| `apps/web/src/pages/[lang]/colaborar/editores/index.astro` (NEW) | BETA-65 editor recruitment |
| `apps/web/src/components/destination/DestinationSidebarCtas.astro` | Add the report row |
| `apps/web/src/pages/[lang]/destinos/[...path].astro` | Inline report link after description + fotos banner mount |
| `apps/web/src/pages/[lang]/destinos/index.astro`, `destinos/page/[page].astro` | Fotos banner mount (`destination_listing`) |
| `apps/web/src/pages/[lang]/publicaciones/index.astro`, `publicaciones/page/[page].astro` | Editores banner mount (`blog_listing`) |
| `apps/web/src/pages/[lang]/eventos/index.astro`, `eventos/page/[page].astro` | Editores banner mount (`events_listing`) |
| `apps/web/src/lib/analytics/events.ts` | Add the four `contribution_*` event names |
| `apps/web/src/lib/analytics/posthog-client.ts` | `trackEvent` used by banner + form submits |
| `packages/i18n/src/locales/{es,en,pt}/contributions.json` (NEW) | All contribution copy + license terms |
| `apps/web/src/pages/[lang]/contacto/index.astro` | Reference template for the SSG + island pattern |

## 10. Design decisions (locked)

1. **D-1 — Contributions flow through the CONTACT pipeline, not `@repo/feedback`/Linear.**
   Owner decided "everything in /colaborar". Verified consequence: contact submissions go
   to the support inbox (email via `@repo/notifications`) + structured logs — **no DB row,
   no Linear issue**. The `report_destination_info` report therefore has no structured
   follow-up queue today. Accepted tradeoff; a DB/Linear routing for reports is a flagged
   conditional follow-up (§6, §8), NOT a revert to feedback.
2. **D-2 — Reuse `POST /api/v1/public/contact`; no new endpoint.** Step-1 confirms the
   contact pipeline can carry these (additive enum value + label, same validation,
   honeypot, rate limit, email dispatch). A new endpoint would duplicate the spam
   mitigation and notification wiring for no benefit.
3. **D-3 — Forms reuse `ContactForm` via the existing `?type=`/`?message=` deep-link**,
   preset to the right contribution type. A thin `ContributionForm.client.tsx` that
   locks `type` and hides the select is an allowed alternative if hiding the type select
   matters for UX; the deep-link reuse is the default (less new code, `ContactForm`
   already validates `?type` against the allowed set).
4. **D-4 — Report destination context uses `?destino=<slug>`** (human-readable slug,
   consistent with web destination addressing), seeded into the message body so the
   submission carries "which destination" without a DB join.
5. **D-5 — `ContributionBanner` is a hardcoded component**, modeled on `WhatsAppCTA`,
   surface-placed with a `source` prop. `GlobalAnnouncements` is rejected (no per-CTA
   link, global, admin-CRUD). No admin CRUD of these banners.
6. **D-6 — New contact types are additive-only and appended** (`report_destination_info`,
   `photo_submission`, `editor_application`); existing nine types and the deprecated
   `accommodation` are untouched so historic fixtures keep parsing.
7. **D-7 — New `contributions` i18n namespace**, es authoritative, en/pt fall back to es
   until translated.
8. **D-8 — Analytics: typed PostHog events for both banner clicks and form submits**,
   per surface / per contribution type, satisfying BETA-65's measurement requirement and
   applied to all three contributions for consistency.
9. **D-9 — Photo license terms are a content dependency.** Engineering ships the layout +
   i18n keys; the exact license wording requires owner/legal sign-off before
   `/colaborar/fotos` launches.
