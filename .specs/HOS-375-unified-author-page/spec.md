---
title: Unified author page — /autores/<slug>/ with posts + events
linear: HOS-375
statusSource: linear
created: 2026-08-02
type: feature
areas:
  - web
  - api
  - content
---

# Unified author page — /autores/<slug>/ with posts + events

## 1. Summary

Move the author profile page out of `/publicaciones/autor/<slug>/` into a
top-level `/autores/<slug>/` route, and make it show **both** the author's
posts and events instead of posts only. Enrich the profile (avatar, longer
bio, social links) and make the page indexable so an editor's work is
visibly recognized in one place, regardless of whether they published a
note or an event.

## 2. Problem

The author page exists today at
`apps/web/src/pages/[lang]/publicaciones/autor/[slug]/index.astro`. It shows
avatar, bio, and a paginated grid of the author's **posts only**, because it
lives under the `/publicaciones/` section. `events.authorId` exists (with its
own index, and a working public endpoint — see §5) but nothing surfaces it on
this page.

This matters because the author page is the only real reward an editor gets
for their work (HOS-374 lets an editor load posts and events from the web
without panel access). If loading an event — the more tedious of the two — is
never reflected on their profile, the reward is incomplete exactly where the
editor put in the most effort.

## 3. Goals

- G-1: Serve the author profile at `/{lang}/autores/<slug>/`, outside
  `/publicaciones/`.
- G-2: List the author's posts and events together on that page.
- G-3: Enrich the profile: avatar, longer bio, social links (when available).
- G-4: Preserve SEO equity from the old URL via a permanent redirect,
  including its paginated form.
- G-5: Decide and document whether the page is indexable, and whether it
  belongs in the sitemap.

## 4. Non-goals

- NG-1: Changing who can be a post/event author, or the EDITOR role's
  permissions (HOS-374 territory).
- NG-2: A dedicated editor dashboard or self-service profile-editing UI
  beyond what already exists in account settings.
- NG-3: Building an "author directory" / index listing every author.

## 5. Current baseline

### 5.1 The existing page

`apps/web/src/pages/[lang]/publicaciones/autor/[slug]/index.astro` (146
lines) is SSR (no ISR — "user profile may change", per its own file doc),
rendered with `noindex={true}` on `ListingLayout` **today** — despite the
Linear issue text implying "today's page is indexable," the code confirms
the current author page is `noindex`. It is NOT present in the sitemap
either (`apps/web/src/pages/sitemap-dynamic.xml.ts` only emits
`/publicaciones/{slug}/` for post detail pages, not author pages).

Flow:

1. Reads `slug` from `Astro.params`, 404s if missing.
2. Reads `?page=` from the query string (rewritten by the sibling
   `page/[page].astro`, default `1`, page size `9`).
3. `usersApi.getBySlug({ slug })` → `GET /api/v1/public/users/by-slug/{slug}`
   (404 if not found).
4. `postsApi.list({ authorId: author.id, page, pageSize })` in parallel with
   nothing else (no waterfall against step 3, since it needs `author.id`
   from step 3 first — actually it's sequential, not parallel, contrary to
   the file's own comment: `author.id` is required before the posts call can
   run).
5. Renders profile card (avatar, name, bio, post count) + `ArticleCard` grid
   - `Pagination` (baseUrl built via `buildUrl({ locale, path:
   'publicaciones/autor/${slug}' })`) + `EmptyState` fallback.

`page/[page].astro` (23 lines): validates the page param is a positive
integer (404 otherwise), 301-redirects `/page/1/` to the canonical
(no-suffix) URL, and `Astro.rewrite`s `/page/N/` to the parent listing with
`?page=N`.

### 5.2 What fields the user profile exposes today

`usersApi.getBySlug` (`apps/web/src/lib/api/endpoints.ts:1201-1230`) types
its response as `UserAuthorPublic`: `id`, `displayName`, `slug`, `avatar`,
`bio` — nothing else.

