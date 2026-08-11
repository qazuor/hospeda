---
title: Per-page-class edge cache TTLs
linear: HOS-426
statusSource: linear
created: 2026-08-10
type: feature
areas:
  - web
  - devops
---

# Per-page-class edge cache TTLs

## 1. Summary

Give `applyCacheHeaders` a per-page-class TTL instead of the single site-wide
constant it uses today, then raise the values per owner decision D-15: static
copy pages to 24 h, catalog listings to 1 h, detail pages to 1 h.

The decision is already made. This spec is about the mechanism (an API change,
not a number change) and the sequence (one class is blocked by an open bug, the
others are not).

## 2. Problem

Every cacheable HTML response in `apps/web` currently ships the same
`s-maxage=300, stale-while-revalidate=600`, regardless of how often the page's
content can actually change. That is wrong in both directions:

- **Too short for copy-only pages.** `nosotros`, the three legal pages,
  `beneficios`, `funcionalidades`, the four `colaborar/*`, `contacto` and
  `preguntas-frecuentes` render entirely from `@repo/i18n` and page source. They
  cannot change except by deploying. Expiring them every 5 minutes buys nothing
  and costs an origin render per edge node per 5 minutes.
- **Uniform for pages with very different write rates.** A destination detail
  page and an events listing get the same freshness budget as a legal page.

There is no dial to turn. `applyCacheHeaders` takes no TTL argument and reads
`LISTING_CACHEABLE_CONTROL` directly, so "different TTLs per class" requires
changing the function's contract and every call site's declaration.

## 3. Goals

- **G-1** — `applyCacheHeaders` accepts the page's cache class and derives the
  `Cache-Control` from it. No call site writes a raw TTL number.
- **G-2** — Every one of the ~40 call sites under `src/pages` declares a class
  explicitly. No implicit default that silently keeps a page at the old value.
- **G-3** — Apply D-15's values: static 24 h, catalog 1 h, detail 1 h.
- **G-4** — A static guard fails when a new cacheable page ships without a class,
  in the same spirit as the existing `cacheable-responses-carry-catch-all`
  guard.
- **G-5** — Fold the pricing pages' own pair of constants
  (`PRICING_CACHE_MAX_AGE_SECONDS` / `PRICING_CACHE_SWR_SECONDS`) into the same
  vocabulary, so there is one place where a TTL is decided.
- **G-6** — Every comment that states a TTL as a fact is updated with the code.
  There are ~37 of them and they are load-bearing documentation; the repo's
  comment-honesty guard (HOS-369 W2-7) exists precisely for this failure mode.

## 4. Non-goals

- **NG-1** — Fixing HOS-424 (the entity-tag purge gap). This spec depends on it
  for one class; it does not implement it.
- **NG-2** — Changing which pages are cacheable, or any `cacheable:` predicate.
  Class assignment is orthogonal to the cacheability decision.
- **NG-3** — Cloudflare Cache Rule changes. The origin header is what changes.
- **NG-4** — `apps/web/src/pages/api/og.ts` (already `s-maxage=604800`, an
  immutable-by-URL image) and the hashed `_astro/*` assets. Out of scope.
- **NG-5** — Enabling the Coolify healthcheck. It is a real dependency (§10 R-1)
  but it is a dashboard action, not code in this repo.

## 5. Current baseline

### 5.1 The single constant

`apps/web/src/lib/cache/listing-cache.ts`:

```ts
export const LISTING_CACHE_S_MAXAGE_SECONDS = 300;
export const LISTING_CACHE_SWR_SECONDS = 600;
export const LISTING_CACHEABLE_CONTROL = `public, s-maxage=${…}, stale-while-revalidate=${…}`;
export const LISTING_PRIVATE_CONTROL = 'private, no-cache';
```

`applyCacheHeaders` (`apps/web/src/lib/cache/response-cache.ts:230`) takes
`{ locals, headers, cacheable, tags }` and writes either
`LISTING_CACHEABLE_CONTROL` or `LISTING_PRIVATE_CONTROL`. It demotes to private
when `cacheable` is false OR when zero tags survive namespacing — an untagged
response is never cacheable, by construction.

