---
title: Umami session replays and heatmaps on web, behind one admin switch
linear: HOS-2347
statusSource: linear
created: 2026-11-18
decisionsResolvedOn: 2026-11-18
type: feature
areas:
  - web
  - admin
  - api
  - db
  - devops
smokeGates:
  # Real recorder.js against the real Umami 3.5 instance: consent gating, route
  # exclusion, element blocking and strict masking are only observable there.
  - status-needs-smoke-staging
  # Manual privacy verification (§9.8) before the switch is ever turned ON in
  # production. It is the go-live gate of this spec.
  - status-needs-smoke-prod
---

# Umami session replays and heatmaps on web

## 1. Summary

Umami 3.5 (self-hosted since HOS-2119) ships a session recorder (`recorder.js`)
that produces session replays and click/scroll heatmaps. This spec lets a
SUPER_ADMIN turn that recorder on and off for the **public web app only**, from
one switch in the admin panel, for short "special occasion" windows.

The design is **Option A** (owner, 2026-11-18):

- A Hospeda `platform_settings` key, `analytics.sessionRecording`, decides
  whether the web injects `recorder.js`. That is the ONE switch.
- Every recorder parameter (replay vs heatmap, sample rates, mask level, max
  duration, block selector) lives in Umami's website record (`recorder_enabled`,
  `replay_config`) and is managed as code by `pnpm umami:setup`.
- The api never receives a write-capable Umami credential.

Recording also requires analytics consent, never runs on sensitive routes, and
never captures four marked UI surfaces.

## 2. Problem

- The product team has no way to see how visitors actually use public pages
  (where they click, how far they scroll, where they get stuck). Umami pageviews
  and events answer "how many", not "how".
- Umami 3.5 can answer that, but turning the recorder on naively would record
  every page, including sign-in, checkout and contact forms, for every visitor,
  with or without consent.
- `docs/analytics/session-replay-privacy.md` still says "Umami has no session
  recording". It is stale and must be rewritten before anything records.

## 3. Goals

- G-1 One admin switch (SUPER_ADMIN only) turns recording on or off for the web.
  Switching OFF reaches new page loads within about 60 seconds.
- G-2 Recording happens only when ALL of these hold: switch ON, the visitor's
  analytics consent is `true`, the route is not excluded, and the Umami tracker
  is loaded.
- G-3 Any failure in deciding (endpoint down, timeout, bad payload) means **no
  recording** (fail closed).
- G-4 Recorder parameters are code: `pnpm umami:setup` declares them,
  idempotently, with `--dry-run`, touching only what it declares.
- G-5 Strict masking (all text, all inputs) plus element-level blocking of four
  surfaces plus route exclusion of eleven route families.
- G-6 Admin, api and mobile are never recorded.
- G-7 The privacy doc describes the real recorder, and a manual privacy
  verification is signed before production is ever switched ON.

## 4. Non-goals

- NG-1 Recording the admin panel (`apps/admin`). Never, by owner decision.
- NG-2 Recording `apps/mobile`.
- NG-3 Editing recorder parameters from the admin panel. They are code in
  `umami:setup` (Option A). The admin switch is a single boolean.
- NG-4 Separate switches for replays and heatmaps. The split lives in
  `replay_config` (`replayEnabled`, `heatmapEnabled`), managed as code.
- NG-5 Selective unmasking. The old doc's "unmask selectively on elements marked
  safe" has no recorder equivalent; with `strict` everything is masked (§6.7).
- NG-6 Showing replays or heatmaps inside Hospeda. They are viewed in the Umami UI.
- NG-7 Owner-facing (listing owner) access to replays or heatmaps.
- NG-8 Error-prioritised or flow-prioritised sampling. Sampling is uniform (§6.5).

## 5. Current baseline

Verified on `origin/staging` (worktree cut 2026-11-18).

### 5.1 Web tracker

- `apps/web/src/components/analytics/UmamiScript.astro` renders the tracker
  (`<script defer src={PUBLIC_UMAMI_SCRIPT_URL} data-website-id=… data-auto-pageview="false">`)
  plus one bundled pageview script. It renders nothing unless both
  `PUBLIC_UMAMI_SCRIPT_URL` and `PUBLIC_UMAMI_WEBSITE_ID` are set.
- That HTML is session-blind and edge-cached. The guard
  `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts` enforces
  it over all of `src/pages`. **Consequence:** the recorder decision cannot be
  baked into the HTML. It must be taken client-side, at runtime, per document.
- `apps/web/src/lib/analytics/umami-tracker.ts` exposes `getUmamiTracker()` and
  `waitForUmamiTracker()` (polls `window.umami`, 250 ms × 20).
- `apps/web/src/lib/analytics/umami-identity-gate.ts` exposes
  `waitForVisitorIdentity()` / `isVisitorIdentitySettled()`. The document's
  first pageview is held until the visitor identity settles (HOS-2119 OQ-5).
- `apps/web/src/lib/analytics/umami-client.ts` already handles consent revoke:
  `forgetIdentityOnRevocation` reloads the page when the tracker holds the
  identity (line ~305). This is the precedent for "stop at next page load".
- The web uses Astro's ClientRouter: soft navigations swap the document without
  a full load (`astro:page-load` fires on each one).

### 5.2 Consent

`apps/web/src/lib/cookie-consent.ts`:

- `getConsent(): ConsentState | null` — `null` means the visitor has not decided.
- `ConsentState.analytics: boolean` — "Usage analytics" category.
- `CONSENT_CHANGED_EVENT = 'cookie-consent:changed'`, dispatched by
  `saveConsent` with the new state in `detail`.
