# HOS-2410 — Data model

Normative for: content layout, frontmatter, body, index, tokens, locales and the
16-topic migration. Parent: [`../spec.md`](../spec.md).

## 1. Content layout

```text
packages/help/
  content/
    es/
      host/<id>.md
      venue/<id>.md
      experience/<id>.md
      provider/<id>.md
      partner/<id>.md
      common/<id>.md        # articles whose `audiences` has more than one value
  generated/help-index.json # committed, written only by `pnpm help:build`
  help.lock.json            # committed, written only by `pnpm help:review`
  coverage-exemptions.json  # committed, edited by hand (guard (b))
  src/                      # runtime + generator
```

Rules (checked by guard (a)):

- R-1 The file name (without `.md`) equals `id`.
- R-2 The folder equals the single value of `audiences` when there is one, and
  `common` when there are several.
- R-3 `id` is unique across every audience folder of the same locale. The same `id`
  in another locale is the translation of that article.
- R-4 An id is never reused. Retired ids are listed in
  `packages/help/src/retired-ids.ts` (`readonly string[]`). The generator rejects
  an article whose id is on that list. Reason: refusals and agents may still
  send a retired id (`helpTopicId`, `apps/api/src/mcp/tools/tool-errors.ts:53`).

## 2. Frontmatter schema (exact)

YAML between `---` lines, parsed and then validated by `HelpArticleFrontmatterSchema`
(Zod, `.strict()`, so unknown keys fail).

