---
title: Purge the edge cache once per web deploy, scoped to the deployment's namespace
linear: HOS-427
statusSource: linear
created: 2026-08-10
type: fix
areas:
  - web
  - devops
---

# Purge the edge cache once per web deploy, scoped to the deployment's namespace

## 1. Summary

Nothing purges the Cloudflare edge cache when `apps/web` is deployed. Public HTML
is served with `s-maxage=300, stale-while-revalidate=600`, so for up to ~15
minutes after every release the edge keeps serving the previous build's HTML.

This spec makes a freshly-deployed web container issue **exactly one** cache
purge, scoped to its own deployment namespace (`<env>:all`), as soon as it is
actually serving. It never uses Cloudflare's `purge_everything`, because staging
and production share one Cloudflare zone and a whole-zone flush from staging
would evict production.

## 2. Problem

### 2.1 What is broken

Verified 2026-08-10: there are zero purge calls in `scripts/server-tools/` and in
`.github/workflows/`. The purge machinery from HOS-369 exists and works, but
nothing invokes it as part of a deploy.

Three concrete consequences:

1. **Stale content is served.** The W2-2 static pages (`nosotros`, the three
   legal pages, `beneficios`, `funcionalidades`, `colaborar/*`, `contacto`,
   `preguntas-frecuentes`) change ONLY on deploy. Their `s-maxage` *is* their
   post-deploy staleness window — each page's own comment says so.
2. **Server islands can break.** `apps/web/Dockerfile:80-86` documents this in
   the code itself: cached HTML can carry a `/_server-islands/...?e=` payload
   encrypted with the previous build's `ASTRO_KEY`. PR #2707 stabilised
   `ASTRO_KEY`, which removes that specific trigger, but the general class —
   old HTML pointing at a new origin — is still live.
3. **It blocks HOS-426.** Raising TTLs (D-15: 24 h for static pages) is not
   safe while deploys do not purge: a corrected legal text would stay wrong for
   a full day.

### 2.2 Why the obvious fixes are wrong

**`purge_everything` is not an option.** Cloudflare has no zone-scoped variant,
and `staging.hospeda.com.ar` and `hospeda.com.ar` are the same zone. A flush
triggered by a staging deploy empties production's cache. This is recorded as an
open constraint in §7 of the HOS-369 spec, and is re-stated in the JSDoc of
`packages/service-core/src/revalidation/revalidation.service.ts:825`.

**Hooking into `hops redeploy` would almost never run.** `hops redeploy`
(`scripts/server-tools/src/commands/redeploy.ts:65-94`) queues a deploy through
Coolify's REST API and returns immediately — no polling, no status check, no
health wait; `CoolifyClient` does not even model a deployment-status endpoint.
More decisively, the documented production deploy path is **a button click in the
Coolify dashboard** (root `CLAUDE.md` → Deploy), not `hops`. A purge wired only
into `hops redeploy` would miss the dominant deploy path.

## 3. Goals

- **G-1** — Every web deploy, regardless of how it was triggered (Coolify
  dashboard button, `hops redeploy`, or any future path), results in exactly one
  edge-cache purge for that deployment's namespace.
- **G-2** — The purge is scoped to the deploying environment (`prod:all` or
  `preview:all`). A staging deploy must never evict production's cache.
- **G-3** — The purge is **one** Cloudflare request per deploy, never a burst
  (HOS-297: ~18 identical purges returned 403).
- **G-4** — A failed purge is loud: it is retried, and if it still fails it
  produces an ERROR log and a Sentry event. It never silently succeeds.
- **G-5** — A failed purge never takes the site down. The worst case degrades to
  today's behaviour (stale for up to ~15 min), never to an outage.
- **G-6** — The mechanism is versioned in this repo and visible to code review —
  not dashboard-only configuration.

## 4. Non-goals

- **NG-1** — Raising cache TTLs. That is HOS-426, which this spec unblocks.
- **NG-2** — Adding deployment-status polling to `hops redeploy` / `CoolifyClient`.
  Worth doing on its own merits, but it is not how this purge is triggered.
- **NG-3** — Purging the API or admin apps. Only `apps/web` serves edge-cached
  HTML.
