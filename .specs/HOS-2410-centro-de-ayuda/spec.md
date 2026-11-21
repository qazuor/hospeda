---
title: Client help center — Markdown help package, account help pages, layered staleness guards, MCP and export
linear: HOS-2410
statusSource: linear
created: 2026-11-20
decisionsResolvedOn: 2026-11-20
type: feature
related:
  - HOS-2335   # created the TS help catalog this spec replaces (§5.4, §6.8)
  - HOS-2333   # the `get_help` child of HOS-2335
  - HOS-2341   # two owner FAQ items describe features the portal lacks (§9, D-H7)
areas:
  - web
  - api
  - content
  - devops
smokeLabels:
  # The index must ship inside the API and web containers (Coolify), `get_help`
  # must answer from it with a real MCP client, and the help pages and «?» buttons
  # must render against real accounts of each audience. None of that is visible
  # in CI.
  - status-needs-smoke-staging
---

# Client help center

## 1. Summary

The owner asked (2026-11-20) for a help section for the people who publish on
Hospeda: accommodation hosts, venue owners (gastronomy and nightlife),
experience operators, partners and directory providers. It explains what they
can do, how, what to expect and what not to expect, down to the detail. The same
content feeds the MCP tool `get_help` and is exported as Markdown for flyers and
publications. A layered guard keeps it from going stale when code changes.

The owner decided the shape (§1.1). This spec makes those decisions precise,
fixes the parts they left open (D-H1…D-H7, §9), and splits the work into six
phases (§7).

Auxiliary documents (each one is normative for its topic):

| File | Holds |
|---|---|
| [`docs/data-model.md`](docs/data-model.md) | Content layout, exact frontmatter schema, body sections, index JSON, token grammar and resolution, locales, the 16-topic migration table |
| [`docs/guards.md`](docs/guards.md) | The four guards (existence, reverse coverage, change coupling, values), the lock file and its commands, exemptions, blind spots, mutation tests |
| [`docs/web-ui.md`](docs/web-ui.md) | Pages, islands, search, the «?» button, navigation entry, states and accessibility |
| [`docs/inventory-format.md`](docs/inventory-format.md) | Phase 1: the inventory's output format, acceptance criteria and the size estimate |

### 1.1 Owner decisions (2026-11-20, not re-opened here)

| # | Decision |
|---|---|
| O-1 | Markdown content in a new package `packages/help` (`@repo/help`), one `.md` per article, YAML frontmatter validated by Zod; a build step produces `help-index.json` used by web, API/MCP and export. It replaces `apps/api/src/data/owner-help/` and keeps the 16 topic ids. |
| O-2 | Frontmatter keeps `id, title, keywords, destinations, faqKey, reviewedAt` and adds `audiences[], verticals[], summary, related[], covers[]`. Destinations go through the portal route map, never raw URLs. |
| O-3 | Fixed sections: Qué podés hacer · Cómo se hace · Qué esperar · Qué NO esperar · Problemas comunes · Relacionados. "Cómo se hace" holds the ordered steps `get_help` returns. |
| O-4 | Web UI in `apps/web`: landing by audience at `/[lang]/mi-cuenta/ayuda/`, search with no new dependency, article page with side index and related articles, a «?» button in every editor section and `/mi-cuenta` page, an account-menu entry. |
| O-5 | Layered guards: (a) existence, (b) reverse coverage, (c) change coupling through `help.lock.json`, (d) no literal commercial values; each with a "does NOT see" header and mutation-style tests. |
| O-6 | New `partner` audience. Tourists are out of scope. |
| O-7 | es first; en/pt later with a machine-translation mark like What's New. |
| O-8 | `get_help` reads the new index, returns the body sections, adds `partner`; backward-compatible where possible. |
| O-9 | `hops help export --audience <a>` outputs a Markdown bundle. |

## 2. Problem and current baseline

