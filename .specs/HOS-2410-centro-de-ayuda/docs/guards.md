# HOS-2410 — Guards

Normative for the four help guards, the lock and the exemptions. Parent:
[`../spec.md`](../spec.md). Data model: [`data-model.md`](data-model.md).

## 1. Overview

| Guard | Script | Root script | Fails on | Replaces |
|---|---|---|---|---|
| (a) existence | `scripts/check-help-catalog.ts` | `check:help-catalog` | Anything in the catalog that does not resolve or does not parse | `scripts/check-owner-help.ts` (deleted) |
| (b) reverse coverage | `scripts/check-help-coverage.ts` | `check:help-coverage` | An owner-facing surface with no article and no exemption | — |
| (c) change coupling | `scripts/check-help-lock.ts` | `check:help-lock` | Anchored code changed and the article was not re-reviewed | — |
| (d) values | `scripts/check-help-values.ts` | `check:help-values` | A literal price, plan name or plan limit in content | — |

Every guard:

- runs as **its own step** in the CI `Guards` job, next to the current help step
  (`.github/workflows/ci.yml:415-427`), **and** is chained into `check:guards`
  (`package.json:59`);
- has a header with "What it checks", "What it reports without failing" and
  "What it does NOT see", in the style of `scripts/check-owner-help.ts:1-43`;
- exits 0 when clean and 1 on a violation, names the predicate letter and the
  article id, and prints the fix command;
- has a non-vacuity predicate: an empty input set fails, as
  `check-owner-help` (d) and `check-portal-routes` (e) do today;
- exports pure predicate functions, tested in `scripts/__tests__/check-help-*.test.ts`
  with synthetic fixtures (§7).

`check:portal-routes` is unchanged except for its import path (`@repo/portal-routes`).

## 2. Guard (a) — existence (`check-help-catalog`)

Checks (each a predicate letter):

- a1 Every content file parses and its frontmatter passes `HelpArticleFrontmatterSchema`.
  Body rules hold (`data-model.md` §3), including the 5 000-char ceiling. Layout
  rules R-1…R-4 hold.
- a2 Every `destinations` entry resolves to a page, through `portalDestinationTemplate`
  and `pageExists`, the same logic `check-owner-help.ts` (a) uses today.
- a3 Every `faqKey` is an item of `packages/i18n/src/locales/es/faq.json`
  (`categories.<c>.items.<i>`).
- a4 Every `reviewedAt` (and `translation.sourceReviewedAt`) is a real date and not
  in the future, in Argentina local date.
- a5 Every `covers` and `entryFor` anchor resolves (`data-model.md` §2.2). Every
  `entryFor` anchor is unique across the catalog.
- a6 Every token parses. Every `limit` key, `link` target/argument and `article` id
  exists. A `limit` token without a vertical in a multi-vertical article fails.
- a7 Every `related` id exists, is not the article itself, and is unique.
- a8 The committed `generated/help-index.json` equals a fresh in-memory generation
  byte for byte. Fix: `pnpm help:build`.
- a9 The catalog has at least one article per audience in `HELP_AUDIENCES`
  (non-vacuity; until Phase 5 only `host` and `provider` would hold, so this
  predicate turns on in the closing PR. Before that: at least one article
  overall).

Reports without failing: articles with `reviewedAt` older than 180 days
(`OWNER_HELP_STALE_DAYS` carries over); translations older than their es source.

Does NOT see: whether a step is true; pages that exist but redirect or 403;
whether a FAQ item still agrees with the article; whether a `section` slug still
belongs to the section the article talks about (only that its page exists, the
same blind spot as `check-portal-routes.ts:39-40`); and `helpTopicId` literals in
API refusals (none exist today, so there is nothing to check).

## 3. Guard (b) — reverse coverage (`check-help-coverage`)

### 3.1 The universe (computed, fail-closed)

The guard enumerates each set from code at run time. It never reads a curated
list:

| Set | Source | Unit | Covered by |
|---|---|---|---|
| Account pages | every `.astro` under `apps/web/src/pages/[lang]/mi-cuenta/` (77 today) | `page:<template>` | an `entryFor` |
| Editor sections | per vertical, the slugs of the web editor registries (§2.2 of the data model). `[vertical]` pages expand over `venue` and `experience` | `section:<v>.<slug>` | an `entryFor` |
| Entitlement keys | `EntitlementKeyEnum` (59 today) | `entitlement:<k>` | any `covers` |
| Limit keys | `LimitKeyEnum` (23 today) | `limit:<k>` | any `covers` |
| MCP tools | every `name: '<x>'` of a tool listed in `MCP_TOOL_DEFINITIONS` (22 today, `registry.ts:33-55`) | `tool:<x>` | any `covers` |

A unit is satisfied when an article covers it as listed, **or** when it appears
in `packages/help/coverage-exemptions.json`.

### 3.2 Exemption file

```jsonc
[
  { "anchor": "page:mi-cuenta/favoritos", "kind": "out-of-scope", "reason": "Tourist page (NG-1)." },
  { "anchor": "page:mi-cuenta/comercio/nuevo", "kind": "no-user-surface", "reason": "301 to /publicar (HOS-1156 D-6)." },
  { "anchor": "limit:max_favorites", "kind": "out-of-scope", "reason": "Tourist limit (NG-1)." },
  { "anchor": "section:venue.carta", "kind": "pending-content", "reason": "Phase 5 venue PR.", "plannedArticle": "venue-menu" }
]
```

- `kind` ∈ `out-of-scope` (tourist, editorial), `no-user-surface` (redirects,
  password/profile-completion flows, keys with no gate in code today: the comment at
  `packages/schemas/src/catalog/entitlement-keys.ts:7-10` says some exist only in
  the catalog), `pending-content` (HOS-2410 only).
- `reason` is non-empty. `plannedArticle` is required for `pending-content`.
- b1 Every universe unit is covered or exempt.
- b2 Every exemption names a unit that exists in the universe (no stale exemptions).
- b3 No unit is both covered and exempt.
- b4 Non-vacuity: every universe set is non-empty.

### 3.3 The `pending-content` ratchet

PR-4 seeds one `pending-content` entry per uncovered in-scope unit from the
inventory. A test pins their count (`MAX_PENDING_CONTENT = <n>`). Each Phase 5
PR lowers the constant by exactly the entries it removes. Raising it is visible
in review. The closing PR removes the `pending-content` kind from the schema
entirely (AC-38), so after HOS-2410 a new feature must ship its help or justify
an exemption.

Does NOT see: whether the covering article really explains the unit (only that
it names it); owner-facing surfaces outside the five sets (emails, crons, the
`publicar/*` funnels, `planes/*`). Those are inventoried in Phase 1 and covered
by content, without a gate; a new email gets no CI failure. It also cannot tell
an owner page from a tourist page by itself: that classification is the
exemption file's.

## 4. Guard (c) — change coupling (`check-help-lock`)

### 4.1 Lock file

`packages/help/help.lock.json`: one JSON object per line inside an array, sorted
by `id`, so that parallel PRs touching different articles merge cleanly:

```jsonc
[
{"id":"addons","reviewedAt":"2026-11-17","hash":"<sha256 of the sorted anchor hashes>","anchors":{"page:mi-cuenta/complementos":"<sha256>"}},
{"id":"photos","reviewedAt":"2026-11-17","hash":"…","anchors":{"limit:max_photos_per_accommodation":"…","section:accommodation.fotos":"…"}}
]
```

### 4.2 What each anchor hashes (noise control)

Hash inputs are as narrow as the anchor's meaning. Text is LF-normalized before
hashing. A value hash is taken over canonical JSON (sorted keys).

