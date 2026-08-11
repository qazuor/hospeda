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
- **G-8** — System/service accounts are excluded from the public author surface by a
  **stable marker on the account**, never by a live role check — so changing someone's
  role can never publish or unpublish their author page (§6.10.1).
- **G-9** — The editorial account is reachable at a real, human-readable, environment-
  independent URL (`/autores/equipo-hospeda/`), not at the auto-generated slug it
  carries today (§6.10.2).
- **G-10** — A content-only seed data-migration actually **runs** on a fresh build
  instead of being silently stamped as applied, so a fresh dev database and a migrated
  production database converge (§6.11). This closes a pre-existing gap that this spec
  did not create but cannot ship correctly around.

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
- **NG-5** — Broad schema work. Exactly **one** additive column is introduced
  (`users.is_system_account`, §6.10.1); the social opt-in is additive inside the existing
  `settings` JSONB and needs no migration.

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

### 5.9 Who the authors actually are (measured 2026-08-02)

Queried against the worktree DB (cloned from `hospeda_dev` → `hospeda_template`), then
spot-checked against production. Every author below has both `profile.bio` and
`profile.avatar`, so **all 13 pass the §6.5 indexability gate as written**.

| slug | display name | posts | events |
|---|---|---:|---:|
| `super-admin-user` | Super Admin User | 0 | **52** |
| `admin-user` | Admin User | 5 | 12 |
| `user-76eb2960` | Equipo Hospeda | 22 | 0 |
| `carlos-martínez` | Carlos Martínez | 0 | 6 |
| `laura-vega` | Laura Vega | 2 | 5 |
| 8 more | — | 1-2 each | 0 |

Production spot-check (live, 2026-08-02):

- `GET /es/publicaciones/autor/super-admin-user/` → **200**. Its `og:title` is
  `"Super Admin - Publicaciones y Blog | Hospeda"` and the avatar `alt` is
  `"Super Admin"`. The page is only invisible because it is `noindex` today.
- `GET /es/publicaciones/autor/admin-user/` → 200.
- `GET /es/publicaciones/autor/laura-vega/` → 200.
- `user-76eb2960` → 404 (local-only seed artifact; not in production).

Two consequences, both material:

1. **The 12-item cap in §6.3 is wrong** (OQ-1).
2. **The real editorial content is attributed to staff and system accounts.** The three
   highest-volume authors are the super-admin account, the admin account, and an
   "Equipo Hospeda" account. Making the page indexable as specified would publish
   `/autores/super-admin-user/` — titled "Super Admin", listing 52 events — into
   Google and the sitemap. That is the opposite of editor recognition, and it exposes
   the site's root administrative account as a public author profile. See **OQ-5**.

The root cause is sequencing: the reward surface (this spec) is arriving before the
editors exist. HOS-374 — the flow that lets an editor load posts and events from the
web — is what will produce real, non-staff `authorId` values.

## 6. Proposed design

### 6.1 Route move

New pages, mirroring the current pair:

- `apps/web/src/pages/[lang]/autores/[slug]/index.astro`
- `apps/web/src/pages/[lang]/autores/[slug]/page/[page].astro` (posts pagination)
- `apps/web/src/pages/[lang]/autores/[slug]/eventos/page/[page].astro` (events
  pagination — new, no counterpart in the old scheme)

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
2. **Eventos** — paginated, **not capped**. Measured data (§5.9) shows the top author
   has 52 events; a fixed cap would hide 40 of them, which is the failure this spec
   exists to fix.

Two independently paginated blocks need two pagination surfaces, and neither may become
a query parameter (the repo already guards against indexable facets — see §5.6). The
scheme keeps the **posts** tail byte-identical to today's so the redirect in §6.4 stays
a pure splice, and gives events a new sub-route with no legacy equivalent:

- `/{locale}/autores/<slug>/` — page 1 of both blocks.
- `/{locale}/autores/<slug>/page/<n>/` — posts, page n. Same shape as the current
  `/publicaciones/autor/<slug>/page/<n>/`. Events block omitted.
- `/{locale}/autores/<slug>/eventos/page/<n>/` — events, page n. New; nothing redirects
  here. Posts block omitted.

Rendering both blocks again on every paginated page would duplicate the same markup
across indexable URLs, so pages `2..n` show only the block being paginated. All
paginated pages are `noindex` per §6.5.

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