- `CONSENT_VERSION = 2`. The `es` copy for the analytics category
  (`packages/i18n/src/locales/es/cookieConsent.json`) says "Estadísticas
  anónimas sobre cómo los visitantes navegan el sitio (páginas más vistas,
  flujos de búsqueda)". It does not mention recordings or heatmaps (see OQ-1).

### 5.3 CSP

`apps/web/src/lib/middleware-helpers.ts` (`buildCspHeader`):

- `script-src 'self' <hashes> … <umamiOrigin>` and
  `connect-src 'self' <api> … <umamiOrigin>`. `umamiOrigin` comes from
  `resolveUmamiOrigin({ scriptUrl: PUBLIC_UMAMI_SCRIPT_URL })`.
- `'strict-dynamic'` is deliberately absent (HOS-369 WB0-1), and there is no
  nonce (`scripts/check-no-inline-nonce.sh`). Without `'strict-dynamic'`, host
  sources apply to dynamically inserted scripts too, so a
  `document.createElement('script')` with `src=<umamiOrigin>/recorder.js` is
  allowed by the existing `script-src`. **This is reasoned from the policy, not
  measured.** AC-W11 measures it on staging.
- `worker-src 'self' blob:` and `child-src blob:` exist, in case the recorder
  compresses in a worker.

### 5.4 Platform settings

- Key enum: `PlatformSettingsKeySchema` in
  `packages/schemas/src/entities/platformSettings/platform-settings.schema.ts`
  (`seo.defaults`, `maintenance.mode`, `announcements.global`,
  `billing.paidSignupsFreeze`, `billing.addonPurchasesFreeze`). Append-only.
- `updatedAt` / `updatedBy` are row columns, returned by
  `PlatformSettingsResponseSchema`. They are not part of the value.
- Permissions per key: `requiredReadPermission` / `requiredWritePermission` in
  `packages/service-core/src/services/platformSettings/platform-settings.service.ts`
  (doc block lines 29-36, mappers lines 76-99). Exhaustive `switch` with `never`.
- Narrow public readers bypass the admin permission gate by design:
  `findActiveAnnouncements`, `isIndexNowEnabled` (fails closed), and
  `isNewPaidSignupsFrozen`.
- Admin hook: `apps/admin/src/hooks/use-platform-setting.ts`
  (`usePlatformSetting`, `useUpdatePlatformSetting`, plus the
  `PlatformSettingValue<K>` conditional type, which must grow one branch).
- Example toggle cards: `SignupFreezeCard.tsx` and `AddonPurchasesFreezeCard.tsx`
  (`apps/admin/src/features/billing-*-freeze/components/`). They use an
  `AlertDialog` confirm. **Correction to the research note:** they are mounted on
  `routes/_authed/billing/settings.tsx`, not on
  `routes/_authed/platform/critical/index.tsx`. The critical page (gated by
  `SYSTEM_MAINTENANCE_MODE`) holds maintenance, announcements and cache cards.
- Public read today: `apps/api/src/routes/platform-settings/public/index.ts`,
  mounted at `/api/v1/public/announcements`. Its docblock says "Cached for
  5 minutes", but the path is NOT in `PUBLIC_CACHE_ENDPOINTS`
  (`apps/api/src/middlewares/cache.constants.ts`), and the route sets no
  `Cache-Control`. As read, the 5-minute cache is not implemented. Either way,
  the new endpoint must not depend on it and defines its own caching (§6.3).

### 5.5 Permissions

- `PermissionEnum` (`packages/schemas/src/enums/permission.enum.ts`) is a
  Postgres enum (`permission_enum`, `packages/db/src/schemas/enums.dbschema.ts:182`).
  A new value needs a structural migration (`pnpm db:generate`).
- The family style for new values is camelCase segments:
  `MAINTENANCE_MODE_WRITE = 'system.maintenanceMode.write'`. An `analytics.*`
  family already exists: `ANALYTICS_VIEW = 'analytics.view'`.
- `packages/schemas/test/enums/permission-naming-convention.guard.test.ts`
  fails when a value's first two dotted segments merge into an existing family
  prefix. `analytics.sessionRecording.manage` → `analyticssessionrecording`,
  which is not a family. It passes.
- `packages/schemas/test/utils/permission-system-fallback.guard.test.ts` freezes
  the keys that fall back to category `SYSTEM`. `ANALYTICS_VIEW` is already on
  that list (no `ANALYTICS` category exists in `permission-grouping.ts`). A new
  `ANALYTICS_*` key will fail it until it is added to the list on purpose.
- `SUPER_ADMIN_EXCLUSIVE_PERMISSIONS`
  (`packages/schemas/src/entities/permission/permission.super-admin-exclusive.schema.ts`)
  is a closed set tied to the V5 action keys (ACC_*). See OQ-3.
- Seed: baseline grants are in `packages/seed/src/required/rolePermissions.seed.ts`.
  The data-migration precedent for a SUPER_ADMIN-only grant is
  `packages/seed/src/data-migrations/0128-hos1591-promo-code-permission.ts`
  (insert `role_permission` with `onConflictDoNothing`, run after `db:migrate`).

### 5.6 `umami:setup`

`scripts/umami/setup.ts` (`pnpm umami:setup [--dry-run]`) upserts reports,
boards, segments and cohorts. Guarantees: re-run changes nothing, items not
defined in code are listed as "unmanaged" and never modified, and `--dry-run`
performs reads only. Credentials are script-only (`UMAMI_SETUP_API_KEY`, or
`UMAMI_SETUP_USERNAME` + `UMAMI_SETUP_PASSWORD`). `HOSPEDA_UMAMI_API_KEY` is
view-only by registry contract.