`buildStaticCacheHeaders` (same file, used by endpoints that build their own
`Response`) DOES take a `cacheControl` string. It is the one existing caller
that already chooses its own value.

### 5.2 The call sites, by proposed class

40 pages call `applyCacheHeaders`. Grouped by the tag they declare, which is the
honest signal of what can change them:

| Class | Count | Pages | Tag today |
|---|---|---|---|
| `static` | 12 | `nosotros`, `legal/{cookies,terminos,privacidad}`, `beneficios`, `funcionalidades`, `colaborar/{index,editores,fotos,reportar}`, `contacto`, `preguntas-frecuentes` | `site-config` |
| `home` | 1 | `[lang]/index.astro` | `home` |
| `catalog` | 16 | `alojamientos/{index,mapa,tipo/[type]}`, `destinos/{index,mapa}`, `destinos/[slug]/{alojamientos,eventos}`, `eventos/{index,categoria/[category]}`, `publicaciones/{index,categoria/[category],etiqueta/[tag]}`, `experiencias/index`, `gastronomia/index`, `autores/[slug]` | `CACHE_TAG_COLLECTIONS.*` |
| `detail` | 11 | `alojamientos/[slug]`, `eventos/{[slug],en/[slug]}`, `publicaciones/[slug]`, `destinos/[...path]`, `destinos/atraccion/[slug]`, `destinos/lugar/[slug]`, `experiencias/[slug]`, `gastronomia/[slug]`, `partners/[slug]` | entity tags + collection fallback |

Counts are indicative and MUST be re-derived from the code during
implementation, not copied from this table — `autores/[slug]` is classed
`catalog` because it lists posts and carries the post collection tag, and
`alojamientos/{comodidades,caracteristicas}/[slug]` are deliberately NOT
cacheable today (their own file headers say so) and stay that way per NG-2.

### 5.3 The pricing pages' separate pair

`apps/web/src/lib/billing/fetch-plans.ts` declares
`PRICING_CACHE_MAX_AGE_SECONDS = 300` and `PRICING_CACHE_SWR_SECONDS = 60`,
interpolated inline by the four `suscriptores/*` pages rather than going through
`applyCacheHeaders`. Note the SWR is 60 s here versus 600 s everywhere else —
the two pairs were written independently.

### 5.4 What purges what, today

- **`site-config`** — purged by exactly ONE writer: a successful
  `seo.defaults` upsert in `platform-settings.service.ts`. It is unrelated to
  the copy on those 12 pages. In practice their only real invalidation is the
  deploy purge below.