1. `users.isSystemAccount` is `false` (§6.10.1), **and**
2. the author has at least one published post or event, **and**
3. `profile.bio` is non-empty, **and**
4. `profile.avatar` is non-empty, **and**
5. it is page 1 (paginated pages are always `noindex`).

Condition 1 is a **content-curation rule, not an authorization check**, so the repo's
"never check roles directly, use `PermissionEnum`" convention does not apply — there is
no permission that means "deserves a public author profile". It must carry a comment
saying so, or a future reader will «fix» it into a permission check.

It is also deliberately **not** a role check. See §6.10.1 for why.

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
applying the §6.5 predicate in full: `is_system_account = false`, ≥1 published post or
event, and non-empty `profile->>'bio'` and `profile->>'avatar'` (JSONB paths — there are
no such columns, see §12). `sitemap-dynamic.xml.ts` gains a block for it,
following the existing `buildEntriesForEntity` pattern.

The predicate lives in exactly one place and is shared with the page (§6.5), so the
sitemap can never advertise a URL the page then serves as `noindex`.

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
  This requires a **payload change**, not just markup. Verified: `EventPublicSchema`
  (`packages/schemas/src/entities/event/event.access.schema.ts:23-66`) picks
  `organizerId` and extends with `organizer` + `location`, but carries **neither
  `authorId` nor an `author` relation**. The event public payload has no author at all.

  The fix is additive and therefore allowed by the package's additive-only compat
  policy: extend `EventPublicSchema` with `author: UserAuthorPublicSchema.nullish()`,
  matching the `organizer`/`location` nullish-relation convention already used there
  (nullish covers both "relation not loaded" and "FK null on the row"). The event
  service must load the relation for the detail read path.

  Two consequences to keep in view:

  - This widens every public event response, including the cached list routes, with
    the author's `displayName`/`slug`/`avatar`. That is the same data the author page
    publishes by decision §6.5, so it exposes nothing new — but it must reuse the
    existing public projection, never a fuller user shape.
  - The payload stays **actor-blind**, so `/api/v1/public/events`'s shared caching is
    unaffected.

### 6.10 Content attribution (OQ-5 resolution)

Owner decision, 2026-08-02, on the measured state in §5.9. Three coordinated changes,
all of which must land before G-3 (indexability + sitemap) ships.

#### 6.10.1 System accounts never get a public author surface (G-8)

New column: **`users.is_system_account boolean NOT NULL DEFAULT false`**.

`true` for accounts that represent the platform rather than a person — today the two
required-seed accounts, `superadmin@hospeda.com` and `admin@hospeda.com`. Excluded from
the indexability predicate and the sitemap (§6.5 condition 1). Their pages still render
— bylines must never 404 — but stay `noindex`.

**Why a column and not the role.** The first draft of this spec excluded
`SUPER_ADMIN`/`ADMIN` by role, and that was wrong for a reason worth stating plainly:
**the role is mutable and the property is not.** Evaluating it live means promoting a
real editor to `ADMIN` silently unpublishes their author page and drops it from the
sitemap — an indexed URL disappearing as a side effect of a permissions change nobody
connected to SEO. The inverse is worse: demoting a staff account would publish it.

Being a service account is a stable fact about what the account *is*, so it is stored as
one. Role is consulted exactly **once**, at backfill time, to decide the initial value —
never at read time.

This also gets the human case right: a real person who happens to hold `ADMIN` and
writes posts keeps their author page, because they are not a system account.

**Delivery** — this is a `required`-seed-adjacent change to data that exists in
production, so the seed dual-write rule applies in full:

- schema migration for the column (`pnpm db:generate` + `pnpm db:migrate`);
- the `required` user fixtures (`packages/seed/src/data/user/required/admin-user.json`,
  `super-admin-user.json`) set `isSystemAccount: true`, so a fresh DB is built correct;
- **and** a numbered data-migration flips the flag on the two accounts in already-seeded
  environments, resolved **by email**, matching the constraint in §6.10.2.

Any future service account (importers, bots, integration users) must set this flag at
creation. Note the residual gap: the default is `false`, so a service account created
without setting it would be eligible. That is acceptable because eligibility still
requires published content plus a bio plus an avatar, which a bot account will not have
— but it is why the flag is set in the fixtures rather than left to a runtime rule.