| Anchor | Hashed input | Why this and not more |
|---|---|---|
| `page:` | the page `.astro` file only | Components are not followed; a change three imports deep does not flag every article. Use `file:` for a component that matters |
| `section:` | the section page file + the catalog entry for that section in `LISTING_SECTIONS` (`packages/schemas/src/catalog/listing-sections.ts:5`) when one exists | A field added to the section is a real change; a change to another section is not |
| `entitlement:` / `limit:` | the key's definition row (`[key, scope, aggregation, enforcement, class]`, `entitlement-keys.ts:12`) | Not the whole catalog file. Values are DB rows and never hashed |
| `enum:` | the full value set of the vocabulary | A new state should prompt a review of the articles that explain states |
| `tool:` | the source file that defines the tool | Description and input schema live there |
| `activation:` | the vertical's entry in `VERTICAL_ACTIVATION_EVENT_BY_VERTICAL` | |
| `file:` | the file | Explicit opt-in |

### 4.3 Predicates

- c1 Every article has a lock entry, and every lock entry has an article (no orphans).
- c2 For every article, the freshly computed per-anchor hashes equal the lock's
  `anchors`, and the anchor set equals `covers ∪ entryFor`. On mismatch, the
  message lists the changed anchors and says: re-read the article against the
  portal, edit it if needed, then run `pnpm help:review <id>`.
  An anchor covered by several articles (siblings under D-H11) is hashed in each
  of their lock entries, so one change flags every sibling. There is no
  "primary home" that could leave a sibling unflagged. Mutation test: change one
  entitlement row that two articles cover; both must go red.
- c3 The lock entry's `reviewedAt` equals the article's frontmatter `reviewedAt`.
- c4 Non-vacuity: the lock is not empty when the catalog is not.

### 4.4 Commands (exact)

| Command | Effect |
|---|---|
| `pnpm help:review <id> [<id>…]` | For each id: set frontmatter `reviewedAt` to today (Argentina local date), recompute its anchor hashes, rewrite its lock line, then run `help:build`. Refuses unknown ids. Never touches other articles |
| `pnpm help:review --list` | Print the ids whose hashes differ from the lock, with the changed anchors. No writes. Exit 0 |
| `pnpm check:help-lock` | The guard. No writes |

There is no "accept everything" command on purpose: one would turn the guard
into a rubber stamp.

Does NOT see: a hand-edited lock (a forged hash passes; review is the control);
behaviour that changed without the hashed file changing (a component, a service,
a DB row: plan values, deadlines); whether the review actually happened, only
that the date moved.

## 5. Parallel work and conflicts

- Different articles touch different lock lines and different files, so
  git merges them without conflict.
- If two PRs change the same article, or code anchored by it, resolve the
  conflict by taking either side, then re-run `pnpm help:review <id>` after
  re-reading the article. CI re-checks after the merge.
- `coverage-exemptions.json` uses the same one-entry-per-line, sorted layout.

## 6. Guard (d) — values (`check-help-values`)

The existing `check:commercial-values` only scans billing TS sources
(`scripts/check-commercial-values-in-code.ts:9`). It never sees content. Guard (d)
scans `title`, `summary`, `keywords` and every body section of every locale, with
tokens removed and accents folded.

- d1 Currency: a number next to a currency marker (`$`, `ARS`, `USD`, `U$S`, `US$`,
  `peso(s)`, `dólar(es)`), on either side, spaced or glued (`15USD`, `USD15`,
  `15pesos`). A word marker is bounded by letters only, so `marsupial 15` passes.
- d2 Plan names: whole-word, case- and accent-insensitive matches against
  `PLAN_TIER_WORDS` (`basico, basic, profesional, professional, premium, gold,
  silver, vip`). A companion test reads every `INSERT INTO "plan"` row name in
  `packages/db/src/migrations/*.sql` (e.g. `0144_production_plan_catalog.sql:3-14`)
  and fails if a sellable plan name is missing a word the guard would need. It
  requires only the words that tell a plan apart from the other sellable plans of
  the same vertical (`role` NULL), not every word of the name: shared words such
  as the vertical's own name are not plan names. `pro` is deliberately not in the
  list (it is an ordinary Spanish word).
