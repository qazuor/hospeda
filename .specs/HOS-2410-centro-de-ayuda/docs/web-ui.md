# HOS-2410 — Web UI

Normative for Phase 4 (pages, search, navigation) and the «?» button of Phase 6.
Parent: [`../spec.md`](../spec.md). Stack rules: Astro components by default,
React islands only for interactivity, vanilla CSS / CSS Modules (no Tailwind),
every UI string through `@repo/i18n` in es/en/pt. Article content comes from
`@repo/help`, not from i18n.

## 1. Routes

| Route | File | Rendering |
|---|---|---|
| `/[lang]/mi-cuenta/ayuda/` | `apps/web/src/pages/[lang]/mi-cuenta/ayuda/index.astro` | SSR, `AccountLayout` with `activeSection="ayuda"` |
| `/[lang]/mi-cuenta/ayuda/[id]/` | `apps/web/src/pages/[lang]/mi-cuenta/ayuda/[id].astro` | SSR, `AccountLayout` |

- Both start with the sibling gate: `if (!Astro.locals.user) return Astro.redirect(buildUrl({ locale, path: 'auth/signin' }))`
  (`mi-cuenta/asistentes-ia/index.astro:24-29`). Nothing else is read from the
  session on the server (D-H4).
- Both routes are added to `@repo/portal-routes` as `helpLanding` and
  `helpArticle`, so `check-portal-routes` watches them.
- `[id]` resolves against `HELP_INDEX.locales[locale]`, falling back to `es`.
  An unknown id answers 404 (AC-10).
- Both pages enter guard (b)'s universe like any other account page. Their own
  `entryFor` belongs to a short `help-center` article (how to use the help).

## 2. Landing (`ayuda/index.astro`)

Layout, top to bottom:

1. `AccountPageHeader` titled "Ayuda para publicar en Hospeda", with the description
   "Todo lo que podés hacer, cómo hacerlo y qué esperar.".
2. The search box (`HelpSearch` island, §3).
3. Audience tabs, WAI-ARIA tabs pattern: `host` "Alojamientos", `venue` "Comer y salir",
   `experience` "Experiencias", `provider` "Proveedores", `partner` "Aliados". Each
   panel lists the articles whose `audiences` include it, as cards (title +
   summary), sorted by title with `Intl.Collator(locale)`.
4. Fallback block: links to the FAQ and the contact page (`faq`, `contact` destinations).

Audience selection:

- Server: the selected tab is `?para=<audience>` when valid, else `host`. All panels
  are in the HTML. Reading a query parameter is not a session read.
- Island `HelpAudiencePreselect` (`client:idle`) runs only when `?para` is
  absent. It reads exact permissions from the client session (as the avatar menu
  does, `apps/web/src/lib/nav-gating.ts:8-12`). It fetches `GET /partners/mine`
  and `GET /host-trades/mine` (as `mi-cuenta/aliados/index.astro:9-14` does).
  It then selects the first match in the order host (`ACCOMMODATION_CREATE`) >
  venue (`VENUE_EDIT_OWN`) > experience (`EXPERIENCE_EDIT_OWN`) > provider (a
  host-trade row) > partner (a partner row), and updates `?para` with
  `history.replaceState`.
- Failure or no match: the island does nothing. No error is shown, and the
  server default stays.
- Without JS: CSS shows every panel stacked, each with an `h2` (AC-4).

## 3. Search (`HelpSearch` island)

- **Input data:** the page passes, as a prop, the compact projection
  `{ id, title, summary, keywords, audiences }[]` of the locale's articles. It never
  receives the full index.
- **Engine:** the shared `searchHelp` from `@repo/help` (moved from
  `apps/api/src/mcp/tools/help/help-search.ts`, same tokenizer and scoring, same
  thresholds `:29-35`). The web passes `limit: 10` and the MCP keeps 3. No new
  dependency and no network request.
- **Behaviour:** results update on every input event once the query has ≥ 2
  characters. Each result shows title, summary and audience chips, and links to
  the article. A toggle "Solo para mi tipo de cuenta" filters by the selected tab's
  audience (default on).
- **Empty query:** no results list. **No match:** the message "No encontramos ayuda
  para eso" plus FAQ and contact links (AC-8).
- **Article page:** a compact search field submits to the landing with `?q=`. The
  landing island runs `?q` on hydration.
- **Accessibility:** a `role="search"` landmark; the input is labelled "Buscar en la
  ayuda"; the result count is announced through an `aria-live="polite"` region
  ("3 resultados"); results are a list of links in DOM order; `Escape` clears.

## 4. Article page (`ayuda/[id].astro`)

- Header: breadcrumb `Ayuda › <audience label of the current ?para or the first
  audience> › <title>`, `h1` title, summary, audience chips, and "Revisado el
  <reviewedAt, long date in locale>".