- **NG-4** — Changing what gets tagged, or the tag vocabulary. The catch-all tag
  already covers every cacheable response (see §5.2).
- **NG-5** — Replacing or refactoring `RevalidationService`'s runtime purge path
  (entity writes). This spec adds a deploy-time purge alongside it.
- **NG-6** — Any use of `purge_everything` / `purgeWholeZone`.

## 5. Current baseline

### 5.1 The namespace is what separates staging from production

`packages/cache-tags/src/namespace.ts` defines
`CACHE_TAG_ENVIRONMENTS = ['prod', 'preview', 'dev', 'test']` (line 59) and
`resolveCacheTagEnvironment({ deployEnv, nodeEnv })` (lines 265-293), which reads
`HOSPEDA_DEPLOY_ENV` and **never infers `prod`** — it throws rather than guess,
precisely because guessing would make staging purge production.

The web app resolves this once per process and memoises it, including the failure,
in `apps/web/src/lib/cache/cache-tag-environment.ts` (`getCacheTagEnvironment()`).
It is **fail-closed**: when the environment cannot be resolved it returns `null`,
tagging is disabled, and cacheable responses are demoted to `private, no-cache`.

### 5.2 Purging the catch-all tag provably reaches everything

`buildCatchAllTag` is **not** part of `@repo/cache-tags` (the Linear issue says it
is — that is wrong). It is a private helper in
`apps/web/src/lib/cache/response-cache.ts:75-81`, which calls
`namespaceCacheTag({ environment, tag: CACHE_TAG_ALL })` to produce `prod:all`,
`preview:all`, etc.

`declareCacheTags` and `buildStaticCacheHeaders` inject that tag at the head of
every tag set. This is guaranteed by a test, not by convention:
`apps/web/test/static-guards/cacheable-responses-carry-catch-all.test.ts` has a
membership half (invokes each real emitter and asserts the catch-all is present
and first) and a **closure half** that scans all of `apps/web/src` for any
cacheable response bypassing the `response-cache.ts` choke point. Four
exemptions exist, all content-addressed URLs that never need purging
(`pages/api/og.ts`, `pages/i18n/[file].js.ts`, `pages/icons/[file].svg.ts`,
`middleware.ts`).

**Consequence:** one purge of `<env>:all` invalidates 100% of what this
deployment can serve from the edge.

### 5.3 The purge path that already exists

```
RevalidationService (service-core, needs DB)
  └─ CloudflareRevalidationAdapter.postPurge()      pure HTTP, no DB
       └─ POST {siteUrl}/api/revalidate?secret=…    apps/web/src/pages/api/revalidate.ts
            └─ POST https://api.cloudflare.com/client/v4/zones/{zoneId}/purge_cache
```

The only place holding Cloudflare credentials is
`apps/web/src/pages/api/revalidate.ts` (endpoint at line 63-64, credentials read
at 183-184 straight from `process.env`, deliberately not through the Zod
accessor). It already:

- rejects a body carrying both `tags` and `purgeEverything` (line 108-110);
- refuses to treat an empty/unparseable body as "purge everything" (line 87-99);
- rejects tags whose namespace prefix does not match this deployment (line 135-160);
- caps at `MAX_TAGS_PER_REQUEST = 100`, rejecting rather than truncating (line 72);
- treats Cloudflare's `200 + success:false` envelope as a failure, not a success
  (lines 233-261).

### 5.4 The `purgeEverything` naming trap

Two things share this name with **opposite blast radius**:

| Call | Meaning | Blast radius |
|---|---|---|
| `POST /api/revalidate { purgeEverything: true }` | Cloudflare `purge_everything` | **Whole zone — staging AND production** |
| `RevalidationService.purgeEverything()` | purge tag `<env>:all` | One environment |

`revalidation.service.ts:716-729` documents this; `purgeWholeZone()` (line 839)
is the deliberate escape hatch for the destructive one. Any implementation of
this spec that reaches for the name "purgeEverything" without reading which layer
it is on can flush production from a staging deploy.

**The correct deploy-time call is `{ tags: ["<env>:all"] }`.**

### 5.5 Rate limiting already in place

