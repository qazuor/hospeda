# Rate Limiting

Operational reference for the API rate-limiter — how it identifies clients,
how it builds Redis keys, what the safety guarantees are, and what to do
when monitoring surfaces unexpected key shapes.

Implementation: `apps/api/src/middlewares/rate-limit.ts`.

## 1. Buckets

Rate limits are partitioned by **endpoint type** (chosen by request path)
and the **client identifier** (see §2).

| Endpoint type | Matches | Default window | Default max |
|---------------|---------|----------------|-------------|
| `auth`        | `/api/auth/*`, `/api/v1/auth/*`, `/api/v1/public/auth/*`, `/api/v1/protected/auth/*` | 5 min | 50 |
| `admin`       | `/api/v1/admin/*` | 10 min | 200 |
| `public`      | `/api/v1/public/*` (non-auth, non-webhook) | 1 h | 1000 |
| `billing`     | any `/billing/*` path with method `POST` | 15 min | 10 |
| `webhook`     | any path containing `/webhooks/` or `/webhook/` | 1 min | 100 |
| `general`     | anything else (root path, internal probes, unmatched routes) | 15 min | 100 |

Selection order matters: webhook → billing → auth → admin → public → general.
A `POST /api/v1/admin/billing/...` lands in `billing`, not `admin`.

The Redis key is `rl:<endpoint-type>:<client-id>`. Example:
`rl:public:203.0.113.10`.

## 2. Client identifier (trust chain)

The identifier is produced by `getClientIp({ c })`. It validates the
**raw socket source** before deciding whether to trust forwarded-IP
headers, so a request that bypasses the reverse proxy cannot spoof its
identifier.

### Trust chain

1. **`API_RATE_LIMIT_TRUST_PROXY=false`** (off by default in this project):
   socket IP is used directly. Each TCP peer gets its own bucket. No
   proxy headers are read.
2. **No socket available** (tests, edge runtimes): falls back to
   header-based extraction (`cf-connecting-ip` → `x-forwarded-for[0]` →
   `x-real-ip`) for backward compatibility. Returns `unknown` if no
   headers either.
3. **Loopback socket** (`127.0.0.0/8`, `::1`, `::ffff:127.x`):
   identifier is `internal:<socket-ip>`. Represents Docker / Coolify
   healthcheck probes and in-container traffic.
4. **Trusted source** — RFC1918 (`10/8`, `172.16/12`, `192.168/16`),
   IPv6 unique-local (`fc00::/7`), or an IP in
   `API_RATE_LIMIT_TRUSTED_PROXIES`: proxy headers are read in priority
   order `cf-connecting-ip` → `x-forwarded-for[0]` → `x-real-ip`. When
   none are present, the identifier is `proxy:<socket-ip>`.
5. **Untrusted source** — any other public IP: proxy headers are
   **ignored** (spoof prevention). Identifier is `untrusted:<socket-ip>`.

### Identifier prefixes you may see in Redis / logs

| Prefix       | Meaning                                                                  |
|--------------|--------------------------------------------------------------------------|
| `internal:`  | Container-local source (healthcheck or in-process tooling).              |
| `proxy:`     | Came from a trusted upstream but no client-IP header was attached.       |
| `untrusted:` | Came from a public IP that bypassed the configured trusted-proxy chain.  |
| (no prefix)  | The real client IP as forwarded by Cloudflare / Traefik.                 |
| `unknown`    | Fallback only when neither socket nor proxy headers are available.       |

### Configuration env vars

| Var | Default | Purpose |
|---|---|---|
| `API_RATE_LIMIT_TRUST_PROXY` | `true` | Master switch for proxy-header trust. Off → use socket only. |
| `API_RATE_LIMIT_TRUSTED_PROXIES` | `""` | Comma-separated list of extra source IPs to treat as trusted (in addition to loopback + RFC1918 + unique-local). |
| `HOSPEDA_REDIS_URL` | required in prod | Backend for rate-limit state. Without it, in-memory only. |
| Other `API_RATE_LIMIT_*_*` | various | Per-bucket window/max/message. See `apps/api/src/utils/env.ts`. |

## 3. Healthcheck bypass