### 5.7 Umami 3.5 recorder (measured on staging)

- `/app/public/recorder.js` exists in the Umami container.
- The recorder needs `window.umami` loaded first (it reads
  `umami.getSession().cache`), and it hooks `pushState` / `replaceState`.
- It fetches `GET {host}/api/websites/{id}/recorder` and receives `enabled`,
  `replayEnabled`, `heatmapEnabled`, `sampleRate`, `heatmapSampleRate`,
  `maskLevel` (`strict` | `moderate`), `maxDuration` (ms) and `blockSelector`.
- The `website` table has `recorder_enabled` (false on staging) and
  `replay_config` (empty).
- **Unknown:** how those two columns are written through the Umami API
  (probably `POST /api/websites/:id`). Resolved by the spike (T-001).
- **Unknown:** whether the recorder exposes any in-page stop. Resolved by the
  spike (T-001).

### 5.8 Sensitive surfaces in the web

- `apps/web/src/components/accommodation/ContactHost.client.tsx` (contact the owner).
- `apps/web/src/components/accommodation/WhatsAppContact.client.tsx`.
- `apps/web/src/components/legal/CookieConsentBanner.client.tsx`.
- `apps/web/src/components/feedback/FeedbackHeadlessHost.client.tsx`. It renders
  `FeedbackModal` (from `@repo/feedback`) **via a portal to `document.body`**, so
  a marker on the host's own root would not cover the modal (§6.6).

## 6. Proposed design

### 6.1 Two layers, one switch

| Layer | Lives in | Who changes it | Decides |
|---|---|---|---|
| Hospeda switch | `platform_settings` key `analytics.sessionRecording` | SUPER_ADMIN, admin card | Whether the web injects `recorder.js` at all |
| Recorder config | Umami `website.recorder_enabled` + `replay_config` | `pnpm umami:setup` (code review + owner run) | What the recorder does once loaded |

`umami:setup` keeps `recorder_enabled = true` on the web website permanently.
The Hospeda switch is therefore the only operational on/off.

**Alternatives considered for where the switch lives** (decided by the owner,
recorded here):

1. Toggle `recorder_enabled` in Umami from the admin. Rejected: it needs a
   write-capable Umami credential in the api.
2. Build-time env var. Rejected: turning it on or off needs a redeploy.
3. Hospeda `platform_settings` key read by the web at runtime. **Chosen.**

### 6.2 Setting value

```text
key:   'analytics.sessionRecording'
value: { enabled: boolean }      // SessionRecordingValueSchema
row:   updatedAt, updatedBy      // existing columns, like every other key
```

- An absent row means `enabled: false`.
- Read and write permission: `ANALYTICS_SESSION_RECORDING_MANAGE`, for both,
  the same collapse as `MAINTENANCE_MODE_WRITE`.
- New narrow reader `isSessionRecordingEnabled(): Promise<boolean>`:
  - missing row → `false`;
  - value fails the schema → `false` plus a `warn` log;
  - DB read error → propagates (like `isNewPaidSignupsFrozen`), so the route
    answers 500 and the outage is visible. The web fails closed on a 500 anyway.
- No cache-tag purge on write. The freshness bound comes from the HTTP headers
  (§6.3).

### 6.3 Public endpoint

`GET /api/v1/public/session-recording` (public tier, `createPublicRoute`,
`skipAuth: true`, same rate limit as announcements: 100 req/min).

- 200 body: `{ "enabled": boolean }`. Nothing else: no `updatedAt`, no `updatedBy`.
- Headers: `Cache-Control: public, max-age=30, s-maxage=30`. Worst case after a
  switch-OFF is 30 s in the edge plus 30 s in the browser, which stays within 60 s.
- The path must NOT be added to `PUBLIC_CACHE_ENDPOINTS`. The in-process cache
  uses a global TTL that is not bound to 60 s.
- Errors: 500 with the standard error contract. Not cacheable.
- The path name is a proposal. The repo has no established naming for
  single-setting public reads. The only precedent is `/api/v1/public/announcements`.

**Alternatives considered for freshness:** (1) purge a cache tag on write.
Rejected: the api JSON is not tag-cached today, and adding that infra for one
boolean is out of proportion. (2) `no-store` with a DB read per page load.
Rejected: each consenting visitor's page load would hit the DB with no benefit.
(3) A short `max-age`. **Chosen**, because it meets the 60 s bound with no new infra.

### 6.4 Web recorder loader

A new bundled module, `apps/web/src/lib/analytics/umami-recorder.ts`, started
from the existing bundled script in `UmamiScript.astro`. It is not inline, so no
new CSP hash is needed. It adds no per-user markup, so pages stay session-blind.

On every `astro:page-load`, if the recorder is not yet loaded in this document,
it evaluates the following conditions in order and stops at the first failure:

1. The tracker element is present (`UmamiScript` rendered, both env vars set).
2. The current path is not excluded (§6.5, `isRecordingExcludedPath`).
3. `getConsent()?.analytics === true`. If `null` or `false`, it subscribes to
   `CONSENT_CHANGED_EVENT` and re-evaluates when that event fires.
4. `fetch` the public endpoint with a 3 s timeout. It continues only on HTTP 200,
   a body that parses as `{ enabled: boolean }`, and `enabled === true`. Any
   other outcome stops without recording (fail closed): a network error, a
   timeout, a non-200, a bad JSON body, or a CSP block of the fetch. A `debug`
   log is allowed. No user-facing message is shown.