| Field | Type and constraint | Required | Notes |
|---|---|---|---|
| `id` | string, `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 64 | yes | Same regex as today (`owner-help.ts:136-139`) |
| `title` | string, 1–120 chars, no tokens | yes | |
| `summary` | string, 1–240 chars, one sentence, no tokens | yes | Shown under the title, in search results and in `get_help` |
| `audiences` | non-empty array, unique, values of `HELP_AUDIENCES = ['host','venue','experience','provider','partner']` | yes | Replaces `audience`. `any` no longer exists |
| `verticals` | array, unique, values of `VerticalEnum` minus `tourist` (`packages/schemas/src/enums/vertical.enum.ts:18-24`); may be empty | yes | Which vertical's plan and effective set the article's `{{limit}}`/`{{link:plans}}` tokens default to, and which destinations apply. Empty means account-level |
| `keywords` | array ≥ 1, unique, each 1–60 chars, in the file's locale | yes | Search input, as today |
| `destinations` | array of `HelpDestination` (§2.1) | yes (may be empty) | The "Páginas" box and `get_help` links |
| `faqKey` | string, `^[a-z]+\.[A-Za-z0-9]+$` | no | Existing semantics (`owner-help.types.ts:66-71`). Rendered as "Ver también en preguntas frecuentes" |
| `public` | boolean, no default | yes | Owner decision 2026-11-20 (D-H8). Whether the article may be shown in a future public, session-less help (`/[lang]/ayuda/`). v1 renders every article only under `/mi-cuenta/ayuda/`; the flag is stored in the index so the public version can filter without touching content. No default, so every author decides explicitly. `true` is for articles that make sense to a prospect (what a plan gives, how publishing works, what to expect); `false` for articles about operating one's own account |
| `related` | array of 2–8 entries, unique, existing ids, ≠ own id | yes | Source of the generated "Relacionados" section (D-H3). Interlinking rules in §3.1 |
| `covers` | array ≥ 1, unique, `Anchor` strings (§2.2) | yes | What the article describes. Guards (a), (b) and (c) |
| `entryFor` | array, unique, each a `page:` or `section:` anchor | yes (may be empty) | Pages/sections whose «?» opens this article (D-H5). Implicitly part of `covers` for hashing. Unique across the catalog |
| `reviewedAt` | `YYYY-MM-DD`, a real date, not in the future (Argentina local date) | yes | Bumped only by `pnpm help:review` |
| `translation` | `{ status: 'machine' \| 'reviewed' \| 'declared', sourceReviewedAt: YYYY-MM-DD }` | only on non-`es` files; forbidden on `es` | Same three states and meanings as What's New (`packages/schemas/src/entities/whats-new/whats-new.schema.ts:194-211`). `sourceReviewedAt` is the es `reviewedAt` the translation was made from |

### 2.1 `HelpDestination`

Exactly today's union (`owner-help.types.ts:34-50`): any `PortalDestination` kind
that names no record, or `{ kind: 'ownEditorSection', vertical, section }`, each
with an optional `label` (1–80 chars). The types are now imported from
`@repo/portal-routes`. The new kinds `partnerPanel`, `helpLanding` and
`helpArticle {id}` are allowed (`helpArticle.id` must exist).

### 2.2 `Anchor` grammar

```text
anchor   = kind ":" target
kind     = "page" | "section" | "entitlement" | "limit" | "enum" | "tool" | "activation" | "file"
```

| Kind | Target | Example | Resolves when |
|---|---|---|---|
| `page` | route template under `apps/web/src/pages/[lang]/`, no locale, no slashes at the ends, web segment names | `page:mi-cuenta/suscripcion` | `<path>.astro` or `<path>/index.astro` exists (same lookup as `pageExists`, `scripts/check-portal-routes.ts`) |
| `section` | `<vertical>.<sectionSlug>`, the web editor slug | `section:venue.carta`, `section:accommodation.politicas` | The vertical's editor page `…/editar/<slug>.astro` exists, and the slug is in that vertical's web editor registry (`apps/web/src/lib/editor/accommodation-editor-sections.ts`, `listing-editor-registry.ts`) |
| `entitlement` | entitlement key | `entitlement:manage_venue_menu` | Value of `EntitlementKeyEnum` (`packages/schemas/src/catalog/key-enums.ts:2`) |
| `limit` | limit key | `limit:max_photos_per_accommodation` | Value of `LimitKeyEnum` (`key-enums.ts:65`) |
| `enum` | `<Vocabulary>.<VALUE>` from a closed list | `enum:PublicationStatus.MODERATED` | `PublicationStatus` → `PublicationStatusEnum` (`packages/schemas/src/enums/publication-status.enum.ts:21`), `SubscriptionStatus` → `SUBSCRIPTION_STATUSES` (`packages/db/src/schemas/vertical/subscription.dbschema.ts:22`), `TrialStatus` → `TrialStatusEnum` (`packages/schemas/src/enums/trial-status.enum.ts:14`). Adding a vocabulary is a guard change |
| `tool` | MCP tool name | `tool:get_help` | A definition in `MCP_TOOL_DEFINITIONS` (`apps/api/src/mcp/tools/registry.ts:33-55`), found by its `name: '<x>'` literal under `apps/api/src/mcp/tools/**` |
| `activation` | vertical | `activation:venue` | Key of `VERTICAL_ACTIVATION_EVENT_BY_VERTICAL` (`packages/schemas/src/catalog/vertical-activation-event.ts:41`) with a non-null event |
| `file` | repo-relative path | `file:apps/web/src/components/host/editor/forms/PoliciesForm.client.tsx` | The file exists. Opt-in precision for guard (c) |

Why `section` uses the **web slug**, not the catalog section id: the editor has
pages that are not catalog sections, e.g. `politicas` (`accommodation-editor-sections.ts:112`)
and `preguntas-ia` (`:91`, `listing-editor-registry.ts:112`). The slug is what
the owner sees in the URL. The catalog entry is still hashed when one exists
(`docs/guards.md` §4.2).

## 3. Body

After the frontmatter come exactly five `##` headings, in this order, with no
other `##` and no `#`. The heading text is the locale's label for a fixed
section key:

| Key | es heading | Anchor id (all locales) | Content rule |
|---|---|---|---|
| `canDo` | `## Qué podés hacer` | `que-podes-hacer` | Non-empty |
| `howTo` | `## Cómo se hace` | `como-se-hace` | Exactly one top-level ordered list, 1–12 items (each item is one step returned by `get_help`). Optional paragraphs or `###` sub-headings after the list |
| `expect` | `## Qué esperar` | `que-esperar` | Non-empty |
| `notExpect` | `## Qué NO esperar` | `que-no-esperar` | Non-empty |
| `troubleshooting` | `## Problemas comunes` | `problemas-comunes` | Non-empty. Use `###` per problem |
| `related` | `Relacionados` | `relacionados` | **Never authored** (D-H3). Generated from `related[]` |

- Allowed Markdown: paragraphs, `###`, ordered and unordered lists, `**bold**`,
  `*italic*`, inline code, tokens (§5). Raw HTML, images, tables, external links
  and `[text](url)` links are rejected. All links are tokens, so they go
  through the route map.
- Every `###` sub-heading gets a stable anchor id: its text slugified (lowercase,
  accents stripped, non-alphanumerics → `-`), unique within the article. An
  optional explicit id overrides it: `### Mis fotos no se ven {#fotos-no-se-ven}`.
  Changing a sub-heading that another article links to fails guard (a), so
  explicit ids are recommended for any heading that is a link target.

### 3.1 Interlinking (owner requirement 2026-11-20, D-H9)

The help is a web of articles, not a list. Each article points to the other
articles it mentions and to the exact portal part it explains. Guard (a) enforces:

- **IL-1 Portal parts are linked.** Every `page:` and `section:` anchor in an
  article's `covers` or `entryFor` appears in its body at least once as a
  `{{link:…}}` token pointing to that page or section. An article never explains
  a screen without a link to it. A page with no dedicated target is linked
  with `{{link:page:<key>}}` (§5.1). A token inside a «Cómo se hace» step does
  not count and fails a1 until `get_help` resolves tokens (PR-12).
- **IL-2 Mentions are links.** Inside the body, a reference to another article's
  topic is an `{{article:…}}` token, never plain text. Not machine-checkable in
  general; reviewers check it. The guard checks the reverse case it can see: an
  article title quoted verbatim in another article's body without a token fails.
- **IL-3 Section-precise links.** `{{article:<id>:<anchor>}}` points to a section
  key anchor (`como-se-hace`, `problemas-comunes`, …) or a `###` anchor. The guard
  fails when the target article or anchor does not exist.
- **IL-4 No orphans.** Every article has at least one inbound link: an
  `{{article}}` token or a `related` entry in another article. Audience landing
  pages do not count.
- **IL-5 Minimum outbound.** Every article has `related` with 2 or more entries and
  at least one `{{article}}` token in its body.
- **IL-6 Cross-audience links are allowed.** The web renders a link to an article
  of another audience normally. `get_help` with an `audience` keeps it as text
  plus topic id.
- **IL-7 Visibility.** A `public: true` article may link to a `public: false`
  one. The future public renderer turns that link into plain text plus "iniciá
  sesión para ver la guía". Recorded now so authors do not avoid the link.

- Total rendered length (all sections, tokens resolved neutrally) ≤ 5 000 chars
  (guard (a); owner, 2026-11-20, lowered from 8 000 so articles stay short and
  focused, D-H11). An article that does not fit is split, not trimmed into
  vagueness. That keeps AC-18's budget.
- The step limit rises from 8 (`owner-help.types.ts:77`) to 12. Detail goes in
  the other sections.

## 4. Index (`help-index.json`)

```jsonc
{
  "version": 1,
  "contentHash": "<sha256 of every content file, path-sorted>",
  "locales": {
    "es": [
      {
        "id": "photos",
        "locale": "es",
        "folder": "common",
        "title": "…", "summary": "…",
        "audiences": ["experience","host","venue"],
        "verticals": ["accommodation","experience","venue"],
        "keywords": ["…"],
        "destinations": [ /* HelpDestination */ ],
        "faqKey": "owners.ready",          // omitted when absent
        "related": ["create-listing"],
        "covers": ["section:accommodation.fotos", "limit:max_photos_per_accommodation"],
        "entryFor": ["section:accommodation.fotos"],
        "reviewedAt": "2026-11-17",
        "translation": null,
        "sections": {
          "canDo": "<markdown with tokens>",
          "howTo": { "steps": ["<markdown with tokens>", "…"], "after": "<markdown or empty>" },
          "expect": "…", "notExpect": "…", "troubleshooting": "…"
        }
      }
    ]
  }
}
```

- Tokens stay **unresolved** in the index. Each consumer resolves them (§5), so the
  index stays session-neutral and site-URL-neutral.
- Arrays that are sets (`audiences`, `verticals`, `covers`, `entryFor`) are sorted.
  `keywords`, `related` and `destinations` keep author order (it ranks ties and
  orders links).
- `HelpIndexSchema` validates the whole file at import (§5.2 of the spec).

## 5. Tokens

### 5.1 Grammar

```text
token  = "{{" kind ":" args [ "|" label ] "}}"
kind   = "limit" | "link" | "article"
args   = arg *( ":" arg )          ; arg = [A-Za-z0-9_.-]+
label  = 1*80 chars, no "{", "}", "|"
```

| Token | Args | Example |
|---|---|---|
| `limit` | `<limitKey>[:<vertical>]` (vertical defaults to the article's single `verticals` value; required when it has several) | `{{limit:max_photos_per_accommodation}}` |
| `link` | `<target>[:<arg>…]` where target ∈ `plans:<vertical>`, `subscription`, `addons`, `list:<vertical>`, `create:<vertical>`, `section:<vertical>:<sectionSlug>`, `inquiries`, `providerDirectory`, `benefitUsages`, `providerPanel`, `partnerPanel`, `aiAssistants`, `faq`, `contact`, `help`, `page:<pageKey>` | `{{link:plans:venue\|ver los planes}}`, `{{link:page:accountHome}}` |
| `article` | `<id>[:<anchor>]`, where anchor is a section key anchor (§3) or a `###` anchor of that article (IL-3) | `{{article:pause-resume\|cómo pausar}}`, `{{article:photos:problemas-comunes\|si tus fotos no se ven}}` |

