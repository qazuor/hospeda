---
title: 'Author page: move to /autores/<slug>/ and unify posts + events'
linear: HOS-375
statusSource: linear
created: 2026-08-02
type: feature
areas:
  - web
  - api
  - content
---

# Author page: move to `/autores/<slug>/` and unify posts + events

## 1. Summary

Move the author page out of the blog section (`/{locale}/publicaciones/autor/<slug>/`)
to a top-level `/{locale}/autores/<slug>/`, list both the author's posts **and** their
events in two separate chronological blocks, make the page indexable when the profile
is complete enough to deserve it, and add an explicit opt-in before publishing the
author's social networks.

## 2. Problem

The author page already exists, but it lives under `/publicaciones/`, so it only ever
lists posts. Events loaded by that same person are invisible, even though
`events.authorId` exists with a dedicated index and a public API route to query it.

This matters because the author page is the only real reward an editor gets. Loading
events is the more tedious of the two content types; if that work never shows up on
their profile, the reward stops exactly where the effort was highest.

The page is also `noindex` today, which contradicts its purpose: a recognition page
search engines cannot see is not recognition.

## 3. Goals

- **G-1** — The author page is served at `/{locale}/autores/<slug>/`, outside the
  posts section.
- **G-2** — It renders the author's posts and events as **two separate blocks**, each
  in reverse-chronological order, both visible at once (no tabs, no merged feed).
- **G-3** — The page is indexable and present in the sitemap **when the profile is
  complete**; otherwise it stays `noindex` and out of the sitemap.
- **G-4** — Old URLs (`/publicaciones/autor/<slug>/` and their `/page/<n>/` tail)
  permanently redirect to the new location, preserving slug and pagination.
- **G-5** — The author's social networks are published **only** after an explicit,
  default-off opt-in, with profile-editor copy that states the page is public.
- **G-6** — The page emits `ProfilePage` JSON-LD with a `Person` as `mainEntity`.
- **G-7** — Event detail pages link to their author's page (they link to nothing today).

## 4. Non-goals

- **NG-1** — An authors index at `/autores/` listing every author. Out of scope; the
  page is reachable from post/event bylines and from search.
- **NG-2** — Fixing the dead query filters on `GET /api/v1/public/events/author/{authorId}`
  (see baseline §5.3). Only pagination is needed here; the rest stays as-is.
- **NG-3** — Publishing `profile.website`, `profile.occupation` or `location`. Same
  consent problem as social networks, and not requested.
- **NG-4** — Per-locale translation of the `autores` segment. `buildUrl` does not
  translate segments for anything (`publicaciones`, `destinos`), and this stays
  consistent with that.
- **NG-5** — Any DB migration. The opt-in is additive inside an existing JSONB column.

## 5. Current baseline

Everything below was verified against the code in this worktree on 2026-08-02.

### 5.1 The page

- `apps/web/src/pages/[lang]/publicaciones/autor/[slug]/index.astro` — fetches
  `usersApi.getBySlug({ slug })` (line 36), then `postsApi.list({ authorId, page, pageSize })`
  (line 45). It imports `usersApi, postsApi` only (line 17): **no events call exists**.
- The in-code comment at line 44 claims the post fetch is "in parallel (no waterfall)".
  That is false — the posts call needs the resolved user id, so it is a genuine
  two-step waterfall.
- `noindex={true}` is hardcoded as a `ListingLayout` prop (line 63).
- Renders avatar (80×80 circular, lines 84-94), bio (lines 97-99), a post count, and a
  1-3 column `ArticleCard` grid (lines 110-118).
- Pagination base URL: `buildUrl({ locale, path: \`publicaciones/autor/${slug}\` })` (line 125).
- A real author with zero posts renders normally (200) with `EmptyState` (lines 129-138).
  404 (line 38) is reserved for "the user does not exist".
- `apps/web/src/pages/[lang]/publicaciones/autor/[slug]/page/[page].astro` — the
  paginated variant. It **bypasses `buildUrl`** and hardcodes the URL as raw template
  literals in two places: `Astro.redirect(...)` (line 18) and `Astro.rewrite(...)` (line 22).

### 5.2 URL call sites