5. `waitForUmamiTracker()` resolves, and the visitor identity is settled
   (`waitForVisitorIdentity`). The recorder must not open the tracker's session
   before the identify, or it breaks the HOS-2119 OQ-5 invariant.
6. It injects exactly one
   `<script id="umami-recorder" src="{umamiOrigin}/recorder.js" data-website-id="{PUBLIC_UMAMI_WEBSITE_ID}">`.
   It is idempotent: a module flag plus the DOM id check. `umamiOrigin` comes
   from the same `PUBLIC_UMAMI_SCRIPT_URL` origin the CSP uses.

**Soft navigation into an excluded route.** Once loaded, the recorder follows
`pushState` and keeps recording across ClientRouter swaps. So, while the
recorder is loaded, any navigation whose destination is excluded is turned into
a full page load. This includes back/forward. The loader listens to the
router's pre-navigation event and calls `location.assign(destination)`. The
document unload ends the recording, and the next document never loads the
recorder because of condition 2. The exact hook (`astro:before-preparation`
cancellation versus `data-astro-reload` on links) is confirmed in T-001.

**Switch turned OFF while a document records.** The recorder keeps running in
that document until it unloads or reaches `maxDuration` (5 min). New page loads
stop within 60 s (§6.3). This is accepted and documented.

**Consent revoked while recording.**

- If T-001 finds an in-page stop or unload API, the loader calls it on
  `CONSENT_CHANGED_EVENT` with `analytics === false`.
- If it finds none, recording stops at the next page load, because condition 3
  fails there. This is documented in the privacy doc. Whether to also force a
  reload, as `forgetIdentityOnRevocation` does, is OQ-2.

### 6.5 Route exclusion (single list, guarded)

One exported constant in `apps/web/src/lib/analytics/recording-exclusions.ts`:

```text
RECORDING_EXCLUDED_ROUTE_PREFIXES = [
  'auth', 'mi-cuenta', 'guest', 'suscriptores/checkout', 'publicar',
  'feedback', 'colaborar', 'contacto', 'partners/reclamar',
  'sumate/proveedor', 'newsletter'
] as const
```

Matching rules for `isRecordingExcludedPath({ pathname })`:

- It strips an optional leading `/{es|en|pt}` segment, then leading and trailing
  slashes.
- A prefix matches when the remaining path equals it, or starts with
  `prefix + '/'`.
  - `contacto` matches `/es/contacto/`.
  - `newsletter` matches `/en/newsletter/confirmado`.
  - `publicar` matches `/es/publicar/experiencias/`.
  - `publicar` does NOT match `/es/publicaciones/`.
  - `partners` alone does NOT match `/es/partners/reclamar/`. Only the full
    `partners/reclamar` prefix does.
- Matching is case-insensitive and ignores query string and hash.
- `publicar-experiencia` and `publicar-restaurante` are not on the list. Both
  are permanent redirects to `publicar/*` and never render.

Guard test: every prefix resolves to an existing directory under
`apps/web/src/pages/[lang]/`. A renamed or moved route must fail CI instead of
silently dropping out of the exclusion.

Sampling: a single constant `RECORDER_SAMPLE_RATE = 0.5` in the `umami:setup`
recorder definitions, used for both `sampleRate` and `heatmapSampleRate`. The
owner chose a rate above the earlier 0.15 because recording is only switched on
for special occasions. It is never 1.0 (privacy doc minimum). Sampling is
uniform. The old doc's "prioritise checkout, publication and onboarding" does
not apply, because those flows are excluded.

### 6.6 Element-level block

- Marker attribute: `data-umami-block`, defined ONCE as a constant. The selector
  `[data-umami-block]` is derived from that constant and declared as
  `replay_config.blockSelector` by `umami:setup`.
- It goes on the outermost rendered DOM element of:
  1. `ContactHost.client.tsx` (the contact-owner form);
  2. `WhatsAppContact.client.tsx`;
  3. `CookieConsentBanner.client.tsx`, on its rendered root (including any portal);
  4. the feedback UI. Because `FeedbackModal` is portaled to `document.body`, the
     attribute must be on the modal's portal root inside `@repo/feedback`, not
     only on `FeedbackHeadlessHost`. How it gets there is OQ-4.
- The attribute carries no value (`data-umami-block=""`). It is the same for
  every visitor, so it is session-blind.

### 6.7 Masking

`maskLevel: 'strict'`: every text node and every input is masked. There is **no
selective unmask**. The old requirement "mask all inputs and all text by
default, with selective unmask on elements marked safe" has no recorder
equivalent and is replaced, explicitly, by "everything is masked". Heatmaps
still show click and scroll positions. Replays show layout and movement, not
content.

### 6.8 `umami:setup` recorder definitions

New `scripts/umami/recorder-definitions.ts` plus a recorder step in `setup.ts`:

```text
recorder_enabled: true
replay_config: {
  replayEnabled: true, heatmapEnabled: true,
  sampleRate: RECORDER_SAMPLE_RATE, heatmapSampleRate: RECORDER_SAMPLE_RATE,
  maskLevel: 'strict', maxDuration: 300000, blockSelector: '[data-umami-block]'
}
```

- It reads the website and compares only the declared fields. On no difference
  it reports `unchanged` and writes nothing.
- On a difference it writes the declared fields and preserves any undeclared
  `replay_config` key exactly as found. Undeclared keys are listed as unmanaged.
- `--dry-run` reads and prints the planned per-field change and writes nothing.
- It never changes the website's name, domain or any other field. If the Umami
  write endpoint requires a full-record payload, the step re-sends the read
  values verbatim (confirmed in T-001).