- d3 Limits: a number within three words of a limit noun (`foto(s)`,
  `publicacion(es)`, `alojamiento(s)`, `comercio(s)`, `experiencia(s)`,
  `promocion(es)`, `galeria(s)`, `cuenta(s)`, `consulta(s)`, `mes(es)`, `dia(s)`), or
  after `hasta | maximo | minimo | tope de`. Numbers and letters are split before
  matching, so `20fotos` reads as `20 fotos`. Allowed: a number directly followed
  by a unit in `TECHNICAL_UNITS` (`MB, KB, GB, px, caracteres`). Those are
  technical constants, not plan values.
- d3 escape, `FROZEN_SYSTEM_CONSTANTS` (`scripts/check-help-values.ts`): a system
  constant that reads like a limit but is not a plan value (today only
  `descripcion (minimo 20)` in `publish-requirements`, the publish validation of
  the description length). Each entry is an exact folded phrase bound to ONE
  article id, with a written reason. The phrase is removed from that article only
  before scanning; the same words in any other article still fire. An entry whose
  phrase no longer appears in its article fails d3 as stale, so the list can only
  shrink to what is still true. Adding an entry is visible in review.
- d4 Non-vacuity: at least one article scanned.

Does NOT see: numbers written as words ("cinco fotos"); a plan named with a
word not in the list; a commercial claim without a number ("los planes
superiores incluyen…"); a technical unit misused for a plan limit; a plan limit
inside a phrase listed in `FROZEN_SYSTEM_CONSTANTS` for that article.

## 7. Acceptance criteria and mutation tests

Each AC is a test that feeds a synthetic catalog (a temp dir) to the exported
predicate and asserts the exact predicate letter. The real-repo run must be green.

| AC | Mutation | Expected |
|---|---|---|
| AC-24 | Rename a page that a destination points at | (a2) fails |
| AC-25 | `faqKey: owners.nope` | (a3) fails |
| AC-26 | `covers: [limit:max_nope]`, `tool:nope`, `enum:TrialStatus.NOPE`, `section:venue.nope` (one test each) | (a5) fails |
| AC-27 | `{{link:plans}}` without vertical; `{{article:nope}}`; `{{limit:max_photos_per_accommodation}}` in a 3-vertical article | (a6) fails |
| AC-28 | Edit one character in `generated/help-index.json` | (a8) fails |
| AC-29 | Add a fake `mi-cuenta/zz/index.astro` to the fixture pages dir; add `zz_key` to a fixture `LimitKeyEnum` | (b1) fails, naming the unit |
| AC-30 | Exemption for `page:mi-cuenta/does-not-exist` | (b2) fails |
| AC-31 | Append a line to an anchored page file without `help:review` | (c2) fails, listing that anchor. After `help:review <id>`, passes |
| AC-32 | Change `reviewedAt` in the frontmatter only | (c3) fails |
| AC-33 | Body text "hasta 20 fotos", "$ 15.000", "plan Premium" (one test each); "hasta 10 MB" | (d3), (d1), (d2) fail; the MB case passes |
| AC-34 | Empty content dir / empty universe set / empty lock | (a9 or a1), (b4), (c4) fail |

The table above is the non-vacuity proof: each guard's real predicate must flag
a known-bad synthetic input. A refactor that neuters a predicate then fails its
test instead of going quiet. This is the pattern of the session-blind guard
(`apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts:50-54`,
`:407`). The implementer must also hand-mutate each predicate once (for example
`return []`), see its test fail, and record that in the PR description. A
mutation counts only when a non-zero number of tests ran.