Four files, five distinct string constructions:

| # | File:line | Mechanism |
|---|---|---|
| 1 | `apps/web/src/components/post/PostAuthorCard.astro:43` | `buildUrl` |
| 2 | `apps/web/src/components/post/PostDetailHeader.astro:99` | `buildUrl` |
| 3 | `.../autor/[slug]/index.astro:125` | `buildUrl` (pagination base) |
| 4a | `.../autor/[slug]/page/[page].astro:18` | raw literal in `Astro.redirect` |
| 4b | `.../autor/[slug]/page/[page].astro:22` | raw literal in `Astro.rewrite` |

Tests that reference the path and will need updating:
`apps/web/test/pages/publicaciones-autor.test.ts` (lines 20, 22, 102),
`apps/web/test/pages/breadcrumbs-coverage.test.ts` (lines 135-137),
`apps/web/test/pages/share-buttons-in-detail-pages.test.ts:108`,
`apps/web/test/pages/publicaciones-detail-media.test.ts:147`.

`grep -rn "autores"` across `apps/web/src`, `apps/api/src`, `packages/i18n/src`,
`packages/schemas/src` returns **zero hits** — no route, no i18n key, nothing to reuse.

### 5.3 API surface

- `GET /api/v1/public/events/author/{authorId}` exists
  (`apps/api/src/routes/event/public/getByAuthor.ts:19`). It takes a **UUID**
  (`UserIdSchema`, line 23), not a slug. Its Zod schema
  (`packages/schemas/src/entities/event/event.http.schema.ts:101-116`) declares
  `page`, `pageSize`, `sortBy`, `sortOrder`, `q`, `category`, `isFeatured`, `isVirtual`,
  but the handler destructures only `page`/`pageSize` (line 29) and silently drops the
  rest. `cacheTTL: 60` (line 40). **No web client wrapper exists** — `eventsApi`
  (`apps/web/src/lib/api/endpoints.ts:842`) has no `getByAuthor`.
- `GET /api/v1/public/users/by-slug/:slug` returns exactly
  `{ id, displayName, slug, avatar, bio }` (`UserAuthorPublicResponseSchema`,
  `apps/api/src/routes/user/public/getBySlug.ts:35-41`). Lines 16-17 state the exclusion
  is deliberate: *"Returns only safe public fields. Deliberately excludes email, phone,
  role, settings, and any audit fields."* `cacheTTL: 300` (line 97).

### 5.4 Data

- `events.authorId` — `uuid('author_id').notNull().references(() => users.id, { onDelete: 'restrict' })`
  (`packages/db/src/schemas/event/event.dbschema.ts:41-43`), indexed at line 87
  (`events_authorId_idx`).
- `posts.authorId` — plain UUID FK to `users` (`packages/db/src/schemas/post/post.dbschema.ts:101`).
- Neither has a DB-level or route-level role restriction. Post creation gates on
  `PermissionEnum.POST_CREATE` (`packages/service-core/src/services/post/post.permissions.ts:23`),
  never on `RoleEnum`. `RoleEnum.EDITOR` exists
  (`packages/schemas/src/enums/role.enum.ts:21`) but nothing enforces that `authorId`
  belongs to an editor.
- `users.socialNetworks` — jsonb (`packages/db/src/schemas/user/user.dbschema.ts:96`),
  typed `SocialNetwork` (`packages/schemas/src/common/social.schema.ts`): `facebook`,
  `instagram`, `twitter`, `linkedIn`, `tiktok`, `youtube`, all optional URLs.
- `users.settings` — jsonb, `UserSettingsSchema`
  (`packages/schemas/src/entities/user/user.settings.schema.ts`). It already carries
  additive preference keys with the exact pattern this spec needs — see
  `searchHistoryEnabled` (line ~118): *"Stored additively in the existing `settings`
  JSONB column — no DB migration needed."*
- **No `listAuthors` / `getAuthors` service exists anywhere** in
  `packages/service-core/src/services`.

### 5.5 Consent state (why G-5 exists)