- Body: the five sections, each an `h2` with the fixed anchor ids
  (`data-model.md` §3). Markdown is rendered through the existing
  `renderContent` pipeline (`apps/web/src/lib/render-content.ts:10-20`:
  `marked` + `sanitizeHtml`) **after** SSR token resolution (`data-model.md` §5.2).
  Steps are an `ol`.
- "Relacionados": an `h2` + list of links, generated from `related[]` (title + summary).
- Side index (desktop ≥ the breakpoint used by `AccountLayout`'s sidebar):
  sticky `nav aria-label="En este artículo"` with links to the six anchors; the
  current section is highlighted via `IntersectionObserver` in a tiny island
  (`client:visible`). On mobile the side index is a collapsible
  `details` placed above the body.
- "Páginas" box: one link per `destinations` entry (`ownEditorSection` →
  the vertical's list page, see `data-model.md` §5.2) and the `faqKey` link
  "Ver también en preguntas frecuentes" when present.
- Island `HelpLimitValues` (`client:idle`) only when the article contains a
  `limit` token (`data-model.md` §5.2).
- Non-es locale with no translation: `lang="es"` on the article element, plus
  the notice (AC-11).

## 5. Navigation entry

- New item in `ACCOUNT_NAV_GROUPS` group `cuenta` (`apps/web/src/config/navigation.ts:132-193`):
  `{ id: 'help', i18nKey: 'account.nav.help', href: 'mi-cuenta/ayuda', icon: <a help/question icon from @repo/icons>, surfaces: FULL_SURFACES }`,
  placed after `whatsNew`. No `requiredPermission`: provider and partner status
  is row-based, so the server cannot gate it (spec §2). A tourist seeing
  "Ayuda" lands on a page that explains who it is for. Accepted.
- `activeSection="ayuda"` on both pages, so the item is active (AC-23).

## 6. «?» button (Phase 6, PR-14)

- Component `HelpLink.astro`, props `{ anchor: string; locale }`. It looks the
  anchor up in a map built once from `HELP_INDEX` (`entryFor` → article). With no
  hit it renders nothing (AC-22). With a hit it renders
  `<a class=… href="<helpArticle url>" target="_blank" rel="noopener" aria-label="Ayuda: <title> (se abre en una pestaña nueva)">?</a>`.
  A new tab is used because editor forms may hold unsaved input.
- Placement, so that no page needs editing:
  - `AccountPageHeader.astro` (`apps/web/src/components/account/AccountPageHeader.astro:22-35`):
    optional `helpAnchor?: string`. `AccountLayout` computes
    `page:<Astro.routePattern without the leading /[lang]/>` and passes it down
    through a layout prop or `Astro.locals`, whichever the implementer verifies
    works in Astro 7. 36 of the 77 account pages use `AccountPageHeader` and 41
    use `AccountLayout`. Pages that use `AccountLayout` without the header get the
    button in the layout's title row instead.
  - `EditorSectionLayout.astro` (`:26-39`) and `ListingEditorSectionLayout.astro`
    (`:23-36`): `section:<vertical>.<currentSectionSlug>`, or the hub's
    `page:` anchor when `currentSectionSlug` is `null`.
- Four account pages use none of these layouts:
  `agregar-contrasena`, `cambiar-contrasena`, `completar-perfil` and
  `comercio/nuevo` (a 301). They are exempt (`no-user-surface`) in guard (b).
- Visual: a 32 px circular icon button, ≥ 44 px hit area, visible focus
  ring with the design tokens, 4.5:1 contrast.

## 7. States

| State | What the owner sees |
|---|---|
| Loading (audience island) | The server-selected tab; no spinner |
| Loading (limit island) | The neutral "el tope de tu plan" text |
| Entitlements read failed | Neutral text stays; nothing logged client-side beyond the existing hook's behaviour |
| Empty audience tab (before Phase 5 completes) | "Todavía estamos escribiendo la ayuda para este tipo de cuenta." plus FAQ/contact links |
| Unknown article | 404 |
| Search no match | §3 |

## 8. Tests (Phase 4 / PR-14)

- Unit (vitest + testing-library): `HelpSearch` (AC-6/7/8, no `fetch` called),
  `HelpAudiencePreselect` (AC-1/2/3 with mocked session and fetches; fetch failure
  keeps the default), `HelpLimitValues` (number, unlimited, error).
- Page-level: a test renders the token resolver over the real index and asserts
  that no `{{` survives in the HTML of any article.
- Guard test: every `/mi-cuenta` page either is exempt or resolves to a
  `helpAnchor` that `HelpLink` finds (ties the web to guard (b)).
- i18n: new keys under `account.help.*` and `account.nav.help` in es/en/pt (the repo's
  `check:i18n-keys` must stay green).