- Field names in the write payload (`recorderEnabled` / `replayConfig` or other)
  come from T-001. The spec does not guess them.

### 6.9 Admin card

`SessionRecordingCard` in `apps/admin/src/features/session-recording/`, mounted
on `routes/_authed/platform/critical/index.tsx`. It renders only when the user
holds `ANALYTICS_SESSION_RECORDING_MANAGE`, and is absent from the DOM otherwise.

- State line: "ON" or "OFF". It also shows the last-change time from `updatedAt`,
  or "never changed" when there is no row.
- One button: "Turn on" or "Turn off". It opens an `AlertDialog` like
  `SignupFreezeCard`:
  - The turn-on confirmation states the prerequisite in plain words: "Production
    must have a signed privacy verification (docs/analytics/session-replay-privacy.md)."
  - The turn-off confirmation states the 60 s propagation bound and that open
    pages may keep recording up to 5 minutes.
- Help text: "Replay vs heatmap, sampling and masking are configured in Umami
  through `pnpm umami:setup`, not here."
- Loading: the button is disabled with a spinner while the mutation is pending.
- Read error: an inline error and a retry button. The toggle is disabled.
- Write error: an inline error with the API message. The state line keeps the
  last confirmed value.
- i18n in es, en and pt through `@repo/i18n`. Accessibility: the button has an
  accessible name with the target state, and the dialog traps focus (shadcn
  default).

### 6.10 Permission

- `ANALYTICS_SESSION_RECORDING_MANAGE = 'analytics.sessionRecording.manage'`.
- Structural migration: `ALTER TYPE permission_enum ADD VALUE …` via `pnpm db:generate`.
- Seed dual-write (HOS-25):
  - baseline grant to `SUPER_ADMIN` in `rolePermissions.seed.ts`;
  - data-migration from `pnpm db:seed:make hos2347-session-recording-permission`,
    modelled on `0128-hos1591-promo-code-permission.ts`.
  - Run order: `db:migrate` → `db:seed:migrate`.
- `permission-system-fallback.guard.test.ts`: add the key to the frozen list on
  purpose, next to `ANALYTICS_VIEW`. This is the same placement, not a new
  taxonomy decision.
- Recount every frozen permission count or inventory the change trips. Do not
  just add one. Verify by running the schemas, seed, admin and api permission
  guards, not by guessing which ones exist.

### 6.11 Privacy doc

Rewrite `docs/analytics/session-replay-privacy.md`:

- current status (Umami recorder, web only, off by default);
- the two layers;
- the consent rule;
- the route list, pointing to the code constant rather than copying it;
- the block marker and its four surfaces;
- `strict` masking with the explicit "no selective unmask" statement;
- sampling 0.5 for both;
- `maxDuration` 5 min;
- the revoke and switch-off propagation limits from §6.4;
- the manual verification procedure (§9.8) with a sign-off table.

## 7. Data model / contracts

| Item | Change |
|---|---|
| `PlatformSettingsKeySchema` | append `'analytics.sessionRecording'` |
| `SessionRecordingValueSchema` | new: `z.object({ enabled: z.boolean() })` |
| `PlatformSettingsResponseSchema`, service `UpsertInputSchema`, permission mappers, admin `PlatformSettingValue<K>` | one new branch each |
| `PublicSessionRecordingResponseSchema` | new: `{ enabled: boolean }` |
| `PermissionEnum` | `ANALYTICS_SESSION_RECORDING_MANAGE` |
| DB | structural migration (enum value). No new table: the row lives in `platform_settings` |
| Seed | baseline grant + numbered data-migration |
| Env vars | none new. The api gets no Umami write credential |
| Umami | `website.recorder_enabled`, `website.replay_config` (written by `umami:setup` only) |

## 8. User stories

Roles: **SUPER_ADMIN** (operates the switch), **Visitor** (uses the public web),
**Developer/Operator** (runs `umami:setup`), **Product analyst** (watches replays
and heatmaps in Umami).

- US-1 As a SUPER_ADMIN, I want to turn session recording on and off from the
  admin panel, so that I can record only during special occasions without a deploy.
- US-2 As a Visitor, I want recording to happen only if I accepted usage
  analytics, so that my consent choice is respected.
- US-3 As a Visitor, I want sign-in, account, checkout, publishing, contact and
  feedback screens never to be recorded, so that my personal data never ends up
  in a replay.
- US-4 As a Visitor, I want all text and inputs masked in any recording, so that
  nothing I type or read is visible to whoever watches it.
- US-5 As a Developer/Operator, I want recorder parameters declared in code and
  applied idempotently, so that configuration is reviewed and reproducible.
- US-6 As a Product analyst, I want replays and heatmaps of public pages in
  Umami, so that I can see how visitors use them.
- US-7 As the owner, I want a signed privacy verification before production
  records, so that we never ship a leak.

## 9. Acceptance criteria

### 9.1 Admin switch (US-1)

- **AC-A1** Given a SUPER_ADMIN on `/platform/critical` with no
  `analytics.sessionRecording` row, when the page loads, then the card shows
  "OFF" and "never changed".
- **AC-A2** Given the card shows OFF, when the SUPER_ADMIN clicks "Turn on" and
  confirms, then `PUT` stores `{ enabled: true }` with `updatedBy` = their id,
  and the card shows "ON" with the new `updatedAt`.
- **AC-A3** Given the confirm dialog is open, when the SUPER_ADMIN cancels, then
  no request is sent and the state is unchanged.