`revalidation.service.ts` encodes Cloudflare's Free-plan budget of 5 tag-purges
per minute: `PURGE_COALESCE_MS = 50` (line 154) and
`MIN_PURGE_INTERVAL_MS = 12_000` (line 178), with a queue
(`enqueuePurgeGroup`, lines 478-517) rather than naive retry. That budget is
shared with this spec's deploy purge, which is one more request in the same
window — a reason to keep it to exactly one call, and to back off rather than
hammer on 403.

### 5.6 Container shape

`apps/web/Dockerfile` runner stage ends at `CMD ["node", "dist/server/entry.mjs"]`
(Astro Node adapter, `mode: 'standalone'`, `astro.config.mjs:76`). There is no
entrypoint script and no post-deploy hook. `sentry.server.config.ts` exists, so
server-side Sentry reporting is available.

There is no versioned Coolify configuration in the repo — build settings,
healthchecks and any "post-deployment command" live only in the dashboard, the
same asymmetry `infra/cloudflare/README.md:10-11` documents for Cache Rules.

### 5.7 How Coolify actually deploys this app (verified 2026-08-10)

Read from the Coolify API (`GET /api/v1/applications/xv55ojdh2we9snulfsylql66`,
Coolify 4.1.2) and from the stored deployment log of the last real
`hospeda-web-prod` deploy:

```text
Rolling update started.
Container xv55ojdh2we9snulfsylql66-040250619247  Created
Container xv55ojdh2we9snulfsylql66-040250619247  Starting
Container xv55ojdh2we9snulfsylql66-040250619247  Started
New container started.
Removing old containers.
Rolling update completed.
```

Three facts follow, and all three constrain the design:

1. **Coolify performs a rolling update: the new container starts BEFORE the old
   one is removed.** There is a real overlap window in which both containers
   exist and the reverse proxy can route to either.
2. **Nothing gates that window.** `health_check_enabled = False` on this
   application, so Coolify goes straight from "Started" (the process was
   launched) to "Removing old containers" — it never waits for the new container
   to be *ready*, only for it to be *started*.
3. **`post_deployment_command` and `pre_deployment_command` are both `None`** —
   no dashboard hook exists today, confirming §6.1's rejection of that option is
   not merely stylistic.

Also verified, and both feeding §6.3 and §6.6:

- Every Coolify resource runs **exactly one container** — `hospeda-web-prod` and
  `hospeda-web-staging` are single-replica. One deploy is one purge, never a burst.
- All required variables are present on both web resources:
  `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`, `HOSPEDA_REVALIDATION_SECRET`,
  and `HOSPEDA_DEPLOY_ENV` — which reads `prod` on `hospeda-web-prod` and
  `preview` on `hospeda-web-staging`. So the tags this spec purges are literally
  `prod:all` and `preview:all`.

## 6. Proposed design

### 6.1 Decision: purge from the web container as it starts serving

**Owner decision (2026-08-10):** the purge is triggered by the freshly-deployed
web container itself, not by the deploy tooling.

The trigger is "a new build is running and serving", not "somebody ran a
command". That is what makes it cover every deploy path, including the Coolify
dashboard button, and it keeps the whole mechanism inside this repo (G-6).
The Cloudflare credentials are already present in this container and nowhere
else (§5.3), so nothing has to be copied around.

Alternatives considered and rejected:

- **`hops redeploy` + Coolify deployment-status polling.** Rejected: misses the
  dashboard deploy path, which is the documented one (§2.2).
- **Coolify "post-deployment command".** Rejected: perfect timing, but
  dashboard-only and invisible to review — the exact pattern that previously left
  `Cache-Control` dead for months without anyone noticing.

### 6.2 Where the trigger lives

A single module, fired **once per process**, at the earliest point the process is
demonstrably serving. The existing precedent is the memoised
self-check pattern already used by `getCacheTagEnvironment()` and by
`reportInternalBypassSelfCheck` in `src/middleware.ts` — module-level work that
runs once, logs once, and is never repeated per request.

Anchor: **the first request the process serves** (middleware), not bare module
load. It proves the process is up and routable, and it needs no Dockerfile or
build-pipeline change.

**The first request is necessary but NOT sufficient.** §5.7 established that
Coolify overlaps the two containers: the new one starts while the old one is
still running and still reachable by the proxy. A purge fired on the new
container's very first request can therefore be followed by a request routed to
the **old** container, which re-populates the edge with the previous build's HTML
— the purge succeeds, the log says so, and the site stays stale. That failure is
silent and would make this entire spec a no-op.