Social networks are entered by the user themselves at `/{locale}/mi-cuenta/editar`,
inside the optional "Más detalles" block, adjacent to occupation and location
(`packages/i18n/src/locales/es/account.json:806`, `ProfileEditForm.client.tsx:389`).
Nothing in that form's copy states the values will be published. Publishing them on a
page we are deliberately making indexable would be a retroactive change to the terms
under which the data was collected.

### 5.6 SEO plumbing

- One shared JSON-LD wrapper: `apps/web/src/components/seo/JsonLd.astro` (the only file
  in the repo emitting `<script type="application/ld+json">`, line 28). Every entity
  component delegates to it (`ArticleJsonLd`, `EventJsonLd`, `BreadcrumbJsonLd`, …).
  There is **no** `Person` or `ProfilePage` component.
- `ArticleJsonLd` accepts `author: { name, url? }`, but the post detail page
  (`apps/web/src/pages/[lang]/publicaciones/[slug].astro:275-276`) only ever passes
  `{ name }` — the author `url` is never populated.
- Sitemap is hand-rolled, not the Astro integration:
  `sitemap-index.xml.ts` → `sitemap-static.xml.ts` + `sitemap-dynamic.xml.ts`. The
  dynamic one fetches accommodations, destinations, events, posts, gastronomy,
  experiences, attractions and POIs. **It has zero author logic.**
- `apps/web/test/components/seo/facet-noindex.test.ts:39` asserts this page belongs to
  the unconditional-`noindex` list. **This guard will fail the moment G-3 lands** and
  must be updated in the same change.

### 5.7 Redirect precedent — the issue is wrong about this

`apps/web/src/middleware.ts` step 3.1 (lines 179-185, `308`) and step 3.2
(lines 192-198, `301`) use the **identical** tail-preservation mechanism: a
`(\/.*)?` capture group, defaulted to `/`, spliced onto the new base, with
`context.url.search` re-attached separately. The issue's claim that the 301 does not
preserve the tail is false. The only real difference between the two blocks is the
status code.

### 5.8 Cache classification

- `PUBLIC_CACHE_ENDPOINTS` (`apps/api/src/middlewares/cache.constants.ts:14-29`)
  includes `/api/v1/public/events` and `/api/v1/public/posts`, prefix-matched via
  `path.startsWith` (`cache.ts:105`) — so the events-by-author sub-route is already covered.
- `/api/v1/public/users` is in `PRIVATE_CACHE_ENDPOINTS` (line 36). **Any new authors
  endpoint mounted under `/api/v1/public/users/...` would inherit private caching by
  prefix**, silently.
- The web app's own edge-cache policy (`apps/web/src/lib/cache/listing-cache.ts`) is
  currently applied only to `/alojamientos/`; the author page sets no `Cache-Control`.

## 6. Proposed design

### 6.1 Route move

New pages, mirroring the current pair:

- `apps/web/src/pages/[lang]/autores/[slug]/index.astro`
- `apps/web/src/pages/[lang]/autores/[slug]/page/[page].astro`

The old pair is **deleted**, not left as a shim — the middleware redirect (§6.4) is the
only compatibility surface. Both new files route their URL construction through
`buildUrl`; the raw literals of baseline §5.1 are not carried over.

### 6.2 Data fetching

Resolve the author first, then fan out:

```ts
const author = await usersApi.getBySlug({ slug });          // 404 if absent
const [posts, events] = await Promise.all([
    postsApi.list({ authorId: author.id, page, pageSize }),
    eventsApi.getByAuthor({ authorId: author.id, page: 1, pageSize: EVENTS_BLOCK_SIZE })
]);
```

The waterfall on the user lookup is unavoidable (the endpoints take a UUID, not a slug).
The second hop must be a real `Promise.all` — not three sequential awaits — and the
misleading "no waterfall" comment from the old page is not carried over.

`eventsApi.getByAuthor` is **new** and must be added to
`apps/web/src/lib/api/endpoints.ts` alongside the other `eventsApi` methods.

### 6.3 Layout and pagination

Two stacked blocks, posts first, each reverse-chronological, both rendered on page 1:

1. **Publicaciones** — keeps the existing path pagination at
   `/{locale}/autores/<slug>/page/<n>/`, same `pageSize` as today.
2. **Eventos** — the latest `EVENTS_BLOCK_SIZE` (12), no pagination.