- **AC-A4** Given a user without `ANALYTICS_SESSION_RECORDING_MANAGE` (e.g.
  ADMIN), when they open the critical page, then the card is not in the DOM.
  When they call `GET`/`PUT /api/v1/admin/platform-settings/analytics.sessionRecording`,
  the api answers 403.
- **AC-A5** Given the write fails (5xx), when the SUPER_ADMIN confirms, then an
  inline error is shown and the state line keeps the previous value.
- **AC-A6** Given a body `{ enabled: "yes" }`, when `PUT` is called by a
  SUPER_ADMIN, then the api answers 400 and stores nothing.

### 9.2 Public endpoint (US-1, G-3)

- **AC-P1** Given no row, when `GET /api/v1/public/session-recording` is called
  without auth, then it answers 200 `{ "enabled": false }`.
- **AC-P2** Given `{ enabled: true }` stored, then it answers 200
  `{ "enabled": true }`, and the body has exactly one key. A test asserts the
  exact key set, not `objectContaining`.
- **AC-P3** Every 200 carries `Cache-Control: public, max-age=30, s-maxage=30`.
  The path is absent from `PUBLIC_CACHE_ENDPOINTS` and `PRIVATE_CACHE_ENDPOINTS`
  (guard test).
- **AC-P4** Given a stored value that fails the schema, then it answers 200
  `{ "enabled": false }` and logs one warning.
- **AC-P5** Given the DB read throws, then it answers 500 with the standard
  error body and no `public` cache header.

### 9.3 Web loader: conditions (US-2, G-2, G-3)

Unit tests on the loader with `fetch`, consent and tracker stubbed. "Injected"
means a `script#umami-recorder` exists with
`src === <umamiOrigin>/recorder.js` and the right `data-website-id`.

- **AC-W1** Given switch ON, consent `analytics: true`, an allowed route and the
  tracker loaded, when `astro:page-load` fires, then exactly one recorder script
  is injected.
- **AC-W2** Given `getConsent()` returns `null`, then nothing is injected and
  `fetch` is not called.
- **AC-W3** Given consent `analytics: false`, then nothing is injected and
  `fetch` is not called.
- **AC-W4** Given consent `null` at load, when `CONSENT_CHANGED_EVENT` fires with
  `analytics: true` (and the switch is ON, the route allowed), then the recorder
  is injected once.
- **AC-W5** Given the endpoint answers `{ enabled: false }`, then nothing is injected.
- **AC-W6** Given each of the following, then nothing is injected and no error
  reaches the console at `error` level: a network error, a 500, a 429, a timeout
  (> 3 s), `{}`, `{ enabled: "true" }`, or non-JSON (fail closed).
- **AC-W7** Given `PUBLIC_UMAMI_SCRIPT_URL` or `PUBLIC_UMAMI_WEBSITE_ID` is unset
  (no tracker element), then nothing is injected and `fetch` is not called.
- **AC-W8** Given the visitor identity is not yet settled, then the script is
  not injected until it settles. Asserted by ordering: the injection happens
  after `waitForVisitorIdentity` resolves.
- **AC-W9** Given the recorder is already injected, when three more
  `astro:page-load` events fire, then there is still exactly one recorder script.
- **AC-W10** The page HTML of every page under `src/pages` is unchanged in
  per-user terms: `cacheable-pages-are-session-blind.guard.test.ts` stays green,
  and no page or layout references `recorder.js` in its markup (guard: the
  string `recorder.js` appears only in `umami-recorder.ts` and its tests).
- **AC-W11** On staging, with the switch ON and consent granted, the injected
  `recorder.js` loads and its config and ingest requests succeed with **zero**
  CSP violation reports for `script-src`, `connect-src` or `worker-src`. If any
  is reported, a CSP task is added before merge.

### 9.4 Route exclusion (US-3)

- **AC-R1** `isRecordingExcludedPath` returns `true` for each prefix in each
  locale, e.g. `/es/auth/signin/`, `/en/mi-cuenta/favoritos/`,
  `/pt/guest/messages/abc`, `/es/suscriptores/checkout/?plan=x`,
  `/es/publicar/nueva`, `/es/feedback/`, `/es/colaborar/fotos/`,
  `/es/contacto/`, `/es/partners/reclamar/`, `/es/sumate/proveedor/`, and
  `/es/newsletter/confirmado`.
- **AC-R2** It returns `false` for `/es/`, `/es/alojamientos/x/`,
  `/es/publicaciones/`, `/es/partners/foo/`, `/es/suscriptores/planes/`,
  `/es/sumate/partner/` and `/es/contactos-utiles/` (prefix-boundary check).
- **AC-R3** Given all other conditions hold and the current path is excluded,
  then nothing is injected and `fetch` is not called.
- **AC-R4** Guard: every entry of `RECORDING_EXCLUDED_ROUTE_PREFIXES` maps to an
  existing directory under `apps/web/src/pages/[lang]/`. Renaming one fails the test.
- **AC-R5** Given the recorder is loaded, when the visitor soft-navigates (link
  click or back/forward) to an excluded path, then the navigation becomes a full
  page load (`location.assign` called with the destination), and the new
  document has no recorder script.
- **AC-R6** Given the recorder is not loaded on an excluded page, when the
  visitor soft-navigates to an allowed page and all conditions hold, then the
  recorder is injected there.

### 9.5 Block and mask (US-4)

- **AC-B1** Rendering each of the four surfaces (§6.6) in a test DOM finds
  `[data-umami-block]` on the outermost element that the component inserts into
  the document. For the feedback modal and the cookie banner, that is the portal
  root under `document.body`.