- **The only how-to help is a 16-topic TS catalog inside the API.** Its types are
  in `apps/api/src/data/owner-help/owner-help.types.ts:21-80` and its Zod schema in
  `owner-help.ts:134-151`. The topics are split over three files in
  `data/owner-help/topics/` (11 `any`, 4 `host`, 1 `provider`). A topic has steps
  only (`owner-help.types.ts:62-63`, max 8, `:77`). It has no "what to expect",
  no "what not to expect" and no troubleshooting. The web cannot read it: the
  file is API code.
- **`get_help` is the only consumer.** Input: `question | topicId`, plus
  `audience ∈ host|venue|experience|provider` (`apps/api/src/mcp/tools/help/get-help.ts:57-92`).
  Output: `topics[{id,title,steps,links}]`, plus `fallbackLinks` and `note` when
  nothing matches (`:95-114`). Search is a normalized keyword match
  (`help-search.ts:82-90` tokenizer; scoring thresholds `:29-35`).
- **Staleness control is existence-only.** `scripts/check-owner-help.ts:10-41`
  checks that destinations resolve, that `faqKey` exists and that dates are
  valid. Topics older than 180 days are only reported. Its own header says it
  cannot see whether a step is still true (`:31-35`). Nothing ties a topic to
  the code it describes, so changing a flow never fails CI.
- **The portal route map is API-private.** `apps/api/src/mcp/portal/portal-routes.ts:42-93`
  is a deliberate copy of the web's paths, kept honest by
  `scripts/check-portal-routes.ts:1-48`. It imports only types from
  `@repo/schemas` (`portal-routes.ts:30`), so it can move to a shared package.
- **HOS-2335 planned a move to `@repo/i18n`** "when the web gets a help page"
  (HOS-2335 spec §5.4). O-1 supersedes that with `packages/help`.