#### 6.10.2 The editorial account gets a real slug (G-9) `0025-seed-real-blog-posts.ts:156-171`

creates the editorial author (`role: RoleEnum.EDITOR`, `displayName: 'Equipo Hospeda'`)
**without setting a slug**, so it auto-generates from the row id and is therefore
**different in every environment**: `user-95c2cd4b` in production, `user-76eb2960`
locally. Indexing that as the permanent URL of the site's main editorial voice is not
acceptable, and it cannot be fixed later for free once Google has it.

The account is assigned the slug `equipo-hospeda`.

> **This is the single most important implementation constraint in this spec.** The
> migration must resolve the account **by `EDITORIAL_EMAIL`**, exactly as
> `ensureEditorialAuthor` already does (`findOne({ email: EDITORIAL_EMAIL })`). Never by
> slug and never by id — both differ per environment, so a hardcoded value silently
> targets the wrong row (or no row) outside the machine it was written on.

No redirect is owed from the old auto-slug: that page is `noindex` today, so there is
nothing indexed to preserve.

#### 6.10.3 The imported events are re-attributed to the editorial account The 44 production

events (52 locally) carry `author_id` = super-admin and `created_by_id` = `NULL` — the
signature of `0027`/`0028`'s bulk import, not of a human using the UI. Attributing
platform-curated editorial content to the editorial team account is the accurate
description of who curated it; the super-admin attribution is an artifact of the import
running under the super-admin actor.

Scope the update precisely: `author_id = <super-admin id>` **AND** `created_by_id IS
NULL`. Anything a human actually created keeps its author.

**Delivery** — items 2 and 3 are content changes to data already live in production, so
each needs a numbered migration via `pnpm db:seed:make <slug>` in
`packages/seed/src/data-migrations/`, per the seed dual-write rule.

> **Mechanics verified (T-001, 2026-08-02)** — full analysis in
> [`docs/seed-migration-mechanics.md`](docs/seed-migration-mechanics.md).
>
> The dual-write rule splits differently here than first assumed:
>
> - **M-A has a real baseline** — the `required` user fixtures. Ordinary dual-write.
> - **M-B and M-C have no baseline to edit at all.** The rows they act on do not exist
>   on a fresh build, because the migrations that create them (`0025`, `0027`, `0028`)
>   are themselves content-only and get their own `up()` skipped. No edit under
>   `packages/seed/src/data/**` can fix that — the content lives only inside those
>   migration files, deliberately (`0025`'s docstring: keep production content cleanly
>   separate from the demo `example` posts).
>
> This is resolved by §6.11, not by chasing a fixture that does not exist.

**Result in production**: one indexable author page, `/es/autores/equipo-hospeda/`,
with 22 posts and 44 events — both blocks populated, which is precisely the page this
spec set out to build. Real editors arriving via HOS-374 join the surface with no
further work.

### 6.11 Content-only migrations must run on a fresh build (G-10)

**The pre-existing gap.** `pnpm db:fresh-dev` (`package.json:58`) ends with
`seed --data-migrate --baseline-stamp`. In `packages/seed/src/cli.ts:256-265`,
`handleDataMigrate` **early-returns** when `baselineStamp` is set, so `runMigrations`
never executes. `baselineStamp()`
(`packages/seed/src/data-migrations/baselineStamp.ts:101-124`) then walks every pending
migration and calls `recordApplied({ result: 'baseline-stamp' })` **without ever calling
`up()`** — it is entirely content-blind and does not consult `meta.group`.

That is correct for a migration whose end state is already baked into a fixture. It is
wrong for a migration that *is* the only source of its content. Today the consequence is
that a fresh `db:fresh-dev` database has **no editorial account, no real blog posts and
no Entre Ríos events**, and because the ledger now marks them applied they can never run
later without manual intervention.

Verified empirically: in the worktree database (cloned from `hospeda_template`),
`seed_migrations` shows `result = 'ok'` with real durations for `0025`/`0027`/`0028` —
that template was built with a genuine `db:seed:migrate`, which is why the content is
present locally and the gap is invisible at a glance.

**The fix.** A new optional field on `SeedMigrationMeta`
(`packages/seed/src/data-migrations/types.ts:39-62`), mirroring the existing
`destructive?: boolean` precedent:

```ts
/**
 * Marks a migration whose rows have NO fixture baseline — the migration file
 * itself is the only source of that content. Baseline-stamping must not skip
 * it: on a fresh build it has to actually run, or the content never exists.
 *
 * @default false
 */
readonly contentOnly?: boolean;
```

Behavior change in `handleDataMigrate` when `--baseline-stamp` is passed:

1. `baselineStamp()` stamps every pending migration **except** those with
   `contentOnly: true`, which it leaves pending.
2. It then falls through to `runMigrations()`, which runs exactly those.

One command, one flag, no hardcoded list. That last point is the whole reason for
choosing a declared flag over extending the npm script with a list of migration names:
`docs/deployment/first-time-setup.md:810-827` already carries such a list and it is
**already stale** — it names only `0025`, while `0027` and `0028` have the identical gap.
A mechanism that drifts is how the current bug stayed invisible; the flag cannot drift
because it lives on the migration it describes.

**Backfill.** `0025-seed-real-blog-posts.ts`, `0027-add-confirmed-events-entre-rios-2026.ts`
and `0028-add-estimated-events-entre-rios.ts` are marked `contentOnly: true`, as are this
spec's own M-B and M-C. M-A is **not** — it has a real fixture baseline.

**Scope boundary — read this before assuming the fix is retroactive.** This only changes
**future** fresh builds. An environment where those migrations are already ledgered
(stamped or applied) is unaffected, by design: the ledger is respected. A dev database
that was previously built with `db:fresh-dev` and therefore has them stamped-but-not-run
stays broken until it is rebuilt. Say so in the PR — it is not a silent condition.

**Follow-up, out of scope here**: `first-time-setup.md`'s re-run list is stale
independently of this spec, meaning the documented production day-1 bootstrap ships zero
Entre Ríos events today. The flag makes that list unnecessary; removing or correcting it
is part of T-038.

## 7. Data model / contracts

| Change | Where | Migration |
|---|---|---|
| `publicProfileShowSocialNetworks?: boolean` (default `false`) | `UserSettingsSchema` | none — additive JSONB |
| same key allowed on write | `UserSettingsWebPatchSchema` (`.strict()`) | none |
| `socialNetworks?: SocialNetwork` (conditional) | `UserAuthorPublicResponseSchema` | none |
| `GET /api/v1/public/authors` | new route + `listPublicAuthors` service | none |
| `/api/v1/public/authors` added | `PUBLIC_CACHE_ENDPOINTS` | none |
| `eventsApi.getByAuthor` | `apps/web/src/lib/api/endpoints.ts` | none |
| `author?: UserAuthorPublic` (nullish relation) | `EventPublicSchema` + event service detail read | none — additive |

One **schema** migration and three **seed data-migrations**:

| # | Kind | What | Resolve by |
|---|---|---|---|
| 1 | schema | `users.is_system_account boolean NOT NULL DEFAULT false` (§6.10.1) | — |
| 2 | data | flip `is_system_account = true` on the two required-seed staff accounts | email |
| 3 | data | set the editorial account's slug to `equipo-hospeda` (§6.10.2) | `EDITORIAL_EMAIL` — never slug or id |
| 4 | data | move events with `author_id = <super-admin>` **and** `created_by_id IS NULL` to the editorial account (§6.10.3) | the same email lookup |

Migration 1 also requires the `required` user fixtures to carry `isSystemAccount: true`
(the baseline half of the dual-write rule). Migrations 2-4 change data already live in
production — see the verification caveat in §6.10.2 before authoring them.

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
- **AC-13** — An account with `is_system_account = true` is `noindex` and absent from
  the sitemap even when it has published items, bio and avatar.
- **AC-16** — Changing an account's role does not change its indexability. Concretely:
  an eligible author promoted to `ADMIN` stays indexable and stays in the sitemap, and a
  system account demoted to `EDITOR` stays excluded. This is the regression test for
  the R-9 class of bug and must assert both directions.
- **AC-17** — `/es/autores/equipo-hospeda/` resolves in every environment, and the
  editorial account is never referenced by its auto-generated slug or row id anywhere in
  code, fixtures, or migrations.
- **AC-14** — After the migrations, production resolves `/es/autores/equipo-hospeda/`
  with both blocks populated (22 posts, 44 events), and no event remains attributed to
  the super-admin account with `created_by_id IS NULL`.