- **AC-B2** The attribute name used by the components and the `blockSelector`
  declared by `umami:setup` derive from the same constant. A test asserts
  `blockSelector === '[' + ATTR + ']'`.
- **AC-B3** `umami:setup` declares `maskLevel: 'strict'`. A definitions test
  fails on any other value.

### 9.6 `umami:setup` (US-5)

- **AC-S1** Given the Umami website lacks the declared recorder config, when
  `pnpm umami:setup` runs, then it writes `recorder_enabled = true` and the
  declared `replay_config` fields, and reports the recorder as `updated`.
- **AC-S2** Given the declared config is already present, when it runs again,
  then it reports `unchanged` and sends no write request (asserted with a
  `fetch` spy).
- **AC-S3** Given `--dry-run`, then only GET requests are sent and the planned
  per-field diff is printed.
- **AC-S4** Given `replay_config` holds an undeclared key, when setup writes,
  then that key is preserved verbatim and listed as unmanaged. The website's
  name and domain are byte-identical before and after.
- **AC-S5** `sampleRate` and `heatmapSampleRate` both equal the single constant
  `RECORDER_SAMPLE_RATE = 0.5`. `maxDuration` is `300000`.
- **AC-S6** No env var for a write-capable Umami credential is added to
  `packages/config` or to any app env schema (`pnpm env:check:registry` green,
  plus a grep guard over the api).

### 9.7 Permission and seed

- **AC-PE1** `PermissionEnum.ANALYTICS_SESSION_RECORDING_MANAGE ===
  'analytics.sessionRecording.manage'`, and the naming-convention guard stays green.
- **AC-PE2** After `pnpm db:fresh` on a fresh DB, SUPER_ADMIN holds the
  permission, and no other role does.
- **AC-PE3** On an already-seeded DB, `db:migrate` followed by `db:seed:migrate`
  grants it to SUPER_ADMIN. A second run inserts 0 rows.
  `check-seed-dual-write.sh` is green.
- **AC-PE4** The system-fallback guard is green with the key listed, and every
  frozen permission count is updated to the recounted value.

### 9.8 Staging smoke and prod privacy verification (US-6, US-7)

- **AC-SM1 (staging)** With the switch ON and consent granted, a public
  navigation of about 2 minutes produces a replay in Umami staging. If it is not
  sampled, repeat it; sampling is 0.5. A heatmap for that page shows the clicks.
- **AC-SM2 (staging)** With consent rejected, the same navigation produces no
  replay, and DevTools shows no `recorder.js` request.
- **AC-SM3 (staging)** Visiting `/es/auth/signin/` directly, and by clicking from
  a recorded page, loads no recorder in that document. The replay ends at the
  navigation.
- **AC-SM4 (staging)** In a replay crossing an accommodation page, the
  contact-owner form, the WhatsApp block, the cookie banner and the feedback
  modal appear as blocked placeholders, and all other text is masked.
- **AC-SM5 (staging)** Turning the switch OFF: a new full page load 60 s later
  fetches `{ enabled: false }` and loads no recorder.
- **AC-SM6 (prod, before the first ON)** The owner, or someone the owner
  designates, runs the manual verification in the rewritten privacy doc:
  - log in or sign up;
  - the contact form;
  - checkout;
  - public navigation, including a listing page.

  They confirm in the Umami replay that no password, email, phone, message,
  name, payment datum or token is visible, and sign the result on the issue with
  `/smoke HOS-2347`. Production is not switched ON before that sign-off.
- **AC-D1** `docs/analytics/session-replay-privacy.md` no longer contains "has no
  session recording". It states `strict` masking with no selective unmask, the
  consent rule, the propagation limits of §6.4 and the procedure of AC-SM6.
- **AC-ADM1** Guard: no file under `apps/admin/src` references `recorder.js` or
  the recorder loader module.

Total: 49 acceptance criteria (A 6, P 5, W 11, R 6, B 3, S 6, PE 4, SM 6, D 1, ADM 1).

## 10. UX notes

- **Visitor:** there is no visible change. There is no recording indicator,
  because the consent category is the disclosure (see OQ-1 on its copy). No
  error is ever shown to a visitor when the decision fails.
- **Empty state (admin):** no row means "OFF · never changed".
- **Loading state (admin):** the toggle is disabled until the read resolves.
- **Accessibility:** the recorder must not change focus, tab order or ARIA. The
  block attribute is inert for assistive technology.

## 11. Risks

- **R-1 Leak through an unmarked surface.** A new form added to a public page
  later is masked by `strict`, but not blocked, and not excluded. Mitigation:
  strict masking is the floor, and AC-SM6 is repeated before each prod ON window
  (documented in the privacy doc).
- **R-2 No in-page stop.** If T-001 finds none, a revoke or switch-OFF leaves
  the current document recording until unload or 5 min. Mitigation: documented,
  and OQ-2 decides whether to force a reload.
- **R-3 Soft-nav hook does not cancel.** If the router hook cannot turn the swap
  into a full load, an excluded page could be recorded after a soft nav.
  Mitigation: T-001 measures it, and the AC-R5 test plus AC-SM3 verify it.
- **R-4 Breaking the identify-first invariant (HOS-2119 OQ-5).** Injecting too
  early could make Umami claim the fingerprint session. Mitigation: AC-W8.
- **R-5 Umami write API unknown.** A full-record write could clobber website
  fields. Mitigation: T-001 first, and AC-S4.
- **R-6 Storage growth.** Replays at 0.5 sampling consume Umami Postgres disk on
  the VPS. Mitigation: switched on only for windows. See OQ-5 on retention.
