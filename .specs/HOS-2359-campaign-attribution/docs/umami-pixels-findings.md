# Umami pixels: measurements M-1 to M-4

Measured on 2026-11-23 against a **local** Umami 3.5.0 (`http://127.0.0.1:3010`, docker,
throwaway users `m1-user` and `m1-view-only`). Nothing was written to staging or production
Umami. Every test pixel was deleted afterwards.

## M-1: creating a pixel through the API

| Question | Result |
|---|---|
| Endpoint | `POST /api/pixels` with `{ name, slug }` answers 200 and `{ id, name, slug, userId, teamId, createdAt, ... }` |
| Auth | `Authorization: Bearer umami_...` works. The `x-umami-api-key` header answers 401 |
| Role | A `user`-role key can create pixels. A view-only key answers **401** |
| Duplicate slug | **500 with an empty body**, not 409. Same for a slug owned by another user (slugs are unique instance-wide) |
| Slug length | Up to **100** characters. Longer answers 400 |
| Slug charset | Anything is accepted, upper case and dots included. We restrict ourselves to `[a-z0-9-]` |
| Rename | `POST /api/pixels/:id` with `{ name }` (partial body) works |
| Delete then reuse | A deleted pixel's slug can be created again |
| Minting a key | `POST /api/me/api-keys { name }` answers `{ key: 'umami_...' }` for the logged-in user |

Consequences:

- `ensureUmamiPixel` treats any non-2xx other than 401/403 as "maybe it already exists"
  and looks the slug up (M-4) before giving up. 500 is the duplicate case.
- The slug ceiling of 90 in the spec fits inside Umami's 100, so no prefix shortening is
  needed. The longest generated template slug is 61 characters.
- `HOSPEDA_UMAMI_PIXEL_API_KEY` must belong to a `user`-role account (not view-only, not admin).

## M-2: serving and counting

| Question | Result |
|---|---|
| `GET /p/<slug>` | 200, `image/gif` 1x1, `cache-control: no-store`. Unknown slug: 404 |
| Query string | Accepted, still counted |
| Counting | One GET with a browser user agent counts one pageview |
| Reading the count | `GET /api/websites/<pixelId>/stats` (the pixel id works as a website id). `/api/pixels/:id/stats` does not exist |
| `HEAD` | Not counted |
| Bot filter | **The `GoogleImageProxy` user agent and curl's default user agent are dropped as bots and not counted** |

Consequences:

- `UMAMI_PIXEL_PATH = '/p'` is confirmed.
- **Limitation, documented, not worked around:** opens fetched through Gmail's image proxy
  are not counted. The open figure is a lower bound. Click attribution (UTMs) is the
  reliable signal. Written down in `docs/analytics/umami-dashboards.md`.

## M-3: board components

The board component registry of 3.5.0 (`.next/static/chunks/2xt3ysoabl_wc.js`) has no
attribution or pixel component. Available: WebsiteMetricsBar, EventsMetricsBar, Goal,
Funnel, WebsiteChart, UTM, RealtimeHeader, RealtimeChart, RealtimeActiveUsers,
RevenueMetricsBar, RevenueChart, RevenueMetricsTable, MetricsTable, WorldMap,
WeeklyTraffic, EventsChart, TextBlock.

Consequence for part 2 (the Attribution board): use the `UTM` component and
`MetricsTable`. Pixel opens cannot be shown on a board; they are read per pixel.

## M-4: finding an existing pixel

| Question | Result |
|---|---|
| Endpoint | `GET /api/pixels?search=<text>&pageSize=100` |
| Envelope | `{ data, count, page, pageSize, search }` |
| Matching | Case-insensitive **substring** over both name and slug |
| Scope | Only the caller's own pixels. A user key does not see admin pixels |

Consequences:

- The exact slug match is made client-side (`ensureUmamiPixel` and `umami:setup` both do it).
- Template pixels (created by `umami:setup` with its own credential) and newsletter pixels
  (created by the api's pixel account) never see each other in listings. That is why
  `umami:setup` ignores `newsletter-*` and the api never touches `email-*`.