The backing route, `apps/api/src/routes/user/public/getBySlug.ts`
(`GET /api/v1/public/users/by-slug/:slug`), defines
`UserAuthorPublicResponseSchema` explicitly as `{ id, displayName, slug,
avatar, bio }` and its own docstring says it **"deliberately excludes
email, phone, role, settings, and any audit fields."** It calls
`userService.getPublicProfileBySlug()` (a narrow projection method chosen
specifically to bypass the self-or-`USER_READ_ALL` permission gate that the
full `getBySlug` service method runs — see the route's inline comment).
`cacheTTL: 300`, rate-limited to 60 req/min/IP.

**This means "enrich with social links" (G-3) is a real data-contract
change**, not just a template change: `socialNetworks` and `website` exist
on the full user schema
(`packages/schemas/src/entities/user/user.identity.schema.ts` — `website:
z.string().url().optional()`, and
`packages/schemas/src/entities/user/user.access.schema.ts` — `socialNetworks:
SocialNetworkReadSchema.nullish()`) but are **not** in
`UserAuthorPublicResponseSchema` today. Adding them means: (a) extending the
response schema, (b) extending `getPublicProfileBySlug`'s projection to
include them, (c) extending the web-side `UserAuthorPublic` interface, and
(d) deciding whether `website`/`socialNetworks` should be exposed for EVERY
user with a public profile or gated somehow (there is currently no
"public-profile opt-in" flag on the user — see §11).

Also note a pre-existing inconsistency worth flagging, not fixing here:
`bio` is capped at different lengths in different schemas (500 chars in
`user.identity.schema.ts` read shape, 1000 in `user.http.schema.ts`, 300 in
onboarding's `user.profile-completion.schema.ts`). Not in scope to unify,
but the new page's bio rendering (with its "ver más/ver menos" clamp,
already implemented as a pattern in `PostAuthorCard.astro`) should be
resilient to the longest of these.

### 5.3 Events-by-author endpoint already exists

`GET /api/v1/public/events/author/:authorId` is already live:
`apps/api/src/routes/event/public/getByAuthor.ts`, registered in
`apps/api/src/routes/event/public/index.ts`. It's a
`createPublicListRoute` backed by `EventService.getByAuthor()`, paginated
(`page`/`pageSize`, default `pageSize: 20`), `cacheTTL: 60`. Response items
are `EventPublicSchema`. **No new endpoint needs to be built for the events
side** — the API work here is limited to (a) the user-profile enrichment in
§5.2, and (b) whatever the web app needs to fetch both lists efficiently
(see §6.2).

The equivalent for posts is `postsApi.list({ authorId, page, pageSize })` →
`GET /api/v1/public/posts?authorId=...` (already used by the current page).
Both `EventPublicSchema` and post list items already have transform
functions on the web side: `toEventCardProps` and `toArticleCardProps`, both
in `apps/web/src/lib/api/transforms.ts` (lines 610 and 689 respectively) —
the merged feed can reuse both without inventing new card-prop shapes.

### 5.4 Call sites that link to the author page (must all be updated)

Three files build the `publicaciones/autor/<slug>` URL via `buildUrl`:

1. `apps/web/src/components/post/PostAuthorCard.astro` (line 43) — sidebar
   "about the author" card on the post detail page, both the name link and
   the "more from this author" CTA (line 96-98).
2. `apps/web/src/components/post/PostDetailHeader.astro` (line 99) —
   `authorHref` used for the byline link in the post header.
3. The author page itself
   (`apps/web/src/pages/[lang]/publicaciones/autor/[slug]/index.astro`, line
   125) — its own `Pagination` `baseUrl`.
4. `apps/web/src/pages/[lang]/publicaciones/autor/[slug]/page/[page].astro`
   (lines 18, 22) — the redirect-to-canonical and rewrite targets.

No event card/detail component currently links to an author page (events
have no "about the organizer/author" sidebar block today — confirmed no
`publicaciones/autor` reference outside the 4 files above). Adding an
author link from the event detail page is implicitly part of G-2/G-3 (an
event's byline should point at the same unified profile a post's byline
does) — flagged as an explicit task in §12, not assumed to already exist.

### 5.5 Redirect precedent

`apps/web/src/middleware.ts` already has TWO precedents for exactly this
kind of URL-migration redirect, both handled as regex matches early in the
middleware chain (steps 3.1 and 3.2, before locale extraction):

- **308** (`legacyMessagesMatch`, lines 184-190): rename that must preserve
  deep links (`/mi-cuenta/messages/<conversationId>` →
  `/mi-cuenta/consultas/<conversationId>`) — chosen because that URL scheme
  carries meaningful path tails that must round-trip.
- **301** (`legacyBlogMatch`, lines 197-203, BETA-162): a "guessable alias"
  redirect (`/blog` → `/publicaciones`), explicitly documented as
  "**301 (not 308), since this is a one-way SEO/UX alias, not a
  deep-link-preserving rename**."

`/publicaciones/autor/<slug>/` → `/autores/<slug>/` is the deep-link-preserving
case (the tail — `<slug>` and any `/page/<n>/` suffix — must be carried
through, and the Linear issue explicitly says the old URL "may already be
indexed and linked from every post"), which argues for the **301** pattern
used for `legacyBlogMatch` is the wrong template to copy verbatim — it drops
the tail. The **308** `legacyMessagesMatch` pattern (regex captures locale +
tail, redirects to the new prefix + same tail) is the right shape to copy,
but SEO guidance (also cited inline at `legacyMessagesMatch`, REQ-19)
prefers 301 for permanent renames since it passes full link equity, while
308 is reserved for cases where preserving the HTTP method matters (not
relevant here — this is all GET). **Recommendation: 301, with the
deep-link-preserving tail-forwarding shape of `legacyMessagesMatch`** — see
§9 AC-4 and open question OQ-2 for the final call.

Also enforce it BEFORE `Step 3` (trailing-slash enforcement) is applied to
avoid a double-redirect for paths without a trailing slash — matching where
the existing two aliases sit in the chain (both are steps 3.x, i.e. after
trailing-slash enforcement, meaning a bare `/es/publicaciones/autor/foo`
without trailing slash gets slash-normalized first, THEN alias-redirected —
two redirects in that one edge case, same as today's blog/messages aliases;
consistent with precedent, not a new problem to solve here).

### 5.6 `buildUrl` and i18n route segments

`apps/web/src/lib/urls.ts::buildUrl({ locale, path })` only prefixes the
locale (`/{locale}/{path}/`) and normalizes the trailing slash — it does
**not** translate the `path` segment per locale. Every existing route
(`publicaciones`, `destinos`, `alojamientos`, etc.) uses the same Spanish
segment string across `es`/`en`/`pt`; there is no per-locale path-segment
translation mechanism anywhere in the URL layer inspected. `autores` is
consistent with that convention (Spanish segment, invariant across
locales) — no per-locale translation work is needed or expected.

### 5.7 JSON-LD

`apps/web/src/components/seo/` has entity-specific JSON-LD components
(`ArticleJsonLd`, `EventJsonLd`, `OrganizationJsonLd`,
`LodgingBusinessJsonLd`, `RestaurantJsonLd`, `TouristAttractionJsonLd`,
`PlaceJsonLd`, `BreadcrumbJsonLd`, `CollectionPageJsonLd`,
`AboutPageJsonLd`, `WebSiteJsonLd`, `ItemListJsonLd`,
`PriceSpecificationJsonLd`, `FAQPageJsonLd`, plus a generic `JsonLd.astro`).
**There is no `PersonJsonLd` component.** If the page becomes indexable
(G-5), adding `schema.org/Person` (or `ProfilePage` wrapping a `Person`)
markup is new work, not a rename of an existing component — flagged as a
task in §12, with the concrete schema.org type left as an open question
(OQ-4) since no precedent exists in this codebase to copy.

## 6. Proposed design

### 6.1 Route

New page tree:

```
apps/web/src/pages/[lang]/autores/[slug]/index.astro
apps/web/src/pages/[lang]/autores/[slug]/page/[page].astro
```

mirroring the structure, pagination-rewrite pattern, and 404 handling of the
current `publicaciones/autor/[slug]/` pair (§5.1). The old
`publicaciones/autor/[slug]/` tree is deleted once the redirect (§6.4) is in
place.

### 6.2 Data fetching

Three calls, same actor-blind public-cache shape as today (no auth
required, `noindex`/`cacheTTL` decided per §6.5):

1. `usersApi.getBySlug({ slug })` → 404 if missing (unchanged shape, plus
   whatever fields G-3 adds — see §7.1).
2. `postsApi.list({ authorId: author.id, page, pageSize })`.
3. `eventsApi.getByAuthor({ authorId: author.id, page, pageSize })` — new
   web-side client method wrapping the already-live
   `GET /api/v1/public/events/author/:authorId` (§5.3). Check
   `apps/web/src/lib/api/endpoints.ts` for whether an `eventsApi` object
   already exists to extend, or whether it needs to be created following the
   `usersApi`/`postsApi` pattern already in that file.

Calls 2 and 3 are independent of each other (both only need `author.id` from
call 1) and should run with `Promise.all`, not sequentially — an actual
improvement over today's page, which the file doc claims runs "in parallel"
but does not (§5.1 step 4).

### 6.3 Combining posts and events — single chronological list vs. two tabs

Two options, tradeoffs below. **This is the one open design decision the
owner should confirm before implementation** (see OQ-1).

**Option A — single chronological feed.** Merge both result sets by
publish/event date into one list, using the existing `toArticleCardProps` /
`toEventCardProps` transforms and rendering each item with its existing card
component (`ArticleCard` vs. an event card) inline in the same grid.

- Pros: simplest mental model ("everything this person made, in order");
  no empty-tab problem for an author who only ever wrote posts or only ever
  loaded events (the common case, per the issue's own framing of "the more
  tedious of the two").
- Cons: pagination becomes harder — the two source lists are independently
  paginated by the API (`postsApi.list` and `eventsApi.getByAuthor` each
  return their own `pagination.total`/`totalPages`), so a single merged
  "page N of the combined list" either requires fetching more than one API
  page per source per render (to have enough items to slice a stable page)
  or accepting uneven page sizes. Mixed card types in one grid also need a
  shared visual footprint (post cards and event cards are not currently
  designed to sit side-by-side — confirm visual parity is acceptable before
  committing to this).

**Option B — two tabs (Posts / Events), each independently paginated.**

- Pros: reuses each source's own pagination as-is (no merge-then-reslice
  logic); each grid stays visually consistent (all `ArticleCard` or all
  event cards, never mixed); simpler to implement and test, and each tab's
  emptiness is independently obvious ("no events yet" vs. "no posts yet")
  rather than a single generic empty state.
- Cons: a light content client-side interaction is needed for tab
  switching (this repo's web app minimizes client JS — "Use `client:*`
  directives wisely" per `CLAUDE.md`); an author who mixes both loses the
  "everything in order" narrative the owner's framing implies ("la
  recompensa queda a medias" suggests visibility of ALL the work, which a
  buried second tab partially undermines).

No recommendation is made here — the owner's issue text doesn't settle it,
and both are legitimate; see OQ-1.

### 6.4 Redirect

Add a new middleware step in `apps/web/src/middleware.ts`, in the same
"Step 3.x legacy alias" block as `legacyMessagesMatch`/`legacyBlogMatch`
(§5.5), placed alongside them (before locale extraction, after trailing-slash
enforcement):

```ts
const legacyAuthorMatch = path.match(/^\/(es|en|pt)\/publicaciones\/autor\/([^/]+)(\/page\/\d+)?\/?$/);
if (legacyAuthorMatch) {
    const localeSegment = legacyAuthorMatch[1];
    const slug = legacyAuthorMatch[2];
    const pageTail = legacyAuthorMatch[3] ?? '';
    const search = context.url.search;
    return context.redirect(`/${localeSegment}/autores/${slug}${pageTail}/${search}`, 301);
}
```

(Illustrative — exact regex/shape to be finalized during implementation
against real test cases, including the query-string passthrough the
existing aliases already do.) This must run BEFORE the deleted
`publicaciones/autor/[slug]/` route is removed, in the same PR, so there is
no window where the old URL 404s.

### 6.5 SEO / indexability

Per §5.1, the CURRENT page is `noindex` and absent from the sitemap — so
G-5 is a genuine decision, not a mechanical carry-over. Given the owner's
framing (the author page is "the real reward," implying it should be
discoverable/shareable), the default proposed here is: **make it indexable**
(`noindex={false}` or omit the prop), add it to
`apps/web/src/pages/sitemap-dynamic.xml.ts` following the same pattern as
the `/publicaciones/{slug}/` entries (§5.7's sibling file), and add
`schema.org/Person` JSON-LD (new component, §5.7). Canonical URL construction
already works via `Astro.site ?? Astro.url.origin` + `Astro.url.pathname`
(unchanged from today's page, just at the new path). **Flagged as OQ-3** for
explicit owner confirmation, since flipping a page from `noindex` to indexed
is a real SEO/product decision, not an implementation detail.

### 6.6 Who gets a page — every author vs. EDITOR-only

Per `packages/schemas` role enum comment
(`packages/schemas/src/enums/role.enum.ts:7`), `EDITOR` "can create/edit/
publish events and posts only" — but `posts.authorId` and `events.authorId`
are both plain user-id foreign keys with no role constraint visible in the
schemas inspected (`post.http.schema.ts`, `post.query.schema.ts`), meaning
any user who has ever been set as a post/event author (including staff
seeding content, or a non-EDITOR host who wrote a post) gets a reachable
`/autores/<slug>/` page once it's indexable. This matches the Linear issue's
own observation ("los posts ya tienen authorId para cualquier autor, así
que la página no es exclusiva de editores externos") — **proposed: the page
applies to any user with at least one non-deleted post OR event where they
are `authorId`, not gated by role.** Flagged as OQ-5 since it's an access
scope decision, not purely technical.

## 7. Data model / contracts

### 7.1 `GET /api/v1/public/users/by-slug/:slug` — response schema change

Extend `UserAuthorPublicResponseSchema`
(`apps/api/src/routes/user/public/getBySlug.ts`) and
`userService.getPublicProfileBySlug()`'s projection to additionally return
(fields TBD against OQ-6, but at minimum, per the issue's "redes"
requirement):

- `website: string | null` (already exists on the full user schema,
  read-only here).
- `socialNetworks: SocialNetworkRead | null` (already exists via
  `SocialNetworkReadSchema` on `user.access.schema.ts`).

Update the web-side `UserAuthorPublic` interface
(`apps/web/src/lib/api/endpoints.ts:1202-1208`) to match. No DB schema
change — these columns already exist; this is a response-shape change only.

### 7.2 `eventsApi` web client (new or extended)

A web-side client method for `GET /api/v1/public/events/author/:authorId`,
mirroring `postsApi.list`'s shape (`{ page, pageSize }` query,
`{ items, pagination }` response), added to
`apps/web/src/lib/api/endpoints.ts`. No API-side contract change — the
route (§5.3) already exists and is stable.

### 7.3 No new DB migration

Both `authorId` columns and their indexes already exist
(`events.authorId`, `posts.authorId`, per the issue and confirmed by the
existing `getByAuthor`/`list` endpoints). `website`/`socialNetworks` are
existing user columns being newly exposed, not newly created. This spec
requires no `pnpm db:generate` migration.

## 8. UX / UI behavior

- Profile header: avatar (fallback initial, matching `PostAuthorCard`'s
  existing placeholder pattern — §5.4 item 1), display name, bio (with the
  "ver más/ver menos" clamp pattern already implemented in
  `PostAuthorCard.astro` for bios over ~150 chars), social links (icons,
  when present — no existing icon-for-social-network component was found in
  this pass; check `@repo/icons` before building new ones, per the
  dependency policy in `CLAUDE.md`).
- Missing bio/avatar: per the issue's open question, define a graceful
  degradation — proposed: omit the bio paragraph entirely (as today's page
  already does, `{author.bio && (...)}`), and keep the avatar as an
  initials-circle placeholder (existing pattern in `PostAuthorCard`'s
  `.post-author-card__avatar-placeholder`, NOT currently duplicated in the
  author page itself, which has no fallback avatar at all — today's author
  page just omits the `<img>` entirely when `author.avatar` is falsy,
  leaving no visual placeholder; this is a minor UX gap this spec should
  close by reusing the initials-placeholder pattern).
- Empty states: reuse the existing `EmptyState` component/copy pattern,
  adapted per §6.3's chosen structure (one combined empty state for Option
  A, or per-tab empty states for Option B).
- Pagination: reuse the existing `Pagination` component; `baseUrl` updated
  to the new route.

## 9. Acceptance criteria

- AC-1: `GET /{lang}/autores/<slug>/` renders the author's profile with
  posts and events combined per the chosen §6.3 design.
- AC-2: `GET /{lang}/publicaciones/autor/<slug>/` and its
  `/page/<n>/` form 301-redirect to the new URL (with query string and, for
  the paginated form, the page-tail preserved).
- AC-3: All 4 call sites identified in §5.4 (`PostAuthorCard.astro`,
  `PostDetailHeader.astro`, the author page's own pagination `baseUrl`, and
  the `page/[page].astro` redirect/rewrite targets) point at `/autores/`,
  not `/publicaciones/autor/`.
- AC-4: The redirect is a real 301 issued by `apps/web/src/middleware.ts`
  (not a client-side/meta-refresh redirect), verified with a test hitting
  the old URL directly.
- AC-5: `usersApi.getBySlug` response includes `website`/`socialNetworks`
  when present on the user record, and the page renders them when
  available.
- AC-6: An event's detail page links to the author's unified profile (new
  work per §5.4 — no such link exists today).
- AC-7: Whatever G-5/OQ-3 indexability decision is made is reflected
  consistently across `noindex` prop, sitemap inclusion, and (if indexable)
  JSON-LD presence — no partial state (e.g. indexable but absent from
  sitemap).
- AC-8: Old `publicaciones/autor/[slug]/` route files are deleted in the
  same PR that adds the redirect (no dead-code window).

## 10. Risks

- R-1: Merging two independently-paginated API results into one
  chronologically-ordered, evenly-paginated feed (Option A in §6.3) is
  more complex than it first appears — needs a concrete pagination
  algorithm decision before implementation, not just "merge and sort."
- R-2: Widening the public user-by-slug response (§7.1) changes what's
  exposed for EVERY user who has ever authored a post/event, including
  people who never opted into having a public "author profile" — there is
  no existing opt-in/opt-out flag (see OQ-6). Shipping this without an
  opt-out could expose social links a user did not intend to be public via
  this specific surface (they may have set them expecting only their own
  account settings to see them, depending on what other surfaces already
  expose `socialNetworks` today — not audited in this pass, flagged as
  OQ-7).
- R-3: The redirect regex must correctly handle the existing `/page/1/` →
  canonical 301 that `page/[page].astro` already issues (§5.1) — a
  double-redirect chain (old paginated URL → old canonical → new canonical)
  is acceptable per existing precedent (§5.5) but should be tested
  explicitly, not assumed.
- R-4: If G-5 makes the page indexable, every existing indexed URL that
  currently 404s or is unreachable (an author with zero posts/events, if
  such a slug is guessable) needs to keep 404ing, not get accidentally
  indexed as a thin/empty page.

## 11. Open questions

- OQ-1: Single chronological list (Option A) or two tabs (Option B) for
  combining posts and events? See tradeoffs in §6.3. Blocks implementation
  of the core page layout.
- OQ-2: Redirect status code — 301 (SEO link-equity precedent, per
  `legacyBlogMatch`/REQ-19) vs. 308 (deep-link-tail-preserving shape,
  per `legacyMessagesMatch`)? §5.5 recommends 301 with the tail-preserving
  regex shape, but this wasn't an owner decision yet.
- OQ-3: Does the new page become indexable (flip from today's `noindex`),
  and is it added to the sitemap + given `Person`/`ProfilePage` JSON-LD? §6.5
  proposes yes-to-all as the default, given the owner's "real reward"
  framing, but this is a genuine SEO/product decision, not inferred from
  existing code (there is no precedent to defer to — this page has always
  been `noindex`).
- OQ-4: If indexable, what schema.org type — `Person`, or `ProfilePage`
  wrapping a `Person`? No existing component to copy (§5.7); pick during
  implementation once OQ-3 is settled.
- OQ-5: Does the unified page apply to any user with at least one authored
  post/event (proposed default, §6.6), or is it gated to `EDITOR`-role users
  only? The Linear issue leans toward "any author" but leaves it open
  explicitly.
- OQ-6: Exact field list for the "richer bio/socials" enrichment (G-3) —
  is `website` + `socialNetworks` sufficient, or does the owner want
  additional fields (e.g. a "role/title" label, a "member since" date)?
- OQ-7: Are `socialNetworks`/`website` already exposed to the public via
  any OTHER existing surface (e.g. a full public user profile page,
  if one exists outside this spec's scope)? Not audited in this pass —
  needed to assess whether R-2's exposure concern is new or already
  accepted elsewhere in the product.
- OQ-8: What happens if the same user has a post/event with an `authorId`
  but their account was later soft-deleted? `getPublicProfileBySlug` likely
  404s per existing behavior (no evidence found either way in this pass) —
  confirm the combined feed's empty/404 behavior matches expectations for
  that edge case.

## 12. Implementation notes

Suggested task breakdown (not a commitment — task-master will atomize this
formally):

1. API: extend `UserAuthorPublicResponseSchema` +
   `getPublicProfileBySlug()` projection with `website`/`socialNetworks`
   (§7.1). Depends on OQ-6/OQ-7 being settled.
2. Web: add/extend `eventsApi` client method for
   `GET /api/v1/public/events/author/:authorId` (§7.2).
3. Web: new `apps/web/src/pages/[lang]/autores/[slug]/index.astro` +
   `page/[page].astro`, implementing the §6.3 design (blocked on OQ-1).
4. Web: middleware redirect (§6.4), old route deletion (AC-8), same PR.
5. Web: update the 3 remaining call sites in §5.4 (items 1, 2 — item 3/4
   are the deleted/replaced files themselves).
6. Web: add author→event-detail link (AC-6), currently missing entirely.
7. SEO (conditional on OQ-3): sitemap entry, new `PersonJsonLd`/
   `ProfilePageJsonLd` component, `noindex` flip.
8. Tests: redirect test (old URL → new URL, 301, query string + page-tail
   preserved), page render test (posts+events combined per chosen design),
   response-schema test for the widened `by-slug` endpoint.

This spec intentionally does NOT invent the exact `eventsApi` method
signature, the merge/pagination algorithm for Option A, or the JSON-LD
component's exact shape — those are implementation-phase work once the
open questions above are resolved.

## 13. Linear

Canonical tracking:
HOS-375