So the purge fires on a **settle delay** after the first served request: wait a
bounded interval (order of 30-60 s) before issuing it. The delay is chosen so
that:

- it comfortably exceeds the observed "New container started → Removing old
  containers" gap, which is effectively immediate (no health gate);
- it stays a small fraction of the 300 s `s-maxage`, so the staleness this spec
  removes is still removed for essentially the whole window.

The purge must be dispatched **without blocking the request** — the triggering
response is served normally, and the timer runs detached.

An implementation that skips this delay will appear to work in every test (the
Cloudflare call is made, with the right tag) while failing in production for the
only reason that matters. Treat AC-12 as the load-bearing acceptance criterion.

### 6.3 Preconditions (all must hold, else no-op quietly)

The purge is skipped, with a single INFO log and no error, when:

1. `getCacheTagEnvironment()` returns `null` — the namespace is unknown, so there
   is no correct tag to purge and tagging is already disabled anyway;
2. the resolved environment is `dev` or `test` — local development and CI have no
   edge cache in front of them;
3. `CLOUDFLARE_ZONE_ID` or `CLOUDFLARE_API_TOKEN` is unset — the same condition
   under which `/api/revalidate` already declines.

Only `prod` and `preview` with complete credentials proceed. This keeps
`pnpm dev` and the test suite from ever issuing a network call.

### 6.4 The call

One `POST` to Cloudflare's purge endpoint with body `{ tags: ["<env>:all"] }`.

The Cloudflare request construction (endpoint URL, bearer auth, and the
`200 + success:false` envelope check) currently lives inline in
`pages/api/revalidate.ts`. It must be **extracted into one shared module** that
both the endpoint and this deploy purge import — per the repo's Single Source of
Truth rule. Duplicating the envelope check is exactly how one of the two callers
ends up trusting a `200` that means failure.

### 6.5 Failure handling

**Owner decision (2026-08-10):** retry with backoff, then alert loudly, and
always keep serving.

- Retry the purge a small bounded number of times (2-3 attempts) with backoff.
  This is what absorbs the transient 403 from the shared rate-limit budget
  (§5.5) and ordinary network blips.
- Backoff must respect the 12 s spacing that `MIN_PURGE_INTERVAL_MS` derives from,
  rather than retrying immediately into the same 403.
- On final failure: one ERROR log naming the tag and the Cloudflare response, plus
  a Sentry event. Loud enough that somebody finds out (G-4).
- The server keeps serving in every case. The process must never exit non-zero
  over a cache purge (G-5): the failure mode of not purging is today's status
  quo, whereas crashing would be a self-inflicted outage and would loop against
  Coolify's healthcheck.
- On success: one INFO log naming the purged tag, so a deploy's purge is greppable
  in `hops logs web`.

### 6.6 Idempotency and over-purging

Firing more than once is a performance cost (cold cache), never a correctness
problem. Concretely:

- a container restart that is not a deploy will also purge — accepted;
- if the web app ever runs more than one replica, each replica purges once, which
  is a burst and therefore a 403 risk (see OQ-2). With a single replica today
  this is one request.

The module guarantees at most one purge **per process**, regardless of how many
requests race to trigger it.

## 7. Data model / contracts

No database changes. No schema changes. No migrations.

**Env vars — no new ones.** All three already exist in
`packages/config/src/env-registry.hospeda.ts`:

| Var | Registry | Apps | Notes |
|---|---|---|---|
| `CLOUDFLARE_ZONE_ID` | lines 2320-2337 | `['web']` | `required: false`, `requiredScope: 'production'` |
| `CLOUDFLARE_API_TOKEN` | lines 2339-2356 | `['web']` | `secret: true`, `requiredScope: 'production'` |
| `HOSPEDA_DEPLOY_ENV` | lines ~2284-2300 | `api`, `web` | drives the namespace |

This spec adds no variable to the registry, but it **does** make the two
Cloudflare vars load-bearing for a code path that was previously only reachable
from the API. All four are confirmed present on both web resources (§5.7,
OQ-3) — no Coolify change is needed to ship this.