- **`/mi-cuenta` is NOT bound by the session-blind guard.** The guard exempts the
  whole prefix: "The account area IS the personalized surface. Never cacheable"
  (`apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts:86-89`).
  Sibling pages read `Astro.locals.user` only to redirect a guest
  (`apps/web/src/pages/[lang]/mi-cuenta/novedades/index.astro:19-23`,
  `asistentes-ia/index.astro:25-29`). The request premise ("every page in
  `src/pages` must stay session-blind") therefore does not bind these pages.
  This spec still keeps them free of per-user SSR content (D-H4).
- **Audience cannot be resolved on the server.** The SSR sidebar only has role
  approximations (`apps/web/src/lib/nav-gating.ts:8-17`). Partner and provider
  status come from row ownership, with no permission to read: see
  `mi-cuenta/partner/index.astro:9-12` and `mi-cuenta/aliados/index.astro:9-14`
  (`GET /partners/mine`, `GET /host-trades/mine`). That is why audience
  preselection is a client island.

## 3. Goals

- G-1 One source of help content, in Markdown, editable without touching code,
  read by the web, the MCP tool and the export.
- G-2 Every article has the same six sections, so readers and agents know where
  to look.
- G-3 Help for all five audiences, covering every owner-facing page, editor
  section, entitlement/limit key and MCP tool (or an explicit, reasoned
  exemption).
- G-4 A code change to an anchored surface fails CI until the article that
  describes it is re-reviewed.
- G-5 Content never states a price, plan name or plan limit literally.
- G-6 Locales can be added later without moving files or changing the schema.

## 4. Non-goals

- NG-1 Tourist help (O-6). Tourist-only pages and keys are exempt (§ guards (b)).
- NG-2 Editorial/contributor help (`mi-cuenta/publicaciones/*`, `mi-cuenta/eventos/*`). Exempt, reason recorded.
- NG-3 en/pt content. Only the UI chrome ships in es/en/pt. The schema and paths reserve locales (`docs/data-model.md` §6).
- NG-4 Semantic or embedding search (HOS-2335 §5.4 kept it keyword-only; unchanged).
- NG-5 Fixing the public FAQ text (HOS-2341 owns it; D-H7).
- NG-6 Refactoring the web's own route strings onto the shared route map. The web keeps its file routes; only help code consumes the shared map.
- NG-7 Admin editing UI for help. Articles are edited as files in PRs.
- NG-8 A public (signed-out) help surface. See OQ-3.

## 5. Architecture

### 5.1 Packages and who imports what

```text
@repo/schemas ──types──▶ @repo/portal-routes ◀────────────┐
      ▲                        ▲                           │
      │                        │                           │
      └────────────── @repo/help (index loader, search, tokens, render helpers)
                               ▲                ▲
                     apps/api (get_help)   apps/web (help pages, «?» button)
scripts/check-help-*.ts ──▶ @repo/help, @repo/portal-routes, @repo/schemas, file system
hops help export ──spawns──▶ pnpm --filter @repo/help export
```

- **`@repo/portal-routes`** (new, D-H1): `portal-routes.ts`, `build-portal-url.ts`
  and `portal-destination.ts` move here verbatim from `apps/api/src/mcp/portal/`.
  `activity-target-url.ts` stays in the API because it is MCP-activity specific.
  Every importer of the three modules changes its import path, with no behaviour
  change. That is about ten API files outside `mcp/portal/` (e.g.
  `mcp/tools/tool-definition.ts`, `listing/create-listing.ts`,
  `plan/my-plan-reader.ts`), their tests, and `scripts/check-portal-routes.ts`.
  `rg -l "mcp/portal/"` lists them. New destination kinds:
  `partnerPanel` (`mi-cuenta/partner`), `helpLanding` (`mi-cuenta/ayuda`) and
  `helpArticle` (`mi-cuenta/ayuda/[id]`). `check-portal-routes` keeps its five
  predicates and changes only its import path.
- **`@repo/help`** (new): `content/<locale>/<audience-folder>/<id>.md`, the Zod
  schemas, the parser/generator (dev-only), the committed generated index, the
  shared search (moved from `apps/api/src/mcp/tools/help/help-search.ts`), the
  token resolver, and `help.lock.json`. Runtime exports import zod,
  `@repo/portal-routes` and types from `@repo/schemas`. They do not import
  `yaml` or `marked`, which are used only by the generator.
- `apps/api/src/data/owner-help/` and `scripts/check-owner-help.ts` (+ test) are
  deleted in Phase 2. Their checks reappear in guard (a).

### 5.2 Build of the index (D-H2)

- `pnpm help:build` (root script → `pnpm --filter @repo/help generate`) parses
  every `.md`, validates it (schema + section rules + token syntax). It then writes
  `packages/help/generated/help-index.json`, deterministically: sorted keys,
  articles sorted by id, 2-space indent, trailing newline.
- **The index is committed**, like `apps/api/src/routes/ai/protected/poi-allowlist.generated.json`
  (imported at `poi-allowlist.ts:62`). Guard (a) regenerates it in memory and
  fails if the committed file differs. Why commit it:
  1. The API resolves `@repo/*` from source through tsconfig paths in dev and
     tests (`apps/api/tsconfig.json:8-12`). A gitignored artifact would need a build
     before every `tsx watch`, every vitest run and every guard.
  2. hops runs on bun outside the workspace (`scripts/client-tools/README.md:184-201`).
  3. Diffs of the index make content changes reviewable in the rendered shape.
- `@repo/help` exports `HELP_INDEX`. It is the JSON imported with
  `with { type: 'json' }` and parsed by `HelpIndexSchema` at module load. A
  malformed index throws at boot, the same contract as today's catalog
  (`owner-help.ts:174`).

### 5.3 How the index reaches production

- **API container.** `tsup` bundles every `@repo/*` package
  (`apps/api/tsup.config.ts:69-78`) and resolves `.json` (`:79-81`). The Docker
  build runs `pnpm turbo run build --filter=hospeda-api` (`apps/api/Dockerfile:62-63`)
  and ships only the result of `pnpm deploy` (`:76`). So the JSON is **inlined
  into `dist/index.js`**. No file is read at runtime, and nothing extra has to
  be copied. Expected size: about 91 articles × ≤ 5 000 chars ≈ ≤ 500 KB of
  JSON. The bundle already inlines larger data.
- **Web container.** Astro SSR (vite) bundles the same JSON import into the
  server chunk. The search island receives a compact projection as props
  (`docs/web-ui.md` §3), never the full index.
- **Proof** (AC-12, AC-13): a test asserts that `@repo/help` runtime sources
  contain no `node:fs` import. The staging smoke checks `get_help` and a help
  page on the deployed containers.

## 6. User stories and acceptance criteria

Actors: **owner** (any of host, venue owner, experience operator, partner,
provider; signed in), **agent** (an AI client calling `get_help` for an owner),
**maintainer** (a developer or agent changing code or content), **marketer**
(the person preparing flyers).

### US-1 Find help for my role (owner) — Phase 4

As an owner, I want a help landing that opens on my kind of account, so that I
see what applies to me first.

- AC-1 Given a signed-in user with `VENUE_EDIT_OWN`, when they open `/es/mi-cuenta/ayuda/`, then the "Comer y salir" tab is selected after hydration and lists every article whose `audiences` contains `venue`, sorted by title (es collation).
- AC-2 Given a user who is both host and provider, when the landing hydrates, then the `host` tab is selected (precedence host > venue > experience > provider > partner) and the other tabs stay one click away.
- AC-3 Given `?para=partner` in the URL, when the page loads, then the partner tab is selected on the server render and the island does not override it.
- AC-4 Given JavaScript is disabled, when the landing renders, then all audience lists are visible as stacked sections with headings (no hidden content).
- AC-5 Given a guest, when they request any `/mi-cuenta/ayuda/*` URL, then they are redirected to `/<lang>/auth/signin`, exactly as sibling pages do.

### US-2 Search help (owner) — Phase 4

- AC-6 Given the query "cómo subo fotos", when typed in the landing search, then `photos` is the first result, with no network request issued (asserted in the island test).
- AC-7 Given a query with accents or capitals ("FOTOGRAFÍAS"), when searched, then results equal those for "fotografias" (same tokenizer as `get_help`).
- AC-8 Given a query with no match, when searched, then the island shows "No encontramos ayuda para eso" plus links to the FAQ and contact pages, and no invented suggestions.

### US-3 Read an article (owner) — Phase 4

- AC-9 Given `/es/mi-cuenta/ayuda/photos/`, when it renders, then it shows title, summary, the five authored sections in the fixed order, a generated "Relacionados" list from `related[]`, a side index linking to each section anchor, and a "Páginas" box with the article's `destinations`.
- AC-10 Given an unknown id, when requested, then the response is 404 with the standard account 404 page.
- AC-11 Given `/en/mi-cuenta/ayuda/photos/` and no `en` file, when it renders, then the es content renders inside `lang="es"` with the notice "This article is only available in Spanish for now."

### US-4 Content ships and loads in production (maintainer) — Phases 2, 6

- AC-12 Given `packages/help/src` runtime modules, when the guard test scans them, then none imports `node:fs`, `fs`, `yaml` or `marked`.
- AC-13 Given the committed index differs from a fresh `pnpm help:build`, when `pnpm check:help-catalog` runs, then it exits 1 naming the first differing article id and the command to run.
- AC-14 Given the API boots with a malformed index, then the import throws (boot fails). Asserted by a unit test that feeds a broken fixture to `HelpIndexSchema`.

### US-5 Migration keeps today's answers (agent) — Phase 2

- AC-15 Given each of the 16 ids, when `get_help({topicId})` runs after migration, then `id`, `title`, `steps` and `links` are byte-equal to the pre-migration output. A fixture is captured from the TS catalog in the same PR before deletion.
- AC-16 Given every existing test in `apps/api/test/mcp/tools/help/*.test.ts`, when run after migration, then all pass. Only import paths and the fixture source may change.

### US-6 `get_help` returns the body (agent) — Phase 6

- AC-17 Given `{topicId:"photos"}`, when called, then the topic also carries `summary`, `sections.{canDo,expect,notExpect,troubleshooting}` (Markdown, tokens resolved per `docs/data-model.md` §5) and `related[{id,title}]`.
- AC-18 Given a `question`, when called, then only the first topic carries `sections`. The others carry `summary` and `steps`. The serialized result is ≤ `MCP_RESULT_MAX_CHARS` (24 000, `apps/api/src/mcp/tools/response-budget.ts:12`) for every 3-article combination in the catalog (property test over the real index).
- AC-19 Given `audience:"partner"`, when called, then only articles whose `audiences` include `partner` are returned. An unknown audience is rejected by the input schema.
- AC-20 Given a step that contains `{{limit:max_photos_per_accommodation}}`, when returned, then the step reads "el tope de tu plan". It never contains a number, and the plans link of the article's vertical is present in `links`.

### US-7 Contextual help (owner) — Phase 6

- AC-21 Given any `/mi-cuenta` page or editor section listed in some article's `entryFor`, when it renders, then a «?» link with accessible name "Ayuda: <article title> (se abre en una pestaña nueva)" points to that article and opens in a new tab.
- AC-22 Given a page that is exempt from coverage, when it renders, then no «?» is rendered (no dead link).

### US-8 Navigation (owner) — Phase 4

- AC-23 Given any signed-in user, when the account sidebar renders, then an "Ayuda" item linking to `mi-cuenta/ayuda` appears in the `cuenta` group (`apps/web/src/config/navigation.ts:132-193`), on the sidebar and mobile surfaces, and is marked active on every `/mi-cuenta/ayuda/*` page.

### US-9 Guards keep help honest (maintainer) — Phase 3

- AC-24…AC-34 are defined per predicate in [`docs/guards.md`](docs/guards.md) §7. They are part of this spec's acceptance.

### US-10 Export for flyers (marketer) — Phase 6

- AC-35 Given `hops help export --audience venue --site-url https://example.test`, when run, then stdout holds one Markdown document. It starts with `# Ayuda Hospeda — Comer y salir`, followed by one `##` per article (sorted by title). Each article has its five sections and its related list, links are absolute under the given site URL, and every `{{limit:*}}` reads "según tu plan". Exit 0.
- AC-36 Given `--audience tourist` or no audience, then the command exits 1 with the list of valid audiences (`host, venue, experience, provider, partner, all`) and writes nothing.
- AC-37 Given `--out <file>`, then the file is written whole or not at all (write to a temp file, then rename).

### US-11 Content per audience (owner) — Phase 5

- AC-38 Given the final PR, when guard (b) runs, then the exemption list contains no entry of kind `pending-content` (`docs/guards.md` §3.3).
- AC-39 Given any article, when guards (a)–(d) run, then all pass. Every article has a `reviewedAt` set by the person who checked it against the running portal, and `covers` lists every surface its steps touch.

## 7. Phases and PR plan

**Branching (owner, 2026-11-20).** All work goes through the integration branch
`epic/HOS-2410-centro-de-ayuda`, cut from `staging`. Unit branches are cut from
the epic and PR back into the epic. When a phase is complete, the epic itself is
PR'd to `staging`. This is a deliberate variant of DEC-CI-001, which ships an
umbrella once: here the epic ships once per phase, so `staging` only receives
finished phases. Between phases, `staging` is merged into the epic. Because the
branch is under `epic/`, `check-umbrella-branch-target.sh` discovers it
automatically: it exempts the epic's own PR and blocks any other branch that
carries unmerged epic commits from targeting `staging`.

Titles carry `[HOS-2410]`. **Only the last PR to merge carries `Closes HOS-2410`.**
Every other PR body must NOT contain a Linear magic word. The Linear title
automation also fires on PR open and merge (CLAUDE.md, "Known-live footgun"):
after opening and after merging each PR, spot-check the issue state and move it
back if needed.

| Phase | PR | Content | Depends on |
|---|---|---|---|
| 1 | PR-1 | `docs/inventory.md` per `docs/inventory-format.md` (docs-only) | — |
| 2 | PR-2 | `@repo/portal-routes` extraction plus the three new destination kinds. Also adds a `link:` destination for every page that `docs/catalog.md` §6.3 lists as missing one (about 30, including the account home, novedades, preferencias, promociones, aliados, publicar/*, sumate/*, checkout and the public listing pages), so IL-1 can hold (owner, 2026-11-20). Otherwise a pure move: API tests unchanged except imports | — |
| 2 | PR-3 | `@repo/help` package: schemas, generator, `pnpm help:build`, committed index, shared search. 16 topics migrated to `.md` with all five sections and `covers`. `get_help` switched to `HELP_INDEX` with identical output (AC-15/16). TS catalog and `check-owner-help` deleted. Guard (a) `check:help-catalog` replaces `check:owner-help` in CI and `check:guards` | PR-2 |
| 3 | PR-4 | Guards (b), (c), (d), `help.lock.json`, `pnpm help:review`, the exemption file seeded from the inventory (`pending-content` entries), CI steps | PR-1, PR-3 |
| 4 | PR-5 | Web: landing, article page, search island, audience island, nav entry, i18n chrome es/en/pt | PR-3 |
| 4 | PR-15 | Screenshots (D-H10): `shots` frontmatter, `{{shot:…}}` token, `data-help` attributes on the anchored UI elements, state fixtures (`docs/catalog.md` §8), and the `pnpm help:shots` Playwright script (`docs/screenshots.md`). Also adds a dev test user `partner@local.test` that holds a partner row, plus seeded listings for `venue-owner` and `experience-owner` (owner, 2026-11-20). These are dev-only test-user seeds, so the seed dual-write rule does not apply | PR-3 |
| 4 | PR-16 | Guard (e) `check:help-shots` with mutation tests, wired into CI and `check:guards` | PR-15, PR-4 |
| 5 | PR-6…PR-11 | Content: `host`, `venue`, `experience`, `provider`, `partner`, `common`. Each PR removes its `pending-content` entries and ships its articles' shots. Parallelizable (`docs/guards.md` §5 explains conflict handling) | PR-4, PR-16 |
| 6 | PR-12 | `get_help`: `sections`, `summary`, `related`, `partner`; description updated | PR-3 |
| 6 | PR-13 | `hops help export` and `pnpm --filter @repo/help export` | PR-3 |
| 6 | PR-14 | «?» buttons in `AccountPageHeader`, `EditorSectionLayout`, `ListingEditorSectionLayout` | PR-5 |

The `Closes HOS-2410` PR is whichever of PR-6…PR-14 merges last, and only if
AC-38 holds at that moment.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Guard (c) noise: cosmetic edits to an anchored page force reviews | Value-level hashes for catalog anchors and page-file-only hashing (`docs/guards.md` §4.2). A review that changes nothing costs one command. Measure in PR-4: report how many articles a sample of the last 50 merged web PRs would have flagged. |
| Lock conflicts between parallel content PRs | One entry per line, sorted by id. Same-article conflicts are resolved by re-running `pnpm help:review <id>` (`docs/guards.md` §5). |
| `pending-content` becomes permanent | A frozen count in a test, which only decreases. AC-38 blocks the closing PR. |
| Content says something false while all guards are green | Guards see existence and coupling, never truth (each header says so). The `reviewedAt` discipline and the staging smoke are the only checks of truth. |
| Index bloats the API bundle | Per-article ceiling of 5 000 rendered chars (guard (a)); about 500 KB worst case. |
| Partner/provider audience detection fails (network) | The island keeps the default tab. The page never errors because of detection. |
| `entryFor` collisions when two articles want the same page | Guard (a) requires every `entryFor` anchor to be unique across the catalog. |

## 9. Decisions taken in this spec (alternatives considered)

- **D-H1 Route map location → new `@repo/portal-routes`.** Alternatives: (a) inside
  `@repo/help` (refusal links unrelated to help would depend on the help
  package); (b) `@repo/schemas` (the types/validation source of truth, not route
  config); (c) keep it in the API (the web and `@repo/help` cannot import API code).
  Precedent for a tiny shared vocabulary package: `@repo/cache-tags`. Open for the
  owner as OQ-1 because it adds a package.
- **D-H2 Commit the generated index** rather than build it on demand (§5.2).
- **D-H3 `Relacionados` is generated from `related[]`**, not authored. Two sources for
  one list would drift. The generator rejects an authored `## Relacionados`.
- **D-H4 Help pages carry no per-user SSR content** even though the prefix is exempt.
  Alternative: SSR audience from roles. Rejected: partner and provider cannot be
  derived from roles (§2), and identical HTML keeps OQ-3 cheap.
- **D-H5 Add a frontmatter field `entryFor[]`** (the anchors whose «?» opens this
  article). Alternative: pick the first article that `covers` the page. Rejected:
  that choice is order-dependent and invisible. The field also turns coverage of
  pages and sections into "has a «?» target".
- **D-H6 `get_help` switches its data source in Phase 2**, not Phase 6, so that two
  catalogs never coexist (O-1 says "replaces").
- **D-H7 HOS-2341 is a soft dependency; this spec does not fix it.** The FAQ is
  public, i18n'd in three languages and outside help. HOS-2341 lists two items:
  `owners.manageReviews` (promises public review replies, which do not exist until
  HOS-2199) and `owners.publish` (promises a 24–48 h manual review that does not
  exist). Rule: no article may set `faqKey` to either until HOS-2341 is fixed.
  Three more items look suspect and were reported to be added to HOS-2341, not
  fixed here: `owners.featured` promises featuring and add-ons
  (`packages/i18n/src/locales/es/faq.json:125`) while `featuredByEntitlement` has
  no writer (CLAUDE.md); `owners.ready` states "mínimo 6" photos (`:117`);
  `owners.support` names plans (`:137`). PR-3 migrates the existing `faqKey` values
  (`addons` → `owners.featured`, `create-listing` → `owners.ready`, `pause-resume`
  → `owners.pause`) unchanged. In Phase 5 the `addons` and `create-listing`
  articles drop a `faqKey` that HOS-2341 still lists as wrong.
- **D-H8 Every article declares `public: boolean`** (owner, 2026-11-20). v1 ignores
  it at render; it is in the index for a later public help (`docs/data-model.md` §2).
- **D-H9 Dense interlinking is a guarded requirement** (owner, 2026-11-20): rules
  IL-1…IL-7 in `docs/data-model.md` §3.1, enforced by guard (a). The rules are
  checked by mutation tests: remove a link token, point at a missing anchor, and
  orphan an article. Each of those must turn the guard red.
- **D-H10 Articles carry screenshots, generated by a script and guarded**
  (owner, 2026-11-20, option 2 of 3). Each article declares its shots in the
  frontmatter and places them with a `{{shot:<id>}}` token. `pnpm help:shots`
  captures them with Playwright against a local seeded environment, in es/en/pt,
  and draws numbered callouts on elements marked `data-help="<anchor>"`. Guard
  (e) `check:help-shots` fails when a declared shot is missing, when its callout
  target no longer renders, or when the screen's code changed since the capture.
  The `data-help` convention is also an acceptance criterion of epic HOS-2409,
  across its kit, pages and editor fusions (owner, 2026-11-20). See
  `docs/screenshots.md` §2. Images are committed to the repo as WebP, so the visual review happens in the PR
  diff (owner, 2026-11-20; Cloudinary was rejected). Full design in
  `docs/screenshots.md`. Rejected alternatives: (1) hand-made
  screenshots with an age check, which cannot be sustained across about 90
  articles × 3 locales and only says "old", never "wrong"; (3) capture inside CI
  with an auto-PR, which adds a DB, a seed and three servers to CI. Option 3 can be
  added later on top of option 2 without rework.
- **D-H11 One screen or flow, one article** (owner, 2026-11-20). When two verticals
  show different screens, fields or flows, each one gets its own article, even if
  the topic has the same name (policies, translations, location, promotions,
  price, plan contents, emails). An article is shared only when the same component
  renders the same way for every audience (photos, FAQ, AI chat, listing states).
  Reasons: the «?» button opens what the owner is looking at, `get_help` returns a
  short focused answer, and the screenshots differ by vertical anyway. The ceiling
  per article drops to 5 000 rendered chars (`docs/data-model.md` §3).
  Assistant usage stays inside each feature's article, in a short «Desde el
  asistente» section.

## 10. Open questions (owner)

**All three resolved by the owner on 2026-11-20, each with the recommended
option:** OQ-1 → new `@repo/portal-routes` package; OQ-2 → `yaml` and `marked`
as devDependencies of `@repo/help`; OQ-3 → signed-in only for v1. For OQ-3 the
owner added a requirement: every article declares `public: boolean` now, so a
later public help can filter without re-touching content (D-H8,
`docs/data-model.md` §2). The owner also required dense interlinking between
articles and links to the exact portal part each one explains (D-H9,
`docs/data-model.md` §3.1). The article catalog (inventory §8) must be approved
by the owner before any code is written.

The original options, kept for the record:

- **OQ-1 Where the portal route map lives.**
  1. New `@repo/portal-routes` package (**recommended**). Pros: clean ownership,
     usable by API, web, help and guards. Cons: one more package (package.json,
     tsup, turbo graph, CLAUDE.md list).
  2. Inside `@repo/help` as a subpath. Pros: no new package. Cons: MCP refusal
     links come to depend on the help package.
  3. `@repo/schemas`. Pros: already a dependency everywhere. Cons: mixes route
     config into the types/validation package.
- **OQ-2 Parsing dependencies of the generator.**
  1. `yaml` and `marked` as **devDependencies** of `@repo/help` (**recommended**).
     Both are already in `pnpm-lock.yaml`: `marked@18.0.9` is a direct web
     dependency (`apps/web/package.json:61`), and `yaml@2.x` is transitive with an
     override (`pnpm-lock.yaml:48`). Generator only, never shipped at runtime.
  2. A hand-written parser for a frontmatter subset. Pros: zero deps. Cons:
     fragile, a parser to maintain and test.
  3. JSON frontmatter. Pros: no YAML dep. Cons: worse to edit, against O-1.
- **OQ-3 Who can read the help pages.**
  1. Signed-in only, under `/mi-cuenta/ayuda/` as decided (**recommended for v1**).
     Pros: matches O-4 and the sibling pages. Cons: a flyer QR to an article hits
     a login wall.
  2. Also public, e.g. `/[lang]/ayuda/`, session-blind and cacheable. Pros:
     prospects and flyer readers can read it. Cons: one more route set, SEO
     decisions, and the session-blind guard applies. D-H4 keeps this cheap later.

## 11. Implementation notes

- Read the four `docs/` files before starting any phase.
- New root scripts: `help:build`, `help:review`, `check:help-catalog`,
  `check:help-coverage`, `check:help-lock`, `check:help-values`. Each `check:*`
  is its own CI step in the `Guards` job **and** is chained into `check:guards`
  (being in `check:guards` alone does not run it in CI; see the comments at
  `.github/workflows/ci.yml:415-427`).
- `check:owner-help` is removed from `package.json:99`, `check:guards` (`package.json:59`)
  and `ci.yml:422-427`. `check:portal-routes` stays.
- Update the root `CLAUDE.md` package list (`help`, `portal-routes`) in a separate docs commit.