Each `link` target maps 1:1 to a `PortalDestination` (a closed table in
`@repo/help`, typed `satisfies Record<…>`). Without a label, the link uses the
destination's default label (`portal-destination.ts`). Tokens are forbidden in
`title`, `summary` and `keywords`.

`arg` allows uppercase because several link targets and page keys are
camelCase (`providerDirectory`, `accountHome`); limit keys, verticals, article
ids and anchors stay lowercase by their own grammars.

`page:<pageKey>` reaches the generic `page` destination of `@repo/portal-routes`
(owner decision 2026-11-21, PR-3 deviation 3). `<pageKey>` is a key of
`PORTAL_PAGE_LABELS` whose template in `PORTAL_ROUTE_TEMPLATES` has no
`[dynamic]` segment (`HELP_STATIC_PAGE_KEYS`). Keys that name a record
(`promotionEdit`, the public pages by slug) are rejected, like every
destination that names a record. The route → page-key map
(`HELP_PAGE_KEYS_BY_ROUTE`) is derived from `PORTAL_ROUTE_TEMPLATES`, never kept
by hand: a `page:<route>` anchor (IL-1) is satisfied by `{{link:page:<key>}}`
when `<key>` maps to that route, and the IL-1 failure names the token to add.

### 5.2 Who resolves what