**Cloudflare contract** (unchanged, reused):

```
POST https://api.cloudflare.com/client/v4/zones/{CLOUDFLARE_ZONE_ID}/purge_cache
Authorization: Bearer {CLOUDFLARE_API_TOKEN}
Content-Type: application/json

{ "tags": ["prod:all"] }
```

Success requires **both** a 2xx status and `success: true` in the response
envelope.

## 8. UX / UI behavior

None. This is invisible to users, which is the point: the only observable effect
is that the first request after a deploy returns the new build's HTML instead of
the previous one's.

## 9. Acceptance criteria

- **AC-1** — A deploy of `apps/web` to staging results in exactly one Cloudflare
  purge request carrying `{ tags: ["preview:all"] }`, and zero requests carrying
  `purge_everything`.
- **AC-2** — A deploy to production results in exactly one purge carrying
  `{ tags: ["prod:all"] }`.
- **AC-3** — Deploying staging does not evict production's cache: immediately
  after a staging deploy, a production URL that was `HIT` before is still `HIT`.
- **AC-4** — The purge fires once per process. N concurrent first requests produce
  one Cloudflare call, not N.
- **AC-5** — With `HOSPEDA_DEPLOY_ENV` unset or unresolvable, no purge request is
  issued and the app still serves (fail-closed, consistent with
  `getCacheTagEnvironment()`).
- **AC-6** — In `dev`/`test` environments, and whenever either Cloudflare
  variable is missing, no network call is made. `pnpm dev` and `pnpm test` issue
  zero requests to `api.cloudflare.com`.
- **AC-7** — A purge that fails on the first attempt is retried with backoff; a
  purge that ultimately fails logs at ERROR and reports to Sentry, and the server
  continues serving normally (process exit code unaffected).
- **AC-8** — A Cloudflare response of `200` with `success: false` is treated as a
  failure, not a success — asserted by test.
- **AC-9** — The Cloudflare request construction and envelope check exist in
  exactly one module, imported by both `pages/api/revalidate.ts` and the deploy
  purge. A guard test fails if a second construction of the purge endpoint URL
  appears in `apps/web/src`.
- **AC-10** — No code path introduced by this spec can emit `purge_everything`.
  Asserted by a static guard over the new module.
- **AC-11** — End-to-end verification: deploy a copy change to a W2-2 static page,
  then confirm the first `GET` after the deploy returns `cf-cache-status: MISS`
  and the second returns `HIT`. Must be probed with `GET` — `curl -I` sends HEAD,
  which never matches the Cache Rule and always reports `DYNAMIC`.
- **AC-12** — The purge is issued only after the settle delay, never on the first
  request itself, and the delay is longer than the container overlap window
  (§5.7). Verified two ways: a unit test asserting no Cloudflare call is made
  before the delay elapses, and the AC-11 end-to-end check reading the **new**
  build's copy — not the old one — on the first `MISS`. AC-11 passing while
  AC-12 is unimplemented is exactly the silent failure described in §6.2.

## 10. Risks

- **R-1 — Purging during the container overlap. CONFIRMED REAL, not theoretical.**
  §5.7 verified that Coolify starts the new container before removing the old
  one, with no health gate between the two. A purge landing inside that window
  lets a request served by the OLD container re-populate the edge, and no second
  purge is coming. This is the highest-severity risk in this spec because it
  fails *silently*: every log line and every test reports success. Mitigated by
  the settle delay in §6.2 and asserted by AC-12.
- **R-2 — Rate-limit collision.** The deploy purge spends from the same 5/min
  Cloudflare budget as `RevalidationService`. A deploy landing during a burst of
  entity writes can 403. Mitigated by bounded retry with 12 s-aware backoff
  (§6.5); worst case is a logged failure and today's staleness.
- **R-3 — Reaching for the wrong `purgeEverything`.** §5.4. Mitigated by AC-10's
  static guard and by never routing this path through
  `RevalidationService`/`/api/revalidate`'s `purgeEverything` mode.
- **R-4 — Missing credentials in Coolify.** If `CLOUDFLARE_*` is unset on the web
  resources, §6.3 makes this a silent no-op by design. That is correct behaviour
  but indistinguishable from "working" without checking the logs. Mitigated by
  the explicit INFO/skip log line and by OQ-3.
