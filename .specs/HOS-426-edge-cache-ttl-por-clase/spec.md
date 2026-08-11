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
- **Entity tags** — were NOT purged on a content write. This was HOS-424, which
  **merged into `staging` as PR #2746 on 2026-08-10**, while this spec was being
  written: the fix forwards the entity id on post, event and destination
  revalidation, and makes the purge adapter read the endpoint's verdict rather
  than the status line. The issue sits in **In Review pending a staging smoke**
  (edit a post, confirm both tags and a non-NULL `entity_id` in
  `revalidation_log`) — so the code is in, the field verification is not. §6.3
  and the delivery plan treat `detail` as gated on that smoke, not on the merge.
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
- **`detail` IS gated.** Its invalidation is the entity tag, which is exactly
  what HOS-424 reported as broken. Raising it to 3 600 s before that is fixed
  multiplies a live defect by 12.

So this ships in slices: `static` + `catalog` + `home` + `pricing` first,
`detail` after. HOS-424's fix merged mid-spec (§5.4), which moves `detail`'s
gate from "waiting on a fix" to "waiting on the smoke that proves the fix" —
a much shorter wait, but not the same thing as done. The distinction matters
here more than usual: HOS-424 was found precisely because a purge that looked
correct in code was not evicting anything in the field, so a code-only
confirmation is the kind of evidence that already failed once on this exact
mechanism.

### 6.4 Folding pricing in closes a live fail-open

The four `suscriptores/*` pages were outside `applyCacheHeaders`: they set
`Cache-Control` with `Astro.response.headers.set(...)` and called
`declareCacheTags` as a **separate statement**. Those two statements can
disagree. `declareCacheTags` returns `tagCount: 0` when the deployment namespace
cannot be resolved, and the header assignment neither knows nor cares — the
result is a cacheable response carrying no purge tag, which is content nothing
can evict for the full TTL, with nothing reporting it.

That is precisely the failure `applyCacheHeaders` was built to make
unrepresentable, and its file header says so: marking a response cacheable and
tagging it for purge are the same decision, so they are the same call. Migrating
these four pages is therefore not just TTL bookkeeping (G-5) — it removes the
last four responses in the app that could go out cacheable-but-unpurgeable.

Two behaviour deltas come with it, both intended:

- The header gains `public`, which the hand-written version omitted. Safe here:
  none of the four reads `Astro.locals.user`, and `suscriptores` is not in
  `SESSION_OPTIONAL_SEGMENTS`, so the middleware never resolves a session on
  these routes. They are session-blind by construction, not by discipline.
- When the namespace cannot resolve, these pages now demote to
  `private, no-cache` instead of emitting an unpurgeable cacheable response.

Their SWR stays at 60 s rather than snapping to the site's 600 s, so PR A
changes no TTL. Reconciling that outlier happens in PR B, deliberately, where a
TTL change is what the diff is about.

### 6.5 The static guard

The obvious guard — "every call passes a `cacheClass` from the vocabulary" —
turned out to be worth nothing. `cacheClass` is required and typed as
`CacheClass`, and `astro check` runs in CI, so both halves of that claim are
compile errors already. A test asserting them would only confirm what the
compiler proves.

What no type can express is whether the declared class matches the page's
invalidation mechanism, and the honest signal for that is the tag. So the guard
(`test/static-guards/cache-class-matches-tag.test.ts`) asserts a **biconditional
over the three classes that map 1:1 to a distinctive tag**: `site-config` ⟺
`static`, `home` ⟺ `home`, `pricing` ⟺ `pricing`, in both directions.

`catalog` and `detail` are deliberately excluded. A listing scoped to one entity
(`destinos/[slug]/eventos/`) legitimately carries both a collection tag and that
entity's tags, so no source-level rule separates it from a detail page without
lying — and per the repo's guard convention, the message may not claim more than
the predicate proves. Telling those two apart stays a reviewer's judgment against
the §5.2 table.

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
- **AC-4** — The `detail` class is raised only after HOS-424's staging smoke
  passes — an edited post's own detail page observably evicted at the edge, not
  merely a merged fix. Until then it ships at today's value.