- **Collection tags** — purged correctly on a content write. Verified on staging
  (HOS-424's own evidence table: the post list WAS evicted).
- **Entity tags** — NOT purged on a content write. This is HOS-424, open, In
  Progress, no commits yet.
- **Deploy** — HOS-427 shipped (PR #2739, merged): the web container purges the
  namespace catch-all tag once per deploy, 45 s after it serves its first
  request. This closes prerequisite 1 as stated in the Linear issue.

## 6. Proposed design

### 6.1 A cache-class vocabulary

Add a closed set of page classes, each mapping to an `s-maxage` / `swr` pair,
and derive the header from the class:

```ts
export const CACHE_CLASSES = {
    static:  { sMaxAge: 86_400, swr: 172_800 },
    catalog: { sMaxAge:  3_600, swr:   7_200 },
    detail:  { sMaxAge:  3_600, swr:   7_200 },
    home:    { sMaxAge:    ???, swr:     ??? },  // OQ-2
    pricing: { sMaxAge:    ???, swr:     ??? }   // OQ-3
} as const;
```

SWR values above are `2 × s-maxage`, preserving today's ratio (300/600). That
ratio is a proposal, not a decision — see OQ-4.

`applyCacheHeaders` gains a required `cacheClass` parameter and resolves the
control string from it. `LISTING_CACHEABLE_CONTROL` either becomes
`resolveCacheControl({ cacheClass })` or stays as the `catalog` alias for
`buildStaticCacheHeaders`'s existing callers.

**Why a named class and not a raw `ttlSeconds` number**: a number at 40 call
sites is 40 independent opportunities to drift, and reviewing a diff that
changes `3600` to `7200` on one page tells you nothing about whether that page
is like its neighbours. A class makes the intent reviewable and makes a global
re-tune one edit.

### 6.2 Required, not defaulted

`cacheClass` must be **required**. A default would let a new cacheable page ship
silently at whatever the default is, which is the exact failure mode this spec
exists to remove. TypeScript flags every existing call site the moment the
parameter lands — the compiler enumerates the work.

Note the known blind spots of "the compiler enumerates the work" (see the
repo's own prior finding): raw SQL in e2e tests, local interfaces mirroring the
API, and comments are invisible to it. G-6 covers the comments explicitly.

### 6.3 Sequencing — the classes are not equally blocked

The Linear issue treats HOS-424 as blocking the whole raise. It does not:

- **`catalog` is NOT blocked.** Listings carry a COLLECTION tag, and collection
  purges demonstrably work (HOS-424's own evidence shows the post list being
  evicted in the same write that failed to evict the detail pages).
- **`static` is NOT blocked.** HOS-427 landed; the deploy purge is its
  invalidation path, and nothing else changes those pages.
- **`detail` IS blocked.** Its invalidation is the entity tag, which is exactly
  what HOS-424 reports as broken. Raising it to 3 600 s multiplies a live defect
  by 12.

So this can ship in two slices: `static` + `catalog` + `home` first, `detail`
once HOS-424 closes. Whether to actually split is OQ-1.

### 6.4 The static guard

Extend or mirror `test/static-guards/cacheable-responses-carry-catch-all.test.ts`
so that every `applyCacheHeaders` call under `src/pages` passes a `cacheClass`
drawn from the vocabulary. Per the repo's guard convention, the assertion
message must claim exactly what the predicate proves — "this call passes a
cacheClass literal", not "this page has the right TTL", which a source scan
cannot know.

## 7. Data model / contracts

No DB changes, no migrations, no env vars, no API changes.

Changed TypeScript contract:

```ts
// before
applyCacheHeaders({ locals, headers, cacheable, tags })

// after
applyCacheHeaders({ locals, headers, cacheable, tags, cacheClass })
```

`AppliedCacheHeaders` keeps its shape (`cacheControl` already carries the
resolved value, so tests asserting on it keep working with new expectations).

## 8. UX / UI behavior

None. No user-visible change on a cache hit; the only observable effect is
staleness windows and origin load.

## 9. Acceptance criteria

- **AC-1** — `applyCacheHeaders` requires `cacheClass`; omitting it is a
  compile error. Verified by the typecheck passing only after all call sites are
  updated.
- **AC-2** — Each of the ~40 `src/pages` call sites declares a class matching
  the §5.2 table; the classification is re-derived from the code, not copied.
- **AC-3** — A cacheable static page responds with `s-maxage=86400`, a catalog
  page with `s-maxage=3600`, measured on a real response, not asserted from
  source.
- **AC-4** — The `detail` class ships only after HOS-424 is closed (or, if
  OQ-1 says otherwise, ships at 300 s and is raised in a follow-up).
- **AC-5** — The pricing pages resolve their TTL from the same vocabulary; the
  two orphan constants in `fetch-plans.ts` are gone.
- **AC-6** — A static guard fails when a cacheable page under `src/pages` calls
  `applyCacheHeaders` without a `cacheClass`. Mutation-tested: introduce the
  omission and confirm the guard goes red.
- **AC-7** — No comment in `apps/web` states a TTL that the code no longer
  emits. Includes the file headers of `listing-cache.ts`, `purge-on-deploy.ts`
  and `static-pages-cache.test.ts`, all of which argue from the 300 s value
  today.
- **AC-8** — A deploy purges the edge within a bounded window that is a small
  fraction of the new static TTL. Not automatically satisfied by HOS-427 — see
  R-1.

## 10. Risks

- **R-1 (highest, and not in the Linear issue)** — **The deploy purge fires on
  the container's first request, and nothing guarantees when that is.**
  `purge-on-deploy.ts` says so in its own header: the clock starts when the
  process serves its FIRST REQUEST, so real latency is
  `(time until something reaches origin) + 45 s`, and the first term is
  unbounded. On a fully cached site, a 03:00 deploy may not purge until traffic
  wakes the origin. At `s-maxage=300` that self-corrects within minutes. At
  86 400 s it does not — a corrected legal text could sit wrong for hours. The
  file names the fix: Coolify's healthcheck is **already configured and
  currently disabled**; enabling it makes the container receive a probe
  immediately. `apps/web/src/pages/api/health.ts` exists (PR #2737, merged), so
  the endpoint is ready and only the dashboard toggle is missing. **Treat
  enabling it as a hard prerequisite for the `static` class specifically.**
- **R-2** — Cloudflare Free allows 5 tag-purges per minute, and the deploy purge
  spends from the same budget as `RevalidationService`. Longer TTLs raise the
  cost of a missed purge but do not change the rate limit. No mitigation
  proposed here; noted so nobody discovers it during an incident.
- **R-3** — A wrong class on one page is invisible: the page just serves stale
  or re-renders too often, and no test catches a plausible-but-wrong
  classification. The guard proves a class is present, not that it is correct.
  Mitigation: the §5.2 table is reviewed against the code during
  implementation, and the class is derived from the page's tag.
- **R-4** — `stale-while-revalidate` at 2× a 24 h TTL means a page can be served
  up to 72 h after it was generated in the worst case. That may be beyond what
  D-15 intended when it said "24 h". OQ-4.

## 11. Open questions

- **OQ-1** — Ship in two slices (`static`+`catalog`+`home` now, `detail` after
  HOS-424), or hold everything until HOS-424 closes? **Recommendation: two
  slices.** The mechanism lands and gets exercised on the classes that are
  provably safe, and `detail` becomes a one-line change afterwards.
- **OQ-2** — What TTL for the **home**? D-15 does not mention it. It is neither
  copy-only nor a catalog listing: it aggregates featured content across
  entities and carries only the `home` tag. **Recommendation: treat it as
  `catalog` (1 h)** — it changes when content changes, and its tag is purged by
  the platform-settings writer.
- **OQ-3** — What TTL for **pricing**? Today 300 s / 60 s. Plan changes are
  rare, but a wrong price is worse than stale copy. **Recommendation: 1 h with
  the `pricing` tag as the purge path**, matching catalog, only if a plan write
  actually purges `CACHE_TAG_PRICING` — to be verified, not assumed.
- **OQ-4** — Does SWR scale with the TTL (2×, giving 48 h on statics) or get
  capped? **Recommendation: cap SWR at 1 h for every class.** Its purpose is
  absorbing the revalidation round-trip, not extending the staleness budget, and
  a 48 h stale-serve window undercuts the deploy purge.
- **OQ-5** — Is enabling the Coolify healthcheck (R-1) a blocker for this spec,
  or does it get its own issue? **Recommendation: its own issue, blocking the
  `static` slice only.** It is a dashboard action with its own verification and
  does not belong in a code PR.

## 12. Implementation notes

- `purge-on-deploy.ts`'s header already anticipates this spec by name. Read it
  before touching TTLs — its "WHAT THE DELAY DOES NOT GUARANTEE" section is R-1
  written by the person who found it.
- `test/pages/static-pages-cache.test.ts` argues explicitly *against* a longer
  TTL for the static pages in its file header, on the grounds that nothing
  purges on deploy. HOS-427 invalidated that premise. Rewrite the argument;
  do not just flip the numbers underneath it.
- The ~37 `s-maxage=300` occurrences in pages are comments. Fixing them is
  mechanical but not optional (G-6, AC-7).
- Measure on real responses. A source-based assertion cannot tell a declared TTL
  from a rendered one — the repo has been bitten by exactly this.

## 13. Linear

Canonical tracking:
HOS-426

Blocked by: HOS-424 (`detail` class only).
Prerequisite closed: HOS-427 (deploy purge) — PR #2739.
Parent decision: HOS-369 §11.2 D-15.