- **R-5 — Restart amplification.** Any container restart purges. With frequent
  restarts (OOM loop, healthcheck flapping) this could burn the rate-limit
  budget. Low likelihood; visible in logs if it happens.
- **R-6 — Test suite reaching the network.** A misconfigured precondition could
  have CI hitting Cloudflare. Directly covered by AC-6.

## 11. Open questions

All three questions raised when this spec was drafted were resolved against the
live VPS on 2026-08-10, before implementation started. Kept here with their
answers because each one changed the design.

- **OQ-1 — Does Coolify overlap the old and new containers? — RESOLVED: YES.**
  It performs a rolling update (new container Created → Starting → Started →
  "Removing old containers"), and `health_check_enabled = False` means nothing
  gates the gap. See §5.7 for the deployment log. **This inverted the design:**
  the original "purge on first served request" anchor was unsafe on its own, and
  §6.2 now requires a settle delay. Recorded as R-1 and AC-12.
- **OQ-2 — How many replicas per environment? — RESOLVED: one.** Every Coolify
  resource on the VPS runs exactly one container, `hospeda-web-prod` and
  `hospeda-web-staging` included. One deploy is one purge; the burst/403 concern
  in §6.6 does not apply today. It would return if replicas are ever added.
- **OQ-3 — Are the Cloudflare variables set on both web resources? — RESOLVED:
  yes, all of them.** `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`,
  `HOSPEDA_REVALIDATION_SECRET` are present on `hospeda-web-prod` and
  `hospeda-web-staging`, and `HOSPEDA_DEPLOY_ENV` reads `prod` and `preview`
  respectively. So this does not ship as a silent no-op, and the tags are
  `prod:all` / `preview:all`. (The prior env-registry note about missing
  Cloudflare vars on the web resources is stale.)

### 11.1 Findings outside this spec's scope

Two things surfaced while resolving the above. Neither blocks this spec; both
deserve their own Linear issue.

- **`health_check_enabled = False` on `hospeda-web-prod`.** Coolify removes the
  old container once the new one has *started*, not once it is *ready*. Astro
  Node standalone needs a moment to bind its port, so every deploy plausibly has
  a brief window serving 502s. Not measured here — worth measuring, and worth
  enabling the healthcheck (`health_check_path` is already configured as `GET /`,
  just disabled).
- **`COOLIFY_API_TOKEN` is stored unquoted** in `scripts/server-tools/.env.local`
  on the VPS and contains a character the shell interprets, so `source`-ing that
  file both breaks and echoes part of the value. Quote it.

## 12. Implementation notes

- **Read `revalidation.service.ts:716-729` and `840-869` before writing any code.**
  They are the primary defence against §5.4's naming trap.
- The shared Cloudflare-purge module belongs next to the existing cache code in
  `apps/web/src/lib/cache/`, alongside `response-cache.ts` and
  `cache-tag-environment.ts`.
- `buildCatchAllTag` is currently private to `response-cache.ts:75`. The deploy
  purge needs the same tag; export it from there (or move it beside
  `getCacheTagEnvironment`) rather than rebuilding the string, so there is one
  definition of what "everything this deployment cached" means.
- Follow the fail-closed precedent of `cache-tag-environment.ts`: read
  `process.env` directly rather than through `validateWebEnv()`, so an unrelated
  env problem cannot disable this subsystem — the same reasoning documented at
  `cache-tag-environment.ts:39-51`.
- Logging uses `console` at this layer, matching `getCacheTagEnvironment()` and
  `reportInternalBypassSelfCheck`, which also run outside request context.
- Tests must not reach the network: stub `fetch` and assert on the request that
  would have been made (AC-1/AC-2/AC-8), and assert *absence* of a call for the
  skip conditions (AC-6).
- This spec unblocks **HOS-426** (raising TTLs). Note that in the Linear issue
  when this closes.
- Related but out of scope: adding real deployment-status polling to
  `CoolifyClient` (`scripts/server-tools/src/lib/coolify.ts`) would make
  `hops redeploy` stop being fire-and-forget. Worth its own issue (NG-2).

## 13. Linear

Canonical tracking:
HOS-427