Loopback traffic to a known healthcheck path is **fully bypassed** —
the middleware calls `next()` without recording the request in Redis.

Bypassed paths: `/`, `/health`, `/healthz`, `/readyz`, `/livez`.

Both conditions must hold (`source is loopback` AND `path in
healthcheck list`). A non-loopback caller pinging `/` is rate-limited
normally; a loopback caller pinging a non-health path is rate-limited
normally. This prevents a hostile actor from hiding behind the
allowlisted path.

The bypass exists because Docker / Coolify probes the container every
~30 seconds from inside the same container network (no proxy headers,
loopback socket), which without the bypass produced a single shared
`rl:general:unknown` bucket — see §5.

## 4. Other rate-limit middlewares

`rate-limit.ts` exposes three additional factories that build on the
same store but partition independently:

- `createPerRouteRateLimitMiddleware({ requests, windowMs })` — extra
  cap on a specific route. Keys are `route:<path>:<client-id>`.
- `createKeyedRateLimitMiddleware({ keyExtractor, keyPrefix, ... })` —
  hash-keyed by any extractor (e.g. guest email). Keys are
  `ratelimit:<prefix>:<sha256-hex>`.
- `createSlidingWindowPerUserRateLimit({ windowMs, max })` —
  per-authenticated-user sliding window. Uses Redis sorted sets when
  `HOSPEDA_RATE_LIMIT_BACKEND=redis`, in-memory otherwise. Keys are
  `rl:slide:<prefix>:<user-id>`.

All four mechanisms call `getClientIp({ c })` when they fall back to
IP, so the trust chain applies uniformly.

## 5. Monitoring & runbook

### Healthy state

`redis-cli KEYS 'rl:*'` against the prod redis should show keys that
look like real client IPs (`rl:public:203.0.113.42`), per-route
buckets (`rl:route:/api/...:203.0.113.42`), or the keyed prefix
(`ratelimit:conv:initiate:email:<sha>`). You should **not** see any
`rl:*:unknown` keys under normal operation.

### Triage: `rl:*:unknown` keys present

The middleware logs a structured warning whenever it falls back to
`unknown`:

```
event: rate_limit.unknown_source
path: <request path>
method: <verb>
hasCfConnectingIp: false
hasForwardedFor: false
hasRealIp: false
```

Steps:

1. Grep `hops logs api` for `rate_limit.unknown_source` — confirms it
   is firing in real time.
2. Inspect the `path` and `method` fields. If the path is a
   healthcheck route but the source is non-loopback, an external
   caller is probing your health endpoint — investigate.
3. If the path is `/` from loopback, the bypass may have been
   disabled or misconfigured. Verify `HEALTHCHECK_PATHS` in
   `rate-limit.ts` matches the Coolify / Dockerfile healthcheck URL.
4. If neither, the most likely cause is a Node adapter change that
   stopped attaching `socket` to the raw request. Investigate the
   adapter layer (`apps/api/src/index.ts` and `@hono/node-server`).

### Triage: `untrusted:<ip>` traffic spikes

`rl:<type>:untrusted:<ip>` means a public IP hit the API while the
socket source was also that public IP — i.e. the caller bypassed
Cloudflare and Traefik. Either:

- Direct hit to the VPS IP on port 443 with `Host: api.hospeda.com.ar`
  — verify Traefik is the only listener and the firewall blocks the
  container ports.
- A misconfigured forward in Cloudflare or Traefik that loses the
  `cf-connecting-ip` / `x-forwarded-for` headers.

In either case the limiter still protects the bucket: the caller's
own socket IP is the identifier, so they cannot share or starve a
real-client bucket.

## 6. Related

- Spec: `.qtm/specs/SPEC-110-rate-limit-ip-extraction-fix/spec.md`
- Background discovery: SPEC-103 T-086 redis verify, 2026-05-13.
- Implementation: `apps/api/src/middlewares/rate-limit.ts`.
- Tests: `apps/api/test/middlewares/rate-limit-ip-extraction.test.ts`,
  `apps/api/test/middlewares/rate-limit.test.ts`,
  `apps/api/test/middlewares/sliding-window-rate-limit.test.ts`.