- **AC-15** — A fresh `pnpm db:fresh-dev` produces the same editorial slug and the same
  event attribution as a migrated production database — **without any manual step**.
  Concretely, on a database built by that single command: the editorial account's slug is
  `equipo-hospeda`, both staff accounts have `is_system_account = true`, and zero events
  remain attributed to the super-admin with `created_by_id IS NULL`. This is only
  reachable via G-10 (§6.11); it was structurally impossible before that change, so a
  failure here means the `contentOnly` wiring is wrong, not that a fixture is missing.
- **AC-18** — `seed_migrations` rows for `contentOnly` migrations show
  `result = 'ok'` (actually ran), not `result = 'baseline-stamp'`, after a fresh
  `db:fresh-dev`. Non-`contentOnly` migrations still show `baseline-stamp`.
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
- ~~**R-9** — Promoting an editor to ADMIN silently unpublishes their author page.~~
  **Designed out, not accepted.** The gate no longer reads the role at request time; it
  reads `users.is_system_account`, which does not change when a role changes (§6.10.1,
  G-8). The residual risk moved to R-12.
- **R-12 — A future service account created without setting `is_system_account`
  defaults to eligible.** The column defaults to `false`, so a new bot/importer account
  is only kept out by the content/bio/avatar conditions. Mitigated by setting the flag in
  the `required` fixtures and documenting it, but any code path that creates service
  accounts must set it explicitly.
- **R-10 — The editorial slug is environment-dependent.** It is `user-95c2cd4b` in
  production and `user-76eb2960` locally because `0025` never sets one. Any migration,
  test fixture, or hardcoded reference keyed on that slug or on the row id works on one
  machine and silently no-ops everywhere else. Resolve by `EDITORIAL_EMAIL` only (§6.10).
- **R-11 — Re-attribution is a production content change.** It rewrites `author_id` on
  44 live rows. Scope it to `created_by_id IS NULL` so nothing a human authored is
  touched, and verify the affected count before and after.

## 11. Open questions

- ~~**OQ-1** — Prolific authors: is the 12-cap on the events block enough?~~
  **Resolved 2026-08-02: no, by a wide margin.** Measured author distribution (§5.9):
  the top author has **52 events**, the second has 12. A 12-item cap would hide 40
  events from the single most prolific author — the exact failure this spec exists to
  fix. **§6.3 must paginate the events block**, not cap it. See OQ-5 first: the
  attribution finding may change who these blocks belong to.
- ~~**OQ-5** — how are staff/system accounts kept out of the public author surface?~~
  **Resolved 2026-08-02 by the owner**: exclude system roles from the gate, give the
  editorial account a real slug, and re-attribute the imported events to it. Fully
  specified in §6.10.

- **OQ-2** — "Profile complete" is defined as `bio` **AND** `avatar` (§6.5). Loosening it
  to `bio` OR `avatar` would index more authors at the cost of thinner pages. Decided as
  AND; revisit if the sitemap ends up nearly empty.
- **OQ-3** — Whether `/autores/` (an index of all authors) is worth building later. Out
  of scope here (NG-1), but the `listPublicAuthors` service built for the sitemap is
  most of what it would need.
- ~~**OQ-4** — Does `EventPublicSchema` carry the author on the detail payload?~~
  **Resolved 2026-08-02: no.** It carries neither `authorId` nor an `author` relation.
  G-7 therefore includes an additive schema + service change, specified in §6.9.

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
- **`users` has no `bio` and no `avatar` column.** Verified against the live schema:
  the public profile's `avatar` and `bio` both come from the `profile` JSONB —
  `user.profile?.avatar` / `user.profile?.bio` in
  `UserService.getPublicProfileBySlug` (`packages/service-core/src/services/user/user.service.ts:317-323`).
  The indexability predicate (§6.5) and the `listPublicAuthors` query (§6.6) must
  therefore filter on `profile->>'avatar'` and `profile->>'bio'`, not on columns that
  do not exist.
- There **is** a top-level `users.image` column (plus `image_public_id`,
  `image_moderation_state`, `image_caption`). The public author profile does **not**
  use it. Do not reach for `image` as "the avatar" — the two are different fields and
  only `profile.avatar` is what the page renders today.

## 13. Linear

Canonical tracking:
HOS-375