- **R-7 Public abuse.** The website id is public, so anyone can load
  `recorder.js` with it and post recordings while `recorder_enabled = true`.
  This is the same exposure the tracker has today. Accepted, and recorded here.
- **R-8 CSP mismatch.** If the recorder uses a source the policy does not allow,
  it fails silently. That fails closed, so it is safe. Mitigation: AC-W11.

## 12. Open questions

- **OQ-1 Consent copy.** The "Usage analytics" description (es/en/pt) does not
  mention recordings or heatmaps. Should it be updated, and the legal
  cookies/privacy pages too? If the copy changes, should `CONSENT_VERSION` be
  bumped so existing visitors are asked again? Recommended: update the copy
  first. Bumping the version is the owner's legal call.
- **OQ-2 Force reload on revoke.** If T-001 finds no in-page stop, should a
  revoke while the recorder is loaded reload the page, the precedent in
  `forgetIdentityOnRevocation`, or simply wait for the next page load (the
  owner's minimum)? Recommended: reload, because it ends recording at once and
  matches existing behaviour.
- **OQ-3 Closed SUPER_ADMIN set.** Should `ANALYTICS_SESSION_RECORDING_MANAGE`
  join `SUPER_ADMIN_EXCLUSIVE_PERMISSIONS`, which blocks assigning it directly
  to any other role from the panel? That set is documented as tied to the V5
  action keys, and this is not one of them. Recommended: yes, because it
  enforces "SUPER_ADMIN only" instead of relying on the seed.
- **OQ-4 Marker inside `@repo/feedback`.** The feedback modal is portaled from a
  shared package. There are two options:
  - (a) add an optional `rootDataAttributes` prop to `FeedbackModal` that the
    web passes; no new dependency;
  - (b) make `@repo/feedback` import the constant from `@repo/analytics`; this
    adds a dependency.

  Recommended: (a).
- **OQ-5 Retention.** How long should Umami keep recordings, and does Umami 3.5
  have a retention setting for them? T-001 measures the setting. The owner
  decides the duration.
- **OQ-6 Venue and experience contact blocks.** `VenueContactBlock.astro` and
  `ExperienceContactBlock.astro` are not on the block list. They show the
  listing's public contact data, which `strict` masks. Should they be blocked
  too? Recommended: no, because the owner's list is deliberate and the data is
  public.

## 13. Implementation notes

### Task breakdown (phased; each phase is a pause point)

**Phase 0 — Spike (blocks everything else)**

- T-001 Spike on staging. The owner runs it with owner credentials. Measure:
  - (a) the Umami API call and payload that set `recorder_enabled` and
    `replay_config`, and whether a partial update is accepted;
  - (b) whether the recorder exposes an in-page stop or unload;
  - (c) which hosts and workers `recorder.js` uses, against the CSP;
  - (d) how to turn a ClientRouter soft nav into a full load;
  - (e) the retention setting.

  Record the results on the issue. Re-plan if any result contradicts §6.

**Phase 1 — Contracts**

- T-002 Schemas: key, value schema, response union, public response schema,
  and the permission enum value. Includes guard updates and recounts.
- T-003 DB: structural migration for the enum value.
- T-004 Seed: baseline grant plus a data-migration via `db:seed:make`.

**Phase 2 — Core**

- T-005 Service: mapper branches, upsert union, and `isSessionRecordingEnabled`.
- T-006 API: public route plus headers plus a cache-list guard. The admin GET and
  PUT accept the key.
- T-007 `umami:setup` recorder definitions and step (from the T-001 findings).

**Phase 3 — Integration**

- T-008 Web: exclusion list plus matcher plus pages-directory guard.
- T-009 Web: recorder loader plus consent listener plus soft-nav guard.
- T-010 Web plus `@repo/feedback`: block markers on the four surfaces (OQ-4).
- T-011 Admin: `SessionRecordingCard` plus i18n plus permission gate.
- T-012 CSP task, only if T-001 or AC-W11 finds a violation.

**Phase 4 — Verification and docs**

- T-013 Rewrite `docs/analytics/session-replay-privacy.md`.
- T-014 Staging smoke (AC-SM1 to AC-SM5).
- T-015 Prod privacy verification (AC-SM6) before the first ON.

### File map

| Area | Files |
|---|---|
| schemas | `platform-settings.schema.ts`, `permission.enum.ts`, permission guards |
| service-core | `platform-settings.service.ts` |
| api | `routes/platform-settings/public/index.ts` (or a sibling), `routes/index.ts` mount, `routes/platform-settings/admin/index.ts` |
| db / seed | new migration, `rolePermissions.seed.ts`, new data-migration |
| web | `components/analytics/UmamiScript.astro`, new `lib/analytics/umami-recorder.ts`, new `lib/analytics/recording-exclusions.ts`, `ContactHost.client.tsx`, `WhatsAppContact.client.tsx`, `CookieConsentBanner.client.tsx` |
| feedback | `packages/feedback/src/components/FeedbackModal*` (OQ-4) |
| admin | `hooks/use-platform-setting.ts`, new `features/session-recording/`, `routes/_authed/platform/critical/index.tsx` |
| scripts | `scripts/umami/setup.ts`, new `scripts/umami/recorder-definitions.ts`, client additions |
| docs | `docs/analytics/session-replay-privacy.md` |

### Out of scope

- Admin and mobile recording.
- Hospeda-side replay viewer.
- Per-flow sampling.
- Editing recorder config from the admin panel.
- Selective unmask.
- Owner-facing heatmaps.

## 14. Linear

Canonical tracking: HOS-2347
