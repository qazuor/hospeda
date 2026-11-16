# Analytics (Umami)

Hospeda analytics run on a self-hosted [Umami](https://umami.is) instance. PostHog was
retired in HOS-2119 and is no longer used anywhere in the platform.

## Goals

- Measure useful business facts, not decorative clicks.
- Keep event names and properties consistent across `web`, `admin` and `api`.
- Avoid PII and keep noise and cost low.
- Treat the backend as the canonical source whenever an operation can be confirmed server-side.

## Current model

- `apps/web`: Umami tracker script served through a first-party relay.
  - Umami is cookieless, so anonymous pageviews and events are captured before consent.
  - After cookie consent the user id is attached with `identify`, once per session.
- `apps/admin`: authenticated internal capture with explicit events and no autocapture.
  The identity is the staff user id.
- `apps/api`: server-side capture for signup, onboarding, contact, publication and billing
  through `apps/api/src/lib/analytics-client.ts`. Server events never carry a distinct id.
- `packages/analytics`: typed event catalog, Zod schemas, browser/server helpers, the Umami
  payload and server providers, and anti-PII guards.

## Documents

- [event-catalog.md](./event-catalog.md): current events and properties.
- [event-migrations.md](./event-migrations.md): old event name to new event name mapping.
- [umami-dashboards.md](./umami-dashboards.md): boards, funnels and goals, and how to regenerate them.
- [session-replay-privacy.md](./session-replay-privacy.md): Session Replay status and policy.

## Operational status

- Session Replay: not offered (Umami does not provide it).
- Dashboards, funnels and goals: created idempotently by `pnpm umami:setup`
  (see [umami-dashboards.md](./umami-dashboards.md)).

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `HOSPEDA_UMAMI_URL` | api | Base URL of the Umami instance |
| `HOSPEDA_UMAMI_WEBSITE_ID_WEB` | api | Website id for web-surface events |
| `HOSPEDA_UMAMI_WEBSITE_ID_ADMIN` | api | Website id for admin-surface events |
| `HOSPEDA_UMAMI_API_KEY` | api | Read access for owner-facing stats |
| `PUBLIC_UMAMI_SCRIPT_URL`, `PUBLIC_UMAMI_WEBSITE_ID` | web | Tracker script and website id (build args) |
| `VITE_UMAMI_SCRIPT_URL`, `VITE_UMAMI_WEBSITE_ID` | admin | Tracker script and website id (build args) |

The canonical registry is in `packages/config`. When a variable is unset, analytics is
disabled silently for that surface.

## Practical rules

- `snake_case` for events and properties.
- Never send email, phone, message, token, password, address or full DB payloads.
- Use stable ids (`user.id`, entity ids, local subscription ids), never display names.
- On the frontend, prefer explicit events.
- On the backend, capture only once the operation is confirmed.
