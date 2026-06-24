# Make.com Social Publishing Integration

How Hospeda hands a social post to **Make.com**, which posts it to Instagram /
Facebook and returns the result **in the same HTTP response** (synchronous
Webhook Response model). This is the wiring behind both the publish cron and the
**"Publish now"** button.

## Overview (synchronous)

```
Hospeda (dispatchTarget)                 Make.com scenario
─────────────────────────                ─────────────────
POST <make_webhook_url>      ──────────▶ 1. Webhook trigger
  header x-make-apikey: <KEY>            2. Verify x-make-apikey (filter)
  body: SocialMakePayload                3. Publish to IG/FB
                                         4. Webhook Response  ◀── returns JSON result
  reads response body  ◀───────────────────  { status: SUCCESS|FAILED, ... }
  SUCCESS → target PUBLISHED (+cascade, +recurrence rearm)
  FAILED  → retry (≤3) then FAILED
```

One request / one response. Make does **not** call back into Hospeda, so the
Hospeda API does **not** need to be reachable from the internet — local works
without a tunnel. The trade-off: the POST waits until Make finishes publishing
(timeout 40s), so the scenario must respond within that window.

## Two config values you must provide

| Value | Where it lives | Who sets it | Purpose |
|-------|----------------|-------------|---------|
| `make_webhook_url` | `social_settings` row (key = `make_webhook_url`) | Admin UI `PATCH /api/v1/admin/social/settings/make_webhook_url`, or DB | The Custom Webhook URL Make generates. While empty, every dispatch returns `skipped_no_webhook` (nothing posts). |
| `HOSPEDA_MAKE_API_KEY` | env var on the API | You (a shared secret) | Sent as the `x-make-apikey` request header. Make verifies it (step 2) so only Hospeda can trigger the scenario. |

> `HOSPEDA_MAKE_INBOUND_KEY` is **no longer needed** in the webhook-response
> model (Make never calls Hospeda back). It can stay unset.

## Outbound payload (what your webhook trigger receives)

```jsonc
{
  "targetId": "uuid",            // one publish target = one platform
  "postId": "uuid",
  "platform": "INSTAGRAM",       // or FACEBOOK, ...
  "publishFormat": "FEED",
  "makeChannelKey": "ig_main",   // your routing key per platform-format (nullable)
  "captionFinal": "string",      // finalCaption ?? captionBase
  "hashtagsFinal": "#a #b",      // finalHashtagsText ?? ""
  "footerFinal": "string",       // resolved footer content, or ""
  "mediaUrls": ["https://res.cloudinary.com/.../img.jpg"], // ordered by position
  "scheduledAt": "2026-07-01T15:00:00.000Z", // or null
  "timezone": "America/Argentina/Buenos_Aires"
}
```

Build the IG/FB post from `captionFinal` + `hashtagsFinal` + `footerFinal` and
`mediaUrls`. Route to the right account using `platform` / `makeChannelKey` /
`publishFormat`. (No callback URLs anymore — the result goes back via Webhook
Response, below.)

## The response Hospeda expects (Make → Webhook Response module)

End the scenario with a **Webhook Response** module returning HTTP `200` and a
JSON body.

On success:

```jsonc
{ "status": "SUCCESS", "externalPostId": "ig_123", "externalPostUrl": "https://instagram.com/p/..." }
```

On failure (put a Webhook Response inside the module's **error handler**):

```jsonc
{ "status": "FAILED", "errorMessage": "why it failed" }
```

Hospeda parses this body in `dispatchTarget`:

- `SUCCESS` → target `PUBLISHED` (+ `externalPostId`/`externalPostUrl`), then
  cascades the post to `PUBLISHED` once all targets are terminal and re-arms
  recurrence.
- `FAILED` or an unparseable body → retry (up to 3 attempts) then `FAILED`.

## Scenario checklist (Make.com)

1. **Custom webhook** trigger → copy its URL → this is `make_webhook_url`.
2. **Filter**: only continue if header `x-make-apikey` equals your
   `HOSPEDA_MAKE_API_KEY`. Otherwise stop.
3. **Publish module(s)**: IG/FB post from the payload fields.
4. **Webhook Response** (success): HTTP 200, body `{ "status": "SUCCESS", ... }`.
5. On the publish module add an **error handler** → **Webhook Response**
   (failure): HTTP 200, body `{ "status": "FAILED", "errorMessage": ... }`.

Keep the whole scenario under ~40s so the synchronous response lands before
Hospeda's timeout.

## Local / staging config steps (Hospeda side)

Once you have the webhook URL:

1. Set the webhook URL:
   `PATCH /api/v1/admin/social/settings/make_webhook_url` with `{ "value": "<url>" }`
   (permission `SOCIAL_SETTINGS_MANAGE`), or update the `social_settings` row directly.
2. Set `HOSPEDA_MAKE_API_KEY=<key>` in the API env (`apps/api`). For prod, set it
   in Coolify and redeploy.
3. Restart / redeploy the API so it reads the new env.

With both in place, **Publish now** dispatches every target to Make and resolves
each one synchronously from the Webhook Response; the cron keeps handling
scheduled / recurring posts.