| Consumer | `limit` | `link` | `article` |
|---|---|---|---|
| Web SSR (article page) | `<span data-help-limit="<key>" data-vertical="<v>">el tope de tu plan</span>` (es; en/pt chrome strings) | `<a>` with the relative URL from `buildPortalUrl`. `section:` points to the vertical's list page (no listing id is known on the server) | `<a>` to `mi-cuenta/ayuda/<id>` with the target's title when unlabeled |
| Web island `HelpLimitValues` (client, after hydration) | Replaces each span's text with the user's value from `useMyEntitlements({vertical}).limit(key)` (`apps/web/src/hooks/useMyEntitlements.ts:14-16`): a number, or "sin tope" when the value is `UNLIMITED_LIMIT_VALUE` (`packages/schemas/src/catalog/unlimited-limit.ts:10`). On loading/error the neutral text stays | — | — |
| API `get_help` | "el tope de tu plan". The article vertical's `plans` destination is appended to `links` if missing | Label text inline. The destination is appended to the topic's `links` (deduplicated). `section:` is filled from the owner's listings, as `help-links.ts` does today | "(tema `<id>`)", so the agent can fetch it with `topicId` |
| Export | "según tu plan" | `[label](<siteUrl>/es/<path>)`. `section:` uses the list page | The target's title, in «» |

Why the user's value is only resolved client-side: the session-blind guard does
not bind `/mi-cuenta` (spec §2), but D-H4 keeps help HTML identical for every
reader, and the effective set is already a client read (`useListingPlanGate.ts:10`).

## 6. Locales (later, reserved now)

- Adding `en` means creating `content/en/<same folder>/<same id>.md` with a
  `translation` block. No other change.
- Generator: a non-es article without an es counterpart fails. If the es
  `reviewedAt` is newer than `translation.sourceReviewedAt`, the translation is
  reported as outdated (report-only, like stale).
- Web en/pt: render the locale's file if present, else es (AC-11). `get_help` keeps
  answering in es. Locale-aware answers are a later decision.
- A future promotion gate may block `status: machine`, like What's New. Out of
  scope here.

## 7. Migration of the 16 topics (PR-3)

| id | today (`audience`) | `audiences` | folder | `verticals` |
|---|---|---|---|---|
| photos, create-listing, publish-requirements, pause-resume, delete-listing, amenities, fix-request, reviews, change-plan, addons | `any` | host, venue, experience | common | accommodation, venue, experience |
| ai-assistants | `any` | host, venue, experience, provider, partner | common | (empty) |
| inquiries, calendar, provider-directory, benefit-usage | `host` | host | host | accommodation (provider-directory, benefit-usage: empty) |
| benefit-usage-provider | `provider` | provider | provider | (empty) |

- `steps` become the `Cómo se hace` list verbatim (AC-15). The template-literal
  label constants (`listing-topics.ts:14-18`) are expanded to their text.
- The other four sections are written in PR-3 from the code, not from memory
  (the authoring rule at `owner-help.ts:93-95` carries over). `covers` and
  `entryFor` are set from the destinations and the steps.
- **Behaviour change, accepted:** a `provider` caller no longer receives the
  listing topics that `any` used to give it (`help-search.ts:186-195`), because
  a provider has no listing editor.
