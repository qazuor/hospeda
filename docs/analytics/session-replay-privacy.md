# Session Replay Privacy

How Hospeda records sessions and heatmaps with the Umami recorder, what it never captures,
and the check that must pass before production is switched on (HOS-2347).

## Current status

- Session replays and heatmaps come from the **Umami 3.5 recorder** (`recorder.js`).
- They run on the **public web only** (`apps/web`). The admin panel and the api never load
  the recorder; a guard test enforces it for the admin
  (`apps/web/test/lib/analytics/recorder-placement.guard.test.ts`).
- They are **off by default**. A missing setting row means off.
- PostHog's replay was never turned on and PostHog was retired in HOS-2119.

## Two layers

| Layer | Where | What it controls |
| --- | --- | --- |
| Hospeda switch | `platform_settings` key `analytics.sessionRecording`, card on `/platform/critical` in the admin | Whether the web ever loads `recorder.js`. This is the operational on/off. Only holders of `ANALYTICS_SESSION_RECORDING_MANAGE` see and change it. The permission is granted to SUPER_ADMIN by the seed; not locked (D-3), so per-user overrides can extend it. |
| Umami config | `website.replay_config` of the WEB website, written by `pnpm umami:setup` | Replay vs heatmap, sampling, masking, maximum duration, block selector. |

The Umami config can stay enabled permanently: while the Hospeda switch is off, no page loads
the recorder, so Umami receives nothing.

## When the recorder loads

The loader (`apps/web/src/lib/analytics/umami-recorder.ts`) checks these conditions on every
page load, in order, and stops at the first that fails. Every failure means no recording.

1. The Umami tracker is on the page.
2. The path is not excluded (see "Excluded routes").
3. The visitor granted the **usage analytics** consent category. The loader never asks again
   and never reloads; it waits for a grant in the same tab.
4. `GET /api/v1/public/session-recording` answers 200 with `{ "enabled": true }` within 3 s.
   A network error, a timeout, a non-200 or a malformed body all mean off.
5. The tracker is ready and the visitor identity has settled, so the recorder never opens a
   session before the identify (HOS-2119 OQ-5).
6. Nothing navigated in the meantime. A router navigation that starts while steps 4 and 5 are
   in flight cancels the evaluation, and the next page load starts again from step 1. This
   closes a race where the recorder could load as the visitor landed on an excluded route.

Then it injects exactly one `<script id="umami-recorder">`.

## Consent rule

Recording is part of the **usage analytics** consent category. The category description in
es, en and pt states that it may include session recordings and heatmaps with all text and
fields masked. `CONSENT_VERSION` stayed at `2`: the change narrows nothing a visitor already
accepted, so they are not asked again (D-1). A visitor who did not grant analytics is never
recorded.

## Excluded routes

The single list is `RECORDING_EXCLUDED_ROUTE_PREFIXES` in
`apps/web/src/lib/analytics/recording-exclusions.ts`. It is not copied here so it cannot drift.
It covers sign-in, the account area, guest conversations, checkout, publishing, feedback,
contributions, contact, partner claims and the newsletter flow, in every locale. A test fails if any entry stops
matching a real page directory.

**Rule: free-text forms are excluded as a whole route.** A page whose main content is a
form where a visitor types free text (a message, a claim, a contribution) is excluded, not
just masked.

**Exception: `sumate/*` is recorded (owner decision, 2026-11-18).** The partner, provider and
sponsor sign-up pages are lead forms, but the owner chose to record them to study the
conversion funnel. They rely on strict masking alone: every text node and every input value is
masked, with no selective unmask, so an email, a phone number or a document ID typed there
never reaches a replay. If a sign-up page ever gains a field that must not appear even as a
masked shape, mark its outermost element with `data-umami-block` (see below).

While the recorder is loaded, a soft navigation into an excluded route is turned into a full
page load. The unload ends the recording, and the new page never loads the recorder.

## Blocked surfaces

Six surfaces carry `data-umami-block` on their outermost element. The recorder replaces them
with an empty placeholder, so not even their masked shape is recorded:

1. the contact-owner form on an accommodation (`ContactHost`);
2. the WhatsApp contact block (`WhatsAppContact`);
3. the venue contact block (`ListingContactBlock`, `blockProps` from `buildVenueContactBlock`);
4. the experience contact block (`ListingContactBlock`, `blockProps` from `buildExperienceContactBlock`);
5. the cookie consent banner, backdrop and dialog (`CookieConsentBanner`);
6. the feedback modal, on its portal root (`FeedbackHeadlessHost` passes the marker to
   `@repo/feedback`'s `FeedbackModal`).

The selector `[data-umami-block]` is declared once (`apps/web/src/lib/analytics/recording-block.ts`)
and written to Umami by `pnpm umami:setup`.

## Masking, sampling and length

| Setting | Value |
| --- | --- |
| `maskLevel` | `strict`: every text node and every input is masked. **There is no selective unmask**; no element is ever marked safe to show. |
| `sampleRate` (replays) | 0.5 |
| `heatmapSampleRate` | 0.5 |
| `maxDuration` | 300000 ms (5 minutes) per page load, replays only. Heatmaps have no time cap. |
| `blockSelector` | `[data-umami-block]` |

Source: `scripts/umami/recorder-definitions.ts`.

### Measured recorder behaviour

Read from the `recorder.js` that staging Umami 3.5 serves (2026-11-18, read only):

- The recorder decides sampling and starts once per **page load** (each full load of a page).
  A ClientRouter soft navigation does not start a new recording; the running one follows
  `pushState` and keeps recording the new page.
- The 5-minute cap counts from the start of that page load's replay. When it is reached the
  replay **stops for good in that page load**: nothing restarts it, not even a soft
  navigation or `pushState`. Only the next full page load can start a new one (sampled again
  at 0.5).
- **Heatmaps are not capped.** Click and scroll events keep being sent, across soft
  navigations, until the page unloads.

## Propagation limits

- **Switch turned off.** New page loads stop loading the recorder within about 60 s: the
  public answer is cached for 30 s at the edge and 30 s in the browser. A page that is already
  recording keeps its replay going until it unloads or its 5 minutes run out, and keeps sending
  heatmap clicks and scrolls until it unloads. Nothing forces a reload.
- **Consent revoked.** Nothing reloads at revoke time (D-2), so the current page keeps its
  replay going until the visitor leaves it or its 5 minutes run out, and keeps sending heatmap
  clicks and scrolls until the visitor leaves it. The next navigation, even a
  link inside the site that would normally swap the page in place, is turned into a full page
  load, which ends the recording. The new page does not record.

## Retention

**Umami 3.5 has no retention setting and no age-based delete API**, so it never deletes
recordings on its own. A recording is removed only when the website is reset or deleted.
Hospeda therefore purges them itself (owner decision, 2026-11-18, HOS-2347 OQ-8).

### What is deleted, and when

- Replays (`session_replay`, **saved replays included**) and heatmap events (`heatmap_event`)
  older than the configured period are deleted. A saved replay is only a pointer
  (`session_replay_saved`: a name and a `visit_id`) to chunks stored in `session_replay`; the
  chunks are purged by age like any other, then the pointers that are older than the period
  or whose visit has no chunk left are removed, so none dangles. Saving a replay does not
  extend its life: the legal copy promises deletion within the retention period. The only allowed periods are **14, 30 or 60 days**; the default is
  **30**.
- The period is part of the `analytics.sessionRecording` platform setting and is chosen in
  the admin card (`/platform/critical`), next to the on/off switch, behind the permission
  `analytics.sessionRecording.manage`.
- The `session-recording-retention` cron runs daily (04:25 Buenos Aires) and **also while the
  switch is OFF**: data recorded earlier still has to go.
- The card has a "Limpiar ahora" button. It refetches the setting when its confirmation opens
  and sends the period the admin confirmed; the api answers `409` (`RECORDING_RETENTION_MISMATCH`)
  when the stored period changed meanwhile. The result shows the counts and the period
  actually used. The manual purge has a 60 second budget: when it runs out, the card says the
  rest will be finished by the next daily run.
- Only one purge runs at a time (a Postgres advisory lock on the purge's own connection,
  taken by the cron and the manual purge alike). A second manual purge answers `409`
  (`RECORDING_PURGE_ALREADY_RUNNING`); the cron skips with a log.
- Every delete is scoped to `website_id = HOSPEDA_UMAMI_WEBSITE_ID_WEB` and
  `created_at < now() - <period>`, in batches of 5000 rows. Other websites in the same Umami
  database are never touched.

### How the api reaches Umami

The api connects **directly to the Umami Postgres** through `HOSPEDA_UMAMI_DATABASE_URL`
(secret, api only). That role can only `SELECT` and `DELETE` on those three tables. It is the
single Umami write path the api holds: the api still never holds a Umami API write key, and
the guard `no-umami-write-credential` keeps refusing one.

When the variable is unset, the manual purge answers `503 SERVICE_UNAVAILABLE` (the body
carries only the code: a 5xx masks its reason, the cause is in the log). The cron skips with a
warning outside production, and in production it reports the run as **failed** so the missing
configuration shows red. Nothing crashes, but nothing is purged either, so set it before the
first prod ON.

#### One-time setup of the restricted role (the owner runs this)

Run it on the Umami database, as a superuser, replacing the password. Nothing in the
repository runs it for you.

```sql
CREATE ROLE umami_retention LOGIN PASSWORD '<set-by-owner>';
GRANT CONNECT ON DATABASE umami TO umami_retention;
GRANT USAGE ON SCHEMA public TO umami_retention;
GRANT SELECT, DELETE ON session_replay, heatmap_event, session_replay_saved TO umami_retention;
```

Then set `HOSPEDA_UMAMI_DATABASE_URL=postgresql://umami_retention:<password>@<host>:5432/<database>`
on the api in Coolify (staging and production) and redeploy.

`SELECT` is needed because the deletes filter on `website_id`, `created_at` and `visit_id`. No other
privilege is granted, so the role cannot read or change any other Umami table.

### Umami upgrades can change the schema

The purge depends on the Umami 3.5 names: tables `session_replay`, `heatmap_event` and
`session_replay_saved`, columns `website_id`, `created_at` and `visit_id`. A Umami upgrade can rename them. The unit test
`apps/api/test/services/session-recording-purge.test.ts` pins those names and
`apps/api/test/integration/session-recording-purge.integration.test.ts` runs the real
statements against Postgres, so an upgrade that changes them must update the purge and both
tests together. After every Umami upgrade, check the
schema and run a manual purge once.

### Recordings are pseudonymous, not anonymous

For logged-in users the recorder shares the Umami session used by `umami.identify`
(per-user sessions, HOS-2119). A replay can therefore be tied to the account identifier of
the user it belongs to. Treat recordings as **pseudonymous personal data**, not as anonymous
data: masking removes what is typed and shown, not the link to the account. Retention is the
control that bounds how long that link exists.

## Manual verification before production (AC-SM6)

Production is not switched on before this check is signed. Run it on production with the
switch ON for the duration of the check only, by the owner or someone the owner designates.

1. Accept usage analytics in the cookie banner.
2. Sign up or log in. Expected: no recording at all (excluded route).
3. Open an accommodation, a venue and an experience; open the contact form, the WhatsApp
   block, the contact blocks and the feedback modal. Expected: each shows as a blocked
   placeholder; all other text is masked.
4. Start a checkout. Expected: no recording on the checkout pages.
5. Browse public pages for about 2 minutes, including a listing page. Expected: a replay
   exists (sampling is 0.5, repeat if needed) and every text is masked.
6. In the Umami replay, confirm that no password, email, phone, message, name, payment datum
   or token is visible.
7. Turn the switch off unless the owner decides to keep a window open.

Sign the result on the issue with `/smoke HOS-2347`, then record it here.

| Date | Environment | Executor | Result | Notes |
| --- | --- | --- | --- | --- |
| | prod | | | |
