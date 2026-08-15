# Redirect Rules

Mirror of the Redirect Rules (Single Redirects) live in the zone
`hospeda.com.ar`. See [`../README.md`](../README.md) for why these are
documented rather than applied from code, and for the shared-zone constraint
every rule must respect.

Dashboard path: **hospeda.com.ar → Rules → Redirect Rules**.

Current state: **2 active rules** — the staging rule below (HOS-369 W1-4) and
its production twin, activated 2026-08-12 (see [Production twin](#production-twin)
at the end).

---

## `HOS-369 W1-4 - staging root to default locale`

- **Rule id**: `076a40a5214d4249aa324e24d5452b19`
- **Order**: 1 · **Status**: active
- **Created**: 2026-08-04 (HOS-369 W1-4)

### Expression

```
(http.host eq "staging.hospeda.com.ar" and http.request.uri.path eq "/")
```

### Settings

| Setting | Value |
|---|---|
| Target type | Static |
| Target URL | `https://staging.hospeda.com.ar/es/` |
| Status code | 301 |
| Preserve query string | **on** |

Serves the root redirect at the edge instead of paying an origin round-trip for
it. Satisfies AC-7 for staging.

**Preserving the query string is a deliberate divergence from the origin** —
see the note at the end of this file.

**Matched on `http.request.uri.path`, not as a wildcard pattern**, and that is
not a style choice. This rule was first written as a wildcard
(`https://staging.hospeda.com.ar/`) and was born broken: Cloudflare matches
wildcard patterns against the **full URI, query string included**, so
`/?utm_source=x` did not match and fell through to the origin. Custom filter
expressions against `http.request.uri.path` ignore the query string, which is
what this rule needs.

---

## What is deliberately NOT here

### The generic trailing-slash redirect stays at the origin

W1-4 asked for it to move to the edge; declined after looking at what that
would take.

`middleware.ts` enforces the trailing slash at Step 3 — *after* Step 1 has
already skipped `/_astro/`, `/_server-islands/`, `/api/`, `/favicon`, images,
fonts, `.txt`, `.xml` and `/_image`. That exclusion list lives in
`apps/web/src/lib/routes.ts`. Moving the redirect to the edge means
transcribing that list into a Cloudflare expression, where it has no tests and
nothing links it back to the source it was copied from. When the two drift, the
edge appends a slash to `/robots.txt` and breaks it silently.

That is the same failure shape as `entity-path-mapper.ts` — a routing table
maintained by hand in a second place, which had already drifted by the time
HOS-369 deleted it. Re-introducing the pattern inside Cloudflare buys roughly
90 ms per redirect. Not worth it.

### `/{locale}/blog` → `/{locale}/publicaciones` stays at the origin — built, then removed

Two rules for this were **built, verified, and then deliberately deleted on the
same day**. Recorded here so nobody rebuilds them.

They worked. The origin runs trailing-slash (Step 3) *before* the alias
(Step 3.2), so `/es/blog` costs two origin round-trips; the edge rules collapsed
that to one, measured at **1051 ms → 369 ms**.

The problem was the denominator. `/blog` is not a legacy URL: the blog has
always lived at `/publicaciones/`, and the alias exists only because
[BETA-162](https://linear.app/hospeda-beta/issue/BETA-162) (priority **Low**,
"impacto: menor") found that `/es/blog` 404'd — an *obvious* URL a user or
crawler might guess. Nothing ever linked to it. No backlinks, no bookmarks, no
migration, so the traffic is near zero by construction.

Two permanently-maintained Cloudflare rules, with dynamic `concat`/`substring`
target expressions, to save 680 ms on a URL nobody requests is a bad trade. Less
config surface beats a latency win with no volume behind it. The origin's own
301 still handles the alias correctly, in two hops, as it has since PR #2303.

### `/{locale}/mi-cuenta/messages*` → `/consultas*` stays at the origin

Same double-hop shape, but a protected, never-cached, low-traffic route reached
from old bookmarks. The latency win does not justify a rule.

---

## Verifying

An edge-served redirect has **no `cf-cache-status` header** and an **absolute**
`Location`; an origin-served one has `cf-cache-status: DYNAMIC` and a relative
`Location`. That absence is the signal — note AC-7 in the spec states the
opposite ("`cf-cache-status` present on the 301"), which does not match how
Cloudflare actually behaves: Redirect Rules answer before the cache layer.

```bash
curl -sSI https://staging.hospeda.com.ar/ | grep -iE '^(location|cf-cache-status)'
# location: https://staging.hospeda.com.ar/es/   <- absolute, no cf-cache-status = edge
```

**Rules take a few seconds to propagate**, both on create and on delete. Testing
immediately after deploying shows the previous behavior. Re-test after ~10 s
before concluding a rule does or does not work — this produced one false
"the rule is not firing" and one false "the deletion did not take" in a single
session.

---

## Note: the origin drops the query string on locale redirects

Found while building this rule. `middleware.ts` Step 4 builds its redirect
through `buildLocaleRedirect({ restOfPath })`, which takes only the path —
unlike Steps 3, 3.1 and 3.2, which all append `context.url.search`. So the
origin answers `https://hospeda.com.ar/?utm_source=newsletter` with a bare
`/es/`, and the campaign parameters are gone before any analytics sees them.

The rule above preserves the query string, so **staging's root redirect no
longer has this bug and production still does**.

> **Update 2026-08-12** — the production *root* half of this no longer
> reproduces: measured before the production twin existed, the origin answered
> `/?utm_source=test` with a relative `location: /es/?utm_source=test`. See
> [Production twin](#production-twin). The rest of this note stands until
> somebody re-measures the other locale-less paths.

Every other locale-less path
(`/alojamientos/?x=1`, …) is still affected on both. Fixing it properly means
threading `search` through `buildLocaleRedirect` at the origin, which is outside
W1-4's scope — tracked separately.

---

## Production twin

`HOS-369 W1-4 - prod root to default locale`, order 2, active since
2026-08-12.

### Expression

```
(http.host eq "hospeda.com.ar" and http.request.uri.path eq "/")
```

### Settings

| Setting | Value |
|---|---|
| Target type | Static |
| Target URL | `https://hospeda.com.ar/es/` |
| Status code | 301 |
| Preserve query string | **on** |

**The target URL is the one thing a duplicate does not fix for you.** Cloudflare's
*Duplicate rule* copies the target verbatim, so the new rule arrives pointing at
`https://staging.hospeda.com.ar/es/`. Deployed unedited, every visitor landing on
the production root would have been 301'd onto staging. Changing the host in the
*expression* is not enough — the target is a separate field, and nothing in the
UI links the two.

### Verified after activation (2026-08-12)

```bash
curl -sS -o /dev/null -D - https://hospeda.com.ar/
# location: https://hospeda.com.ar/es/     (served by cloudflare, no origin hop)

curl -sS -o /dev/null -D - 'https://hospeda.com.ar/?utm_source=smoke&utm_medium=test'
# location: https://hospeda.com.ar/es/?utm_source=smoke&utm_medium=test

curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/
# location: https://staging.hospeda.com.ar/es/     (unchanged)
```

Note the edge answers an **absolute** URL where the origin answered a relative
`/es/`. That is inherent to a static redirect rule, not a regression.

One prior expectation did **not** reproduce: the "production loses the query
string on the locale redirect, breaking UTMs" note. Measured immediately before
this rule was added, the production origin already preserved it
(`location: /es/?utm_source=test`). Whatever caused that is gone; the rule now
makes it moot either way.