Pages `2..n` render the posts block only. Rendering the events block again on every
paginated page would duplicate the same markup across indexable URLs.

Empty-state rules (using the top-level `@/components/EmptyState.astro` — **not**
`shared/feedback/EmptyState.astro`, which has a different prop shape):

- Author has posts but no events → events block is omitted entirely (no empty box).
- Author has events but no posts → posts block is omitted entirely.
- Author has neither → the page still 200s with a single `EmptyState` and a CTA back to
  `/publicaciones/`, matching today's behavior. It is `noindex` by §6.5 regardless of
  profile completeness.

### 6.4 Redirect

A new step in `apps/web/src/middleware.ts`, copied from the step 3.2 shape, with a
**301**:

```ts
const legacyAuthorMatch = path.match(/^\/(es|en|pt)\/publicaciones\/autor(\/.*)?$/);
if (legacyAuthorMatch) {
    const localeSegment = legacyAuthorMatch[1];
    const tail = legacyAuthorMatch[2] ?? '/';
    const search = context.url.search;
    return context.redirect(`/${localeSegment}/autores${tail}${search}`, 301);
}
```

301 rather than 308 because 308's only added guarantee is method preservation on
POST/PUT, and this is a GET-only public page. What matters is that search engines treat
the move as canonical and consolidate authority, which is the 301's job.

The `(\/.*)?` capture carries both `<slug>/` and `<slug>/page/<n>/` through unchanged,
so no separate rule is needed for the paginated tail.

### 6.5 Indexability gate

A page is indexable **iff all** of:

1. the author has at least one published post or event, **and**
2. `bio` is non-empty, **and**
3. `avatar` is non-empty, **and**
4. it is page 1 (paginated pages are always `noindex`).

`ListingLayout`'s `noindex` prop becomes `noindex={!isIndexable}` instead of the
hardcoded `true`. The same predicate decides sitemap inclusion (§6.6), so the two can
never disagree — it lives in one helper, `apps/web/src/lib/seo/author-indexable.ts`,
consumed by both the page and the sitemap.

The CI guard at `apps/web/test/components/seo/facet-noindex.test.ts:39` is updated in
the same change: the author page moves out of the unconditional-`noindex` list, and a
new test asserts the conditional predicate in both directions.

### 6.6 Sitemap + the authors endpoint

New public endpoint, deliberately mounted at **`/api/v1/public/authors`** and **not**
under `/api/v1/public/users/...` — the latter would inherit `PRIVATE_CACHE_ENDPOINTS`
by prefix (baseline §5.8) and silently lose shared caching. The new prefix is added to
`PUBLIC_CACHE_ENDPOINTS`.

It returns only authors that pass the §6.5 gate:

```
GET /api/v1/public/authors?page=&pageSize=
→ { items: [{ slug, updatedAt }], pagination }
```

Backed by a new `listPublicAuthors` service in `packages/service-core/src/services/user/`,
querying users that have ≥1 published post or event and non-empty `bio` and `avatar`.
`sitemap-dynamic.xml.ts` gains a block for it, following the existing
`buildEntriesForEntity` pattern.

### 6.7 Social networks opt-in

**Storage** — one additive key in the existing `settings` JSONB, no migration, exactly
mirroring `searchHistoryEnabled`:

```ts
/**
 * Whether the user has opted in to showing their social networks on their
 * public author page (HOS-375). Defaults to `false` — publishing must be an
 * explicit act. Stored additively in the existing `settings` JSONB column —
 * no DB migration needed.
 */
publicProfileShowSocialNetworks: z.boolean().default(false).optional(),
```

**Write path** — `UserSettingsWebPatchSchema` is `.strict()` and today allows exactly
four keys. The new key must be added there or the web PATCH returns 400 with no
obvious cause.

**Read path** — `UserAuthorPublicResponseSchema` gains an optional `socialNetworks`
field. The route reads the profile owner's setting server-side and includes the object
only when it is `true`; `settings` itself is never returned, preserving the deliberate
exclusion documented at `getBySlug.ts:16-17`.

The response stays **actor-blind**: what is included depends on the *profile owner's*
preference, not on who is asking. The route therefore remains safely cacheable, and
this must stay true — a viewer-dependent branch here would poison a shared cache.