- **AC-5** — The pricing pages resolve their TTL from the same vocabulary; the
  two orphan constants in `fetch-plans.ts` are gone.
- **AC-6** — A static guard fails when a page's declared class contradicts its
  tag, in either direction, for the three classes where that is decidable
  (§6.5). Mutation-tested: flip one page's class and confirm the guard goes red.
  "Passes a valid `cacheClass` at all" is NOT an acceptance criterion — the
  compiler already enforces it, and a test restating it proves nothing.
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

All five were resolved by the owner on 2026-08-10, delegating to the
recommendations as written. Recorded here rather than deleted, because the
reasoning is what a future reader needs.

- ~~**OQ-1** — Ship in two slices, or hold everything until HOS-424 closes?~~
  **RESOLVED → two slices.** `static` + `catalog` + `home` + `pricing` first;
  `detail` once HOS-424 closes. The mechanism lands and gets exercised on the
  classes that are provably safe, and `detail` becomes a one-line change.
- ~~**OQ-2** — What TTL for the home?~~ **RESOLVED → treat it as `catalog`
  (1 h).** It changes when content changes, and its tag has a live purger.
- ~~**OQ-3** — What TTL for pricing?~~ **RESOLVED → 1 h.** The purge chain was
  verified rather than assumed: `plan.service.ts:81` purges `CACHE_TAG_PRICING`
  on a plan write, and the four pages declare that tag. See §6.4 for the
  fail-open this uncovered on the way.
- ~~**OQ-4** — Does SWR scale with the TTL, or get capped?~~ **RESOLVED → cap
  SWR at 1 h for every class.** Its purpose is absorbing the revalidation
  round-trip, not extending the staleness budget; a 48 h stale-serve window
  would undercut the deploy purge that makes the 24 h static TTL defensible.
- ~~**OQ-5** — Is the Coolify healthcheck a blocker, or its own issue?~~
  **RESOLVED → its own issue: HOS-428**, blocking the `static` class only. It is
  a dashboard action with its own verification and does not belong in a code PR.

### 11.1 Resulting budgets

| Class | `s-maxage` | `swr` | Ships in | Gated on |
|---|---|---|---|---|
| `static` | 86 400 | 3 600 | slice 2 | HOS-428 (healthcheck) |
| `catalog` | 3 600 | 3 600 | slice 2 | — |
| `home` | 3 600 | 3 600 | slice 2 | — |
| `pricing` | 3 600 | 3 600 | slice 2 | — |
| `detail` | 3 600 | 3 600 | slice 3 | HOS-424's staging smoke |

## 11.2 Delivery: three PRs, not one

A change that touches the cache headers of the whole public site should not mix
"refactor an API across 40 files" with "change what the edge serves" in one
reviewable unit. Split:

- **PR A — the mechanism, at today's behaviour.** Introduce the class
  vocabulary with EVERY class resolving to the current value, add the required
  parameter, classify all call sites, fold pricing in, add the guard, fix the
  comments. Large diff, zero response changes. If something here is wrong, it is
  wrong in a way the typecheck or the guard catches, not in production.
- **PR B — the values.** Edit `cache-classes.ts` and the tests that pin the
  numbers. Small diff, real behaviour change, reviewable on its own. Everything
  except `detail`.
- **PR C — `detail`.** One budget, after HOS-424's staging smoke passes.

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

Blocked by: HOS-428 (Coolify healthcheck) for the `static` class; HOS-424's
staging smoke for the `detail` class.
Prerequisites merged: HOS-427 (deploy purge) — PR #2739; HOS-424 (entity-tag
purge) — PR #2746, smoke pending.
Parent decision: HOS-369 §11.2 D-15.
