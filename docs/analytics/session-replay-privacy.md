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
contributions, contact, partner claims, the whole `sumate` family (partner, provider and
sponsor sign-ups) and the newsletter flow, in every locale. A test fails if any entry stops
matching a real page directory.

**Rule: free-text forms are never recorded.** A page whose main content is a form where a
visitor types free text (a lead, an application, a message) is excluded as a whole route,
not just masked. That is why the whole `sumate` prefix is excluded: all three sign-ups are
free-text lead forms (review decision, 2026-11-18).

While the recorder is loaded, a soft navigation into an excluded route is turned into a full
page load. The unload ends the recording, and the new page never loads the recorder.

## Blocked surfaces

Six surfaces carry `data-umami-block` on their outermost element. The recorder replaces them
with an empty placeholder, so not even their masked shape is recorded:

1. the contact-owner form on an accommodation (`ContactHost`);
2. the WhatsApp contact block (`WhatsAppContact`);
3. the venue contact block (`VenueContactBlock`);
4. the experience contact block (`ExperienceContactBlock`);
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

**Umami 3.5 does not let us configure how long recordings are kept, and it never deletes
them.** The spike against the staging container found no retention setting in the api, the
website config or the app environment, and no job that prunes replay rows. A recording is
removed only when the website is reset or deleted.

So the retention in force today is **indefinite**. This replaces the spec's assumption
(D-5) of a 14-day setting or a 30-day Umami default; neither exists. Choosing a retention
mechanism is an open owner decision, recorded on HOS-2347. Until it is decided, keep
production ON only for bounded windows.

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