**Consent copy** — the `/mi-cuenta/editar` social block gains copy stating that the
author page is public and that these links will appear on it, plus the toggle itself.
Shipping the field without this UI leaves a dead preference nobody can set, so both
land together.

### 6.8 JSON-LD

New `apps/web/src/components/seo/ProfilePageJsonLd.astro`, delegating to `JsonLd.astro`
like every other entity component. Shape:

```jsonc
{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "mainEntity": {
    "@type": "Person",
    "name": "<displayName>",
    "url": "<absolute /autores/<slug>/ URL>",
    "image": "<avatar>",          // omitted when absent
    "description": "<bio>",       // omitted when absent
    "sameAs": ["<social urls>"]   // omitted unless opted in (§6.7)
  }
}
```

`ProfilePage` rather than a bare `Person` because the page is the *profile document*,
not the person. `ProfilePage` gives `Person` a correct home as `mainEntity` and leaves
room to declare the produced items later; a bare `Person` has nowhere to hang the
posts and events.

Emitted only when the page is indexable (§6.5) — structured data on a `noindex` page is
noise.

### 6.9 Inbound links

- `PostAuthorCard.astro`, `PostDetailHeader.astro` → new URL via `buildUrl`.
- `ArticleJsonLd`'s `author.url` is populated on the post detail page
  (`publicaciones/[slug].astro:275-276`), which it never was.
- **New**: an author byline linking to `/autores/<slug>/` on the event detail page.
  This does not exist today. **Verify first** that `EventPublicSchema` actually carries
  the author on the detail payload — if it does not, exposing it is a payload change
  that must be scoped into this spec's task list before the UI work starts.

## 7. Data model / contracts

| Change | Where | Migration |
|---|---|---|
| `publicProfileShowSocialNetworks?: boolean` (default `false`) | `UserSettingsSchema` | none — additive JSONB |
| same key allowed on write | `UserSettingsWebPatchSchema` (`.strict()`) | none |
| `socialNetworks?: SocialNetwork` (conditional) | `UserAuthorPublicResponseSchema` | none |
| `GET /api/v1/public/authors` | new route + `listPublicAuthors` service | none |
| `/api/v1/public/authors` added | `PUBLIC_CACHE_ENDPOINTS` | none |
| `eventsApi.getByAuthor` | `apps/web/src/lib/api/endpoints.ts` | none |

No DB migration, no seed data-migration: nothing in `packages/seed/src/data/**` changes.

## 8. UX / UI behavior

- Header: avatar, display name, bio. Missing avatar or bio → that element is simply
  absent. No placeholder silhouette and no filler copy — an empty profile should look
  empty, not padded, and the `noindex` gate already keeps it out of the index.
- Social links render as icons under the bio, only when opted in and only for the
  networks actually filled.
- Two labelled blocks, "Publicaciones" then "Eventos", each reverse-chronological.
- Post pagination control keeps its current appearance and lands on
  `/autores/<slug>/page/<n>/`.
- Breadcrumbs: Inicio → Autores? **No** — there is no `/autores/` index (NG-1), so the
  trail is Inicio → `<displayName>`. `breadcrumbs-coverage.test.ts` is updated accordingly.

## 9. Acceptance criteria

- **AC-1** — `GET /es/autores/<slug>/` returns 200 and renders both blocks for an
  author with posts and events.
- **AC-2** — `GET /es/publicaciones/autor/<slug>/` returns **301** to
  `/es/autores/<slug>/`, and `/es/publicaciones/autor/<slug>/page/3/?x=1` returns 301 to
  `/es/autores/<slug>/page/3/?x=1` — tail and query preserved.
- **AC-3** — An author with `bio` and `avatar` and ≥1 item renders **without**
  `<meta name="robots" content="noindex">` and appears in `sitemap-dynamic.xml`.
- **AC-4** — An author missing `bio` **or** `avatar` renders **with** `noindex` and is
  **absent** from the sitemap. Page 2+ is always `noindex`.
- **AC-5** — `GET /api/v1/public/users/by-slug/:slug` omits `socialNetworks` when the
  owner has not opted in, and includes it when they have. It never returns `settings`.
- **AC-6** — Two requests for the same slug from different actors (anonymous vs
  authenticated) return byte-identical bodies.
- **AC-7** — `PATCH` of `publicProfileShowSocialNetworks` from the web account form
  succeeds (not 400), and the toggle round-trips.
- **AC-8** — An indexable author page emits exactly one `ProfilePage` JSON-LD block with
  a `Person` `mainEntity`; a non-indexable one emits none.
- **AC-9** — `grep -rn "publicaciones/autor" apps/web/src` returns zero hits.
- **AC-10** — Event detail pages link to their author's page.
- **AC-11** — `facet-noindex.test.ts` passes with the author page removed from the
  unconditional list, and new tests cover the predicate in both directions.
- **AC-12** — Full `pnpm typecheck` + `pnpm lint` + the web and api test suites are green.

## 10. Risks

- **R-1 — The authors endpoint is a new user-slug enumeration surface.** It only lists
  people who already have a public, indexable author page, so it exposes nothing the
  sitemap would not, but it must never be widened to "all users".
- **R-2 — Ship the toggle with the UI or not at all.** `default: false` means the field
  is invisible until the account form can set it. Landing the schema without the form
  produces a preference nobody can turn on.
- **R-3 — `UserSettingsWebPatchSchema` is `.strict()`.** Forgetting to add the key there
  yields a 400 whose cause is not obvious from the response.
- **R-4 — The `facet-noindex` CI guard encodes the old behavior** and will go red on the
  first indexability change. Update it in the same commit, not as a follow-up.
- **R-5 — Index transition.** Google will serve the old URLs for a while. The 301 plus
  sitemap resubmission is the whole mitigation; there is nothing else to do but wait.
- **R-6 — Cache-prefix trap.** Mounting the authors route under
  `/api/v1/public/users/...` silently classifies it private. §6.6 mounts it at
  `/api/v1/public/authors` specifically to avoid this.
- **R-7 — Deleting the old pages breaks any external deep link not covered by the
  regex.** The regex covers the whole `/publicaciones/autor` subtree, so this is only a
  risk if the pattern is narrowed during implementation.
- **R-8 — Consent copy is load-bearing.** The toggle without the explanatory copy still
  publishes data the user never knew was publishable; the copy is not polish.

## 11. Open questions

- **OQ-1** — Prolific authors: the events block is capped at 12 with no pagination
  (§6.3). Needs a look at real data — if some author already has more than ~12 events,
  decide between paginating the events block independently or linking out to a filtered
  events listing (which does not exist today).
- **OQ-2** — "Profile complete" is defined as `bio` **AND** `avatar` (§6.5). Loosening it
  to `bio` OR `avatar` would index more authors at the cost of thinner pages. Decided as
  AND; revisit if the sitemap ends up nearly empty.
- **OQ-3** — Whether `/autores/` (an index of all authors) is worth building later. Out
  of scope here (NG-1), but the `listPublicAuthors` service built for the sitemap is
  most of what it would need.
- **OQ-4** — Does `EventPublicSchema` carry the author on the detail payload? Blocks
  G-7; must be answered before the event-byline task starts (§6.9).

## 12. Implementation notes

- Two `EmptyState.astro` components exist with different prop shapes. Use
  `@/components/EmptyState.astro` (the top-level one), matching every other listing page.
- `buildUrl` is pure `` `/${locale}${path}` `` concatenation with no segment translation —
  `autores` is a fixed Spanish segment across all three locales, consistent with
  `publicaciones` and `destinos`.
- The events-by-author handler ignores every declared filter except pagination. Do not
  pass `category`/`q`/`sortBy` expecting them to work (NG-2).
- The events-by-author route is cache-covered only by the `/api/v1/public/events`
  prefix, not by an explicit entry. Moving its mount point would silently drop caching.
- `users.profile.bio` / `profile.avatar` (JSONB) are **different fields** from the
  top-level `bio` / `avatar` columns that `by-slug` actually projects. The indexability
  predicate must read the same source the response does, or the gate and the rendered
  page will disagree.

## 13. Linear

Canonical tracking:
HOS-375
