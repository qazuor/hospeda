# Cache Rules

Mirror of the Cache Rules live in the zone `hospeda.com.ar`. See
[`../README.md`](../README.md) for why these are documented rather than applied
from code, and for the shared-zone constraint every rule must respect.

Dashboard path: **hospeda.com.ar → Caching → Cache Rules**.

Current state: **4 active rules** — the two staging rules below, plus a
production twin of each, activated on 2026-08-12 once production started
emitting `Cache-Tag` (see [Production twins](#production-twins) at the end).

**Pending edit (HOS-519, drafted 2026-09-04, not yet applied):** rule 1
(staging) and its twin rule 4 (production) are each missing the `/partners`
prefix — see [W2-5 (HOS-519)](#w2-5-hos-519--partner-gold-pages) for the
three lines to paste in and why.

**Pending edit (HOS-519 scope extension, drafted 2026-09-04, not yet
applied):** the same two rules are also missing `/planes`, `/presentacion`
and `/autores` — seventeen more cacheable pages the original HOS-519 sweep
did not cover. See [W2-6 (HOS-519)](#w2-6-hos-519--pricing-static-presentation-and-author-pages)
for the nine lines to paste in, the length budget that decided their shape,
and a drift found along the way in the existing `suscriptores` prefixes.

---

## What needs a rule, and what does not

Only **HTML** and the **`/_image/` endpoint** need rules. Every other asset is
already cached by Cloudflare's own default for static file extensions, honoring
the origin's `Cache-Control` — no rule involved, nothing here to maintain:

| Asset | Cached by | Origin `Cache-Control` | Measured 2026-08-15 (prod) |
|---|---|---|---|
| `/_astro/*.js`, `*.css` | CF extension default | `max-age=31536000, immutable` | `HIT` |
| `/assets/**/*.svg` | CF extension default | `max-age=14400` | `REVALIDATED` |
| `/apple-touch-icon.png` | CF extension default | `max-age=14400` | `REVALIDATED` |
| `/i18n/<locale>.<hash>.js` | CF extension default | `max-age=31536000, immutable` | `HIT` — see [its section](#i18nlocalehashjs--outside-every-rule-on-this-page) |
| **HTML pages** | **rules 1 and 4** | `s-maxage=3600` | `HIT` |
| **`/_image/?…`** | **rules 2 and 3** | `max-age=31536000, immutable` | `HIT` |

`/_image/` needs a rule precisely *because* it is an image. Astro serves resized
images from a query string with no file extension, so the extension default
never matches and every visitor makes the origin re-encode the same photo. That
is the whole reason rule 2 exists.

None of the extension-default assets can go stale: their filename carries a
digest of their contents, so a change produces a different URL. **HTML is the
only thing on this page that can serve outdated content**, which is why it is the
only thing the `Cache-Tag` purge machinery exists for.

> **Probing.** Use `GET` — every rule here requires it, and `curl -I` sends
> `HEAD`, which returns `DYNAMIC` and reads like a dead rule (this file warns
> about it twice more, under `/i18n/` and `/_image/`). Use the **canonical URL**
> too: `/es/eventos` without its trailing slash answers `301`, correctly
> uncached, which reads like `BYPASS`. Both mistakes were made on 2026-08-15 and
> each produced a false "nothing is cached" report.

---

## `HOS-369 W1-2 - staging catalog + subscriber`

Makes the accommodation catalog and the subscriber pricing pages eligible for
edge caching **on staging only**, honoring the origin's own `Cache-Control`.

- **Rule id**: `ff033810a5cf4751aa7dfa000e85b66f`
- **Phase**: `http_request_cache_settings`
- **Order**: 1
- **Status**: active
- **Created**: 2026-08-04 (HOS-369 W1-2)

### Expression

```
(http.host eq "staging.hospeda.com.ar"
 and http.request.method in {"GET" "PURGE"}
 and http.request.uri.query eq ""
 and not http.cookie contains "better-auth.session_token"
 and (http.request.uri.path in {"/es/" "/en/" "/pt/"
        "/es/nosotros/" "/es/beneficios/" "/es/funcionalidades/" "/es/contacto/"
        "/es/preguntas-frecuentes/" "/es/legal/cookies/" "/es/legal/privacidad/"
        "/es/legal/terminos/" "/es/colaborar/" "/es/colaborar/editores/"
        "/es/colaborar/fotos/" "/es/colaborar/reportar/"
        "/en/nosotros/" "/en/beneficios/" "/en/funcionalidades/" "/en/contacto/"
        "/en/preguntas-frecuentes/" "/en/legal/cookies/" "/en/legal/privacidad/"
        "/en/legal/terminos/" "/en/colaborar/" "/en/colaborar/editores/"
        "/en/colaborar/fotos/" "/en/colaborar/reportar/"
        "/pt/nosotros/" "/pt/beneficios/" "/pt/funcionalidades/" "/pt/contacto/"
        "/pt/preguntas-frecuentes/" "/pt/legal/cookies/" "/pt/legal/privacidad/"
        "/pt/legal/terminos/" "/pt/colaborar/" "/pt/colaborar/editores/"
        "/pt/colaborar/fotos/" "/pt/colaborar/reportar/"}
   or starts_with(http.request.uri.path, "/es/alojamientos")
   or starts_with(http.request.uri.path, "/en/alojamientos")
   or starts_with(http.request.uri.path, "/pt/alojamientos")
   or starts_with(http.request.uri.path, "/es/suscriptores/planes")
   or starts_with(http.request.uri.path, "/en/suscriptores/planes")
   or starts_with(http.request.uri.path, "/pt/suscriptores/planes")
   or starts_with(http.request.uri.path, "/es/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/en/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/pt/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/es/destinos")
   or starts_with(http.request.uri.path, "/en/destinos")
   or starts_with(http.request.uri.path, "/pt/destinos")
   or starts_with(http.request.uri.path, "/es/eventos")
   or starts_with(http.request.uri.path, "/en/eventos")
   or starts_with(http.request.uri.path, "/pt/eventos")
   or starts_with(http.request.uri.path, "/es/publicaciones")
   or starts_with(http.request.uri.path, "/en/publicaciones")
   or starts_with(http.request.uri.path, "/pt/publicaciones")
   or starts_with(http.request.uri.path, "/es/gastronomia")
   or starts_with(http.request.uri.path, "/en/gastronomia")
   or starts_with(http.request.uri.path, "/pt/gastronomia")
   or starts_with(http.request.uri.path, "/es/experiencias")
   or starts_with(http.request.uri.path, "/en/experiencias")
   or starts_with(http.request.uri.path, "/pt/experiencias")
   or starts_with(http.request.uri.path, "/es/partners")
   or starts_with(http.request.uri.path, "/en/partners")
   or starts_with(http.request.uri.path, "/pt/partners")
   or starts_with(http.request.uri.path, "/es/planes")
   or starts_with(http.request.uri.path, "/en/planes")
   or starts_with(http.request.uri.path, "/pt/planes")
   or starts_with(http.request.uri.path, "/es/presentacion")
   or starts_with(http.request.uri.path, "/en/presentacion")
   or starts_with(http.request.uri.path, "/pt/presentacion")
   or starts_with(http.request.uri.path, "/es/autores")
   or starts_with(http.request.uri.path, "/en/autores")
   or starts_with(http.request.uri.path, "/pt/autores")))
```

**Pending application (HOS-519, drafted 2026-09-04, not yet live).** Neither
the three `partners` clauses nor the nine `planes`/`presentacion`/`autores`
clauses above are in the dashboard rule yet — see
[W2-5 (HOS-519)](#w2-5-hos-519--partner-gold-pages) and
[W2-6 (HOS-519)](#w2-6-hos-519--pricing-static-presentation-and-author-pages)
below for why each was added and what to verify once they are pasted in.

The live rule stores this on a single line (2419 characters through W2-4, 2581
once W2-5 is applied, 3070 once W2-6 is also applied — verified character by
character, not estimated; see W2-6 for the arithmetic). It was 2074 after
W2-3, 1576 after W2-2, and 796 before that. The thirty-six `starts_with` terms
are written out rather than expressed as a regex because the `matches`
operator requires a Business plan — and because the Ruleset Engine's own
4,096-character expression cap (`https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/`)
is the harder constraint here regardless of plan; see W2-6.

The home is matched with `in { … }` — an **exact** path set, not a prefix.
`starts_with(path, "/es/")` would match every Spanish page in the app, including
`/es/mi-cuenta/`. Nothing would actually cache there (those pages never opt in,
and `bypass_by_default` refuses anything that has not), but a rule whose
expression claims more than it means is one refactor away from being true.

The twelve copy-only pages W2-2 added (36 entries: 12 paths × 3 locales) join
that same exact set for the same reason, and deliberately **not** as
`starts_with(path, "/es/legal")` / `"/es/colaborar"`. Those two prefixes would
be shorter, but they would also pre-approve a `legal/` or `colaborar/` page that
does not exist yet — one that might read a session. Listing the paths means a
new sibling is excluded until somebody adds it here on purpose, which is the
same fail-closed posture `http.request.uri.query eq ""` takes on filters.

`/{lang}/colaborar/reportar/` is documented as taking `?destino=<slug>`. The
pre-filled form is therefore never cached — the empty-query clause excludes it —
while the bare entry point is. That asymmetry is intended, not an oversight.

W2-3 added the three catalog families as **prefixes**, not as an exact set, and
that reversal is deliberate rather than an inconsistency. W2-2's twelve pages
are a closed list of literal paths, so enumerating them costs nothing and buys
fail-closed behavior. `destinos`, `eventos` and `publicaciones` are keyed on
slugs, categories, tags, authors and page numbers — there is no finite set to
enumerate, so a prefix is the only option available.

The safety property is not lost, it just moves: `edge_ttl.mode =
"bypass_by_default"` means matching the prefix does nothing on its own. A page
under a matched prefix that has not opted in returns `BYPASS`, which is the
mechanism working rather than a gap.

W2-3 left six such pages deliberately uncached — `/destinos/atraccion/`,
`/destinos/lugar/`, and the four gastronomy/experience pages — because
`attraction`, `pointOfInterest`, `gastronomy` and `experience` had no tag
vocabulary, no `entity-tag-mapper` case, and their services never called the
revalidation service at all. **W2-4 built that chain and all six now cache**,
which is why this wave added the `gastronomia`/`experiencias` prefixes: the
other two already sat under `/destinos`.

### W2-5 (HOS-519) — partner gold pages

`/{lang}/partners/<slug>/` (a gold partner's own page, HOS-294) called
`applyCacheHeaders({ cacheClass: 'detail', ... })` from the day it shipped —
see `apps/web/src/pages/[lang]/partners/[slug].astro` — but no rule on this
page ever matched `/partners`, so every response answered `cf-cache-status:
DYNAMIC` regardless of what the origin sent. Measured in production on
2026-08-15 against `cache-control: public, s-maxage=3600,
stale-while-revalidate=3600` — byte-identical to `/es/alojamientos/`, which
cached correctly over the same window — which is what places the cause here
and not in the origin.

Added as a **prefix**, like `destinos`/`eventos`/`publicaciones`, not as an
exact path set like the W2-2 copy-only pages: `<slug>` is open-ended, so there
is no finite set to enumerate. Unlike those three families, though, partners
have no listing page (see the comment in `[slug].astro`: "partners have no
listing page, so there is no `list-partner` to purge"), so this wave adds
exactly one path family, not two — there is no `/{lang}/partners/` collection
route to also decide on.

The safety property is unchanged: `edge_ttl.mode = "bypass_by_default"` means
matching the prefix does nothing by itself. A silver partner's URL (which
never renders — HOS-294 restricts the page to gold), a partner mid-DRAFT, or
one whose subscription lapsed all return non-cacheable responses today, and
will keep doing so after this rule ships: `applyCacheHeaders` in
`[slug].astro` only sets `cacheable: true` when the API call actually resolved
a partner (see `apps/web/src/pages/[lang]/partners/[slug].astro`,
`cacheable: Astro.url.search === '' && primaryCacheTag !== undefined`). A 404
or 410 response never reaches that call, so it is never cached — matching the
prefix only makes a *cacheable* response eligible; it does not make an
uncacheable one cache.

**Investigated as part of HOS-519 and worth recording here**: as of
2026-09-04, `GET /api/v1/public/partners` returns zero rows in production —
both partners named in the original HOS-519 report
(`autoservice-litoral`, `fundacion-entre-rios-sustentable`) were HARD-DELETED
by the seed data-migration `0059-purge-test-and-commerce-example.ts`
(`PARTNER_SLUGS`, `packages/seed/src/data-migrations/0059-purge-test-and-commerce-example.ts:260-262`),
an intentional 2026-08-23 owner decision to clear commerce example data before
launch. So this rule currently has **nothing to verify against in production**
— `curl` against either slug answers 404, not 200, and will keep doing so
until a real gold partner is onboarded. Verify against **staging** instead
(seed data there is unaffected), or re-run the `curl` checks below once a real
partner exists in production.

#### Expression (partners clauses only, for diffing against the dashboard)

```
   or starts_with(http.request.uri.path, "/es/partners")
   or starts_with(http.request.uri.path, "/en/partners")
   or starts_with(http.request.uri.path, "/pt/partners")
```

Paste these three lines into the existing big `or (...)` group inside rule 1's
expression (staging) — right after the `experiencias` clauses, before the
final `))` — and, separately, into rule 4's expression (its production twin,
same three lines, `http.host` unchanged at `"hospeda.com.ar"`). Do NOT create
a fifth rule: this is an edit to the two existing rules, matching how W2-2,
W2-3 and W2-4 each extended the same expression rather than adding a new one.

#### Verifying (once applied, on staging — see the production note above)

```bash
# eligibility + hit — use a real staging gold-partner slug
curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/es/partners/<slug>/ \
  | grep -iE '^(cf-cache-status|age|cf-ray|cache-control):'
```

Expected on the second request: `cf-cache-status: HIT`, non-zero `age`, and
`Cache-Control` **without** the injected `max-age=14400` (see the Browser TTL
note under Settings below — its absence is what proves *this* rule, not the
zone default, produced the hit).

Purge scoping follows the same two-direction pattern used for attractions/POIs
above: purge `preview:partner-<slug>` (or `prod:partner-<slug>`) and confirm
that partner's page goes `MISS` while a second, unrelated partner's page
survives as `HIT`. No such two-partner pair exists on staging as of
2026-09-04, so this check is not yet run — do it once a second gold partner is
seeded there.

### W2-6 (HOS-519) — pricing, static-presentation, and author pages

The owner widened HOS-519's scope past partners to cover every other
cacheable page a repo sweep found with no matching rule. A sweep of every
`.astro` under `apps/web/src/pages/[lang]/` that calls `applyCacheHeaders`
confirmed seventeen pages, matching the original report exactly (nothing
missing, nothing extra):

- **`/{lang}/planes/{anfitriones,turistas,aliados,gastronomia,experiencias}/`
  and their `/precios/` siblings** — 5 audiences × 2 pages × 3 locales = 10
  paths, `cacheClass: 'pricing'` (`s-maxage=3600`), `cacheable: true`
  unconditionally in every one of the ten files.
- **`/{lang}/presentacion/{proveedores,gastronomia,alojamientos,aliados,editores,experiencias}/`**
  — 6 pages × 3 locales, `cacheClass: 'static'` (`s-maxage=86400`),
  `cacheable: true` unconditionally.
- **`/{lang}/autores/<slug>/`** — `cacheClass: 'catalog'` (`s-maxage=3600`),
  `cacheable: hasOnlyPaginationParams({ searchParams: Astro.url.searchParams })`
  (`apps/web/src/pages/[lang]/autores/[slug]/index.astro`), the same
  pagination-only gate used elsewhere on this page.
  `/{lang}/autores/<slug>/page/N/` is an `Astro.rewrite` into that same file
  (identical shape to `alojamientos/page/[page].astro`), so it inherits
  caching with no rule edit of its own — and needs none, `starts_with` already
  covers it. `/{lang}/autores/<slug>/eventos/` and its own `page/N/` are
  redirects back to the profile, not cacheable content, and were left out of
  the count on purpose.

None of these three families were missing by oversight of *this* wave — they
simply postdate the last time this file's prefix list was extended.

#### The doctrine says exact list. The character budget forces prefix instead

`planes` and `presentacion` are each a **closed, enumerable set** — five
audiences and six roles, not a slug/category/tag namespace like `destinos` or
`eventos`. By the rule this file states under [W2-3](#hos-369-w1-2---staging-catalog--subscriber),
that shape calls for an exact `in { … }` list: fail-closed, so a sixth
audience or a seventh presentation role stays excluded until someone adds it
here on purpose. That is the doctrine's default, and it was the first thing
tried.

It does not fit. The Ruleset Engine's expression-length cap is a hard,
plan-independent limit — **4,096 characters**, per
[Cloudflare's own docs](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/)
("The maximum length of a rule expression is 4,096 characters. This limit
applies whether you use the visual Expression Builder... or write the
expression manually"). No Free-plan-specific override was found for Cache
Rules expressions in particular — the only Free-tier number documented for
Cache Rules is a cap of **10 rules per zone**
(`https://developers.cloudflare.com/cache/how-to/cache-rules/`), which is a
different limit and not the one in play here. The 4,096 figure is stated
plainly enough, and matched independently by reconstructing and measuring the
current live expression byte-for-byte (2,581 characters through W2-5 — see
below), that it is treated as authoritative rather than re-verified against a
second source.

The regex cap (64 `matches` expressions per rule) does not apply either way:
this rule has always used zero `matches`/regex terms, only `in {}` and
`starts_with`, precisely because `matches` requires a Business plan (noted
above). So the only ceiling that matters here is the 4,096-character one.

**The arithmetic, computed character-by-character against the live 2,581-char
expression (post-W2-5), not estimated:**

| Option | What gets added | New characters | New total | Fits in 4,096? |
|---|---|---|---|---|
| Exact list | 48 literal paths (30 `planes` + 18 `presentacion`) joined into the existing `in {}` set, **plus** the 3 `autores` `starts_with` clauses (autores is open — a prefix regardless of which way the other two go) | 1,425 + 159 = 1,584 | **4,165** | **No — 69 over the cap** |
| Prefix | 6 `starts_with` clauses (`/planes`, `/presentacion` × 3 locales) + 3 `autores` clauses | 330 + 159 = 489 | **3,070** | Yes — 1,026 characters of headroom |

Both totals were produced by reconstructing the entire expression as Cloudflare
stores it (one line, single-space-separated tokens, no formatting whitespace)
and taking `len()` of the result — not a per-entry estimate multiplied out.
The exact-list total was cross-checked by building the actual 48-entry list
and 3-entry prefix set and measuring the concatenation, not by assuming
"48 × ~30 chars".

**Decision: prefix, for `planes` and `presentacion` too — a deliberate
departure from the doctrine, not a preference.** The exact-list form is what
the fail-closed argument prefers, and it does not fit; 4,165 characters
against a 4,096-character hard cap is not a rounding‑error miss that a shorter
locale code or dropped space would rescue; it needed the doctrine reconsidered,
not squeezed. Three things make the departure honest rather than a shortcut:

1. **The safety mechanism doctrine relies on elsewhere still applies.**
   `edge_ttl.mode = "bypass_by_default"` (see [Settings](#settings) below)
   means matching a `/planes` or `/presentacion` prefix does nothing by
   itself — a future seventh `presentacion` role or sixth `planes` audience
   only starts caching once its own page calls `applyCacheHeaders({
   cacheable: true, … })`, exactly the same backstop already relied on for
   `destinos`/`eventos`/`publicaciones`/`partners`.
2. **What the fail-closed exact-list guards against here is smaller than
   what it guards against for the W2-2 copy-only pages.** `/es/legal` or
   `/es/colaborar` as prefixes would have pre-approved a page that might read
   a session (the doc's own words). `/planes` and `/presentacion` are
   unauthenticated marketing/pricing pages by construction — every existing
   page in both families is server-rendered from `@repo/i18n` copy and
   catalogue data, none of them reads `Astro.locals.session` or renders
   per-visitor state. A new sibling under either prefix inherits that same
   class of page; the "reads a session" risk the doctrine names is
   structurally close to zero here, not merely mitigated by
   `bypass_by_default`.
3. **The honest cost, stated rather than hidden**: unlike `destinos`/
   `eventos` (genuinely open, no finite set exists to enumerate), `planes`
   and `presentacion` really are closed sets, and prefix does trade away the
   doctrine's "a new sibling is excluded until added on purpose" guarantee
   for them. A sixth `/planes/<new-audience>/` page ships pre-approved for
   caching the moment a developer adds `applyCacheHeaders({ cacheable: true
   })` to it, with no corresponding cache-rule edit required or reviewed.
   That is a real, not hypothetical, weakening of the posture this file
   otherwise defends — accepted here because the character budget leaves no
   alternative once `autores` (unavoidably a prefix) and the existing 2,581
   characters are accounted for, and because point 2 above shrinks the
   specific harm ("reads a session") that made the doctrine matter in the
   first place.

`autores/<slug>/` needs no such argument: it is keyed by author slug, an open
set exactly like `destinos`/`eventos`/`publicaciones`, so `starts_with` is
what the existing doctrine already prescribes for it independent of the
character budget.

#### A drift found while measuring: `/es/suscriptores/turistas` is now dead weight

The existing expression already carries a `/{lang}/suscriptores/turistas`
prefix (added before this wave). No `.astro` file lives under that path
today, which looked at first like a missing page — it is not. `git log`
shows commit `fed10a7af` ("retire seven pricing URLs behind one-hop 301s",
2026-09-04, same day, HOS-1032 AC-51) turned every page under that prefix
into a redirect stub:

- `/{lang}/suscriptores/turistas/` → `Astro.redirect(…, 301)` to
  `/{lang}/planes/turistas/precios/`
- `/{lang}/suscriptores/turistas/comparar/` → same 301, same destination

Neither file calls `applyCacheHeaders` any more — confirmed by grep, zero
matches in either file. So the prefix still matches real pages, but every
page under it now returns a 301 with no `Cache-Control`, which
`bypass_by_default` correctly leaves as `DYNAMIC` (harmless, matching the
"matching a prefix is not sufficient" pattern this file already documents for
partners and the six W2-3 exclusions). The clause is not wrong, just inert:
it costs 3 × ~50 = ~150 characters of the budget for a prefix that can never
produce a cache hit again.

The sibling prefix, `/{lang}/suscriptores/planes`, is **not** in the same
situation and must stay: `/{lang}/suscriptores/planes/` itself is still a
live page (the audience-picker index, HOS-942/HOS-1032, `cacheable: true,
cacheClass: 'pricing'`) even though its three children
(`planes/turistas/`, `planes/anfitriones/`, `planes/comparar/`) were retired
to 301s by the same commit. These are not declared in
[`redirect-rules.md`](./redirect-rules.md) — they are in-app `Astro.redirect`
calls, not Cloudflare Bulk/Single Redirects, which is why that file has no
`suscriptores` entries to reconcile.

**Recommendation, not applied**: drop the three `/{lang}/suscriptores/turistas`
`starts_with` clauses (es/en/pt) from both rules the next time either is
edited — they reclaim ~150 characters and remove a prefix that can no longer
match anything cacheable. Left in place for now at the owner's call; this
wave only documents the finding, per instruction not to remove without
sign-off.

#### Expression (new clauses only, for diffing against the dashboard)

```
   or starts_with(http.request.uri.path, "/es/planes")
   or starts_with(http.request.uri.path, "/en/planes")
   or starts_with(http.request.uri.path, "/pt/planes")
   or starts_with(http.request.uri.path, "/es/presentacion")
   or starts_with(http.request.uri.path, "/en/presentacion")
   or starts_with(http.request.uri.path, "/pt/presentacion")
   or starts_with(http.request.uri.path, "/es/autores")
   or starts_with(http.request.uri.path, "/en/autores")
   or starts_with(http.request.uri.path, "/pt/autores")
```

Paste these nine lines into the existing big `or (...)` group inside rule 1's
expression (staging) — right after the `partners` clauses (added by W2-5,
above), before the final `))` — and, separately, into rule 4's expression
(production twin, same nine lines, `http.host` unchanged at
`"hospeda.com.ar"`). Do NOT create a new rule and do NOT apply W2-5's three
`partners` lines twice if both waves are pasted in together — check what is
already in the dashboard rule before pasting either.

#### Full expression (complete, final, for diffing against the dashboard)

This is the entire rule 1 (staging) expression once **both** W2-5 and W2-6
are applied — 3,070 characters on one line, verified by reconstructing and
measuring it, not estimated. Compare this against the dashboard control by
control before pasting anything; do not trust that the two diffs above compose
correctly without checking the result.

```
(http.host eq "staging.hospeda.com.ar"
 and http.request.method in {"GET" "PURGE"}
 and http.request.uri.query eq ""
 and not http.cookie contains "better-auth.session_token"
 and (http.request.uri.path in {"/es/" "/en/" "/pt/"
        "/es/nosotros/" "/es/beneficios/" "/es/funcionalidades/" "/es/contacto/"
        "/es/preguntas-frecuentes/" "/es/legal/cookies/" "/es/legal/privacidad/"
        "/es/legal/terminos/" "/es/colaborar/" "/es/colaborar/editores/"
        "/es/colaborar/fotos/" "/es/colaborar/reportar/"
        "/en/nosotros/" "/en/beneficios/" "/en/funcionalidades/" "/en/contacto/"
        "/en/preguntas-frecuentes/" "/en/legal/cookies/" "/en/legal/privacidad/"
        "/en/legal/terminos/" "/en/colaborar/" "/en/colaborar/editores/"
        "/en/colaborar/fotos/" "/en/colaborar/reportar/"
        "/pt/nosotros/" "/pt/beneficios/" "/pt/funcionalidades/" "/pt/contacto/"
        "/pt/preguntas-frecuentes/" "/pt/legal/cookies/" "/pt/legal/privacidad/"
        "/pt/legal/terminos/" "/pt/colaborar/" "/pt/colaborar/editores/"
        "/pt/colaborar/fotos/" "/pt/colaborar/reportar/"}
   or starts_with(http.request.uri.path, "/es/alojamientos")
   or starts_with(http.request.uri.path, "/en/alojamientos")
   or starts_with(http.request.uri.path, "/pt/alojamientos")
   or starts_with(http.request.uri.path, "/es/suscriptores/planes")
   or starts_with(http.request.uri.path, "/en/suscriptores/planes")
   or starts_with(http.request.uri.path, "/pt/suscriptores/planes")
   or starts_with(http.request.uri.path, "/es/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/en/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/pt/suscriptores/turistas")
   or starts_with(http.request.uri.path, "/es/destinos")
   or starts_with(http.request.uri.path, "/en/destinos")
   or starts_with(http.request.uri.path, "/pt/destinos")
   or starts_with(http.request.uri.path, "/es/eventos")
   or starts_with(http.request.uri.path, "/en/eventos")
   or starts_with(http.request.uri.path, "/pt/eventos")
   or starts_with(http.request.uri.path, "/es/publicaciones")
   or starts_with(http.request.uri.path, "/en/publicaciones")
   or starts_with(http.request.uri.path, "/pt/publicaciones")
   or starts_with(http.request.uri.path, "/es/gastronomia")
   or starts_with(http.request.uri.path, "/en/gastronomia")
   or starts_with(http.request.uri.path, "/pt/gastronomia")
   or starts_with(http.request.uri.path, "/es/experiencias")
   or starts_with(http.request.uri.path, "/en/experiencias")
   or starts_with(http.request.uri.path, "/pt/experiencias")
   or starts_with(http.request.uri.path, "/es/partners")
   or starts_with(http.request.uri.path, "/en/partners")
   or starts_with(http.request.uri.path, "/pt/partners")
   or starts_with(http.request.uri.path, "/es/planes")
   or starts_with(http.request.uri.path, "/en/planes")
   or starts_with(http.request.uri.path, "/pt/planes")
   or starts_with(http.request.uri.path, "/es/presentacion")
   or starts_with(http.request.uri.path, "/en/presentacion")
   or starts_with(http.request.uri.path, "/pt/presentacion")
   or starts_with(http.request.uri.path, "/es/autores")
   or starts_with(http.request.uri.path, "/en/autores")
   or starts_with(http.request.uri.path, "/pt/autores")))
```

For rule 4 (production), the only difference is the first line:
`http.host eq "hospeda.com.ar"`. Everything else is byte-identical.

#### Verifying (once applied)

Run on **staging** first — production has real content for every one of
these seventeen pages (unlike the partner pages in W2-5, which currently have
none), so both environments can be checked once the edit ships:

```bash
# planes (pricing) — pick one audience, check both the sales page and /precios/
curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/es/planes/turistas/ \
  | grep -iE '^(cf-cache-status|age|cf-ray|cache-control):'
curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/es/planes/turistas/precios/ \
  | grep -iE '^(cf-cache-status|age|cf-ray|cache-control):'

# presentacion (static)
curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/es/presentacion/alojamientos/ \
  | grep -iE '^(cf-cache-status|age|cf-ray|cache-control):'

# autores (catalog) — use a real author slug with published posts
curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/es/autores/<slug>/ \
  | grep -iE '^(cf-cache-status|age|cf-ray|cache-control):'

# the two dead suscriptores/turistas paths, for completeness — expect a 301,
# never a cache hit, on both requests
curl -sSI https://staging.hospeda.com.ar/es/suscriptores/turistas/
```

Expected on the second request for each cacheable path: `cf-cache-status:
HIT`, non-zero `age`, and `Cache-Control` without the injected
`max-age=14400` (see the Browser TTL note under [Settings](#settings) — its
absence is what proves this rule, not the zone default, produced the hit).
The `suscriptores/turistas` probe should show `HTTP/2 301` on every request,
never `cf-cache-status: HIT` — confirming the drift finding above rather than
contradicting it.

Repeat against `https://hospeda.com.ar` once satisfied on staging, substituting
a real production author slug and plan audience.

### Settings

| Setting | Value | API equivalent |
|---|---|---|
| Cache eligibility | Eligible for cache | `"cache": true` |
| Edge TTL | Use cache-control header if present, **bypass cache if not** | `edge_ttl.mode = "bypass_by_default"` |
| Browser TTL | Respect origin TTL | `browser_ttl.mode = "respect_origin"` |
| Cache key → Sort query string | on | `cache_key.ignore_query_strings_order = true` |

Everything else (Vary, serve stale, strong ETags, origin error page passthru,
status-code TTLs, cache deception armor, cache by device type) is left unset.

```json
"action": "set_cache_settings",
"action_parameters": {
  "cache": true,
  "edge_ttl":    { "mode": "bypass_by_default" },
  "browser_ttl": { "mode": "respect_origin" },
  "cache_key":   { "ignore_query_strings_order": true }
}
```

### Why each clause

**`http.host eq "staging.hospeda.com.ar"`** — staging only, on purpose.
Production is behind on the branch that emits `Cache-Tag`; caching HTML there
would produce objects nothing can purge selectively, which is strictly worse
than not caching at all. Lift this only after staging is promoted.

> **Resolved 2026-08-12.** The August batch shipped, production now emits
> `Cache-Tag`, and this rule has a production twin rather than a widened host
> clause — see [Production twins](#production-twins). Two separate rules, so
> production can be switched off without touching staging.

**`http.request.method in {"GET" "PURGE"}`** — a `GET`-only expression does not
match during a purge, so single-file purges report success and evict nothing.
Silent failure (HOS-369 §5.11.3).

**`http.request.uri.query eq ""`** — fail-closed on filters. A whitelist of
known filter params would silently admit the next param somebody adds; requiring
an empty query string means a new facet is excluded by default and has to be
let in deliberately. Nothing is lost: pagination uses path segments
(`/page/2/`), and the faceted query URLs are already `Disallow`ed in
`robots.txt`.

**`not http.cookie contains "better-auth.session_token"`** — no logged-in
request may read from or populate a shared cache object. One `contains` covers
both cookie names, because `__Secure-better-auth.session_token` contains
`better-auth.session_token` as a substring (verified, both forms bypass).

Since W1-2a the shell no longer bakes the visitor's identity into these pages,
so this is belt-and-braces rather than the only thing standing between
visitors. Remove it **per path, after that path is verified by measurement**
— never on the strength of that note alone (HOS-369 §6.4).

**Edge TTL `bypass_by_default`, not `respect_origin`** — this is what keeps the
rule honest. `respect_origin` would fall back to Cloudflare's own default TTL
for any matched response whose origin sent no `Cache-Control` — caching it with
no cache tag, so nothing could purge it. `bypass_by_default` refuses to cache
anything the origin has not explicitly opted in. The origin's opt-in is
`applyCacheHeaders()`, which sets `Cache-Control` and registers the purge tags
in the same call precisely so the two cannot drift apart
(`apps/web/src/lib/cache/response-cache.ts`).

**Browser TTL `respect_origin`** — **required, not cosmetic.** The zone's
Browser Cache TTL is 4 hours, and Cloudflare injects `max-age=14400` into every
response a Cache Rule makes cacheable. A Cloudflare purge never reaches browser
caches, so without this setting a returning visitor would hold stale HTML for up
to four hours with no way to evict it — the exact failure mode selective purge
exists to remove, newly reachable because the rule is what first made these
responses cacheable at all. Fixed per-rule; the zone-level setting is left
alone because changing it would affect production too.

**Sort query string** — mandated by HOS-369 §7.2 as the only cache-key
normalization available on the free plan (`Ignore query string` and
`No query parameters except` are Enterprise). It is currently **inert**: the
expression only matches requests with an empty query string, so there is never
an order to normalize. Kept so it is already correct if the expression is later
widened to admit parameters.

### What this rule actually caches

Matching a path is necessary but not sufficient — the origin must also declare
the response cacheable. Measured on 2026-08-04:

| Path | Cached? |
|---|---|
| `/{lang}/` (home) | yes — **since 2026-08-04** (W2-1), tagged `home` |
| `/{lang}/{nosotros,beneficios,funcionalidades,contacto}/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/preguntas-frecuentes/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/legal/{cookies,privacidad,terminos}/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/colaborar/` and `/{editores,fotos,reportar}/` | yes — **since 2026-08-04** (W2-2), tagged `site-config` |
| `/{lang}/destinos/` and `/mapa/` | yes — **since 2026-08-04** (W2-3), tagged `list-dest` |
| `/{lang}/destinos/<path>/` (detail) | yes — **since 2026-08-04** (W2-3), tagged `dest-<slug>` + `dest-<id>` |
| `/{lang}/destinos/<slug>/{alojamientos,eventos}/` | yes — **since 2026-08-04** (W2-3), tagged `list-accom`/`list-event` + `dest-<slug>` |
| `/{lang}/eventos/` and `/categoria/<c>/` and `/en/<loc>/` | yes — **since 2026-08-04** (W2-3), tagged `list-event` |
| `/{lang}/eventos/<slug>/` (detail) | yes — **since 2026-08-04** (W2-3), tagged `event-<slug>` + `event-<id>` |
| `/{lang}/publicaciones/` and `/{categoria,etiqueta,autor}/<x>/` | yes — **since 2026-08-04** (W2-3), tagged `list-post` |
| `/{lang}/publicaciones/<slug>/` (detail) | yes — **since 2026-08-04** (W2-3), tagged `post-<slug>` + `post-<id>` |
| `/{lang}/destinos/{atraccion,lugar}/<slug>/` | yes — **since 2026-08-04** (W2-4), tagged `attr-<slug>` / `poi-<slug>` (no collection tag exists) |
| `/{lang}/{gastronomia,experiencias}/` | yes — **since 2026-08-04** (W2-4), tagged `list-gastro` / `list-exp` |
| `/{lang}/{gastronomia,experiencias}/<slug>/` | yes — **since 2026-08-04** (W2-4), tagged `gastro-<slug>` / `exp-<slug>` + id |
| `/{lang}/partners/<slug>/` (detail, HOS-294) | origin has cached since launch, but the rule matches **only once W2-5 (HOS-519) is applied** — pending as of 2026-09-04. Tagged by `buildEntityCacheTags({ entity: 'partner', slug, id })`; no collection tag exists, same as attractions/POIs |
| `/{lang}/planes/{anfitriones,turistas,aliados,gastronomia,experiencias}/` and their `/precios/` siblings | origin has cached (`cacheClass: 'pricing'`) since these pages shipped, but the rule matches **only once W2-6 (HOS-519) is applied** — pending as of 2026-09-04 |
| `/{lang}/presentacion/{proveedores,gastronomia,alojamientos,aliados,editores,experiencias}/` | origin has cached (`cacheClass: 'static'`) since launch, but the rule matches **only once W2-6 (HOS-519) is applied** — pending as of 2026-09-04 |
| `/{lang}/autores/<slug>/` and `/page/N/` | origin has cached (`cacheClass: 'catalog'`, pagination-only) since launch, but the rule matches **only once W2-6 (HOS-519) is applied** — pending as of 2026-09-04 |
| `/{lang}/suscriptores/turistas/` and `/comparar/` | **no** — retired to a 301 redirect by HOS-1032 (commit `fed10a7af`, 2026-09-04); the `/{lang}/suscriptores/turistas` prefix in the expression now matches nothing cacheable (see [W2-6](#w2-6-hos-519--pricing-static-presentation-and-author-pages)) |
| `/{lang}/alojamientos/` and `/page/N/` | yes |
| `/{lang}/alojamientos/mapa/` | yes |
| `/{lang}/alojamientos/tipo/<type>/` | yes |
| `/{lang}/suscriptores/{planes,turistas}/` and `/comparar/` | yes |
| `/{lang}/alojamientos/<slug>/` (detail) | yes — **since 2026-08-04**, tagged `accom-<slug>` + `accom-<id>` |
| `/{lang}/alojamientos/<slug>/fotos/` | **no** |
| `/{lang}/alojamientos/comparar/` | **no** |
| `/{lang}/alojamientos/comodidades/<slug>/` | **no** |
| `/{lang}/alojamientos/caracteristicas/<slug>/` | **no** |
| `/{lang}/suscriptores/propietarios/` | **no** |

Everything in the second half returns `cf-cache-status: BYPASS` — the rule
matched, the origin did not opt in, `bypass_by_default` did its job. Note the
asymmetry among the facet landings: `tipo/` opts in, `comodidades/` and
`caracteristicas/` do not.

`/page/N/` is cached even though `page/[page].astro` contains no cache call at
all: it is an `Astro.rewrite` into `alojamientos/index.astro`, and the header is
set by the destination.

**Adding a family is an application change, not a Cloudflare change.** The rule
already matches these paths; the moment a page calls `applyCacheHeaders()` it
starts being cached, with no rule edit.

### The W2-2 pages have no purger of their own

The twelve copy-only pages are tagged `site-config`, which
`platform-settings.service.ts` purges. They do not read platform settings — the
tag is borrowed, because it is the only one in the vocabulary with a live
purger, and a cacheable response whose tag nobody ever purges is the silent
no-op `home` was stuck in before W2-1. A settings write evicts them for no
reason; the cost is a re-render.

What that leaves open: **nothing purges the cache on deploy.** There is no
purge step in `.github/workflows/` or in `hops`, and these pages change only on
deploy. So the 300s `s-maxage` is also the window in which a shipped copy
change is still invisible at the edge. That is the argument against giving them
a longer TTL, and it is the thing to fix first if one is ever wanted: add the
purge to the deploy, then raise the TTL — in that order, never the reverse.

### Verifying

The cache is per-PoP, so run every probe from the same place and pin the PoP via
the `cf-ray` suffix.

```bash
# eligibility + hit
curl -sS -o /dev/null -D - https://staging.hospeda.com.ar/es/alojamientos/ \
  | grep -iE '^(cf-cache-status|age|cf-ray|cache-control):'
```

Expected on the second request: `cf-cache-status: HIT`, non-zero `age`, and a
`Cache-Control` **without** `max-age=14400` (its presence means the Browser TTL
setting was lost).

```bash
# bypasses — all three must report DYNAMIC, never HIT
curl -sSI https://staging.hospeda.com.ar/es/alojamientos/ -H 'Cookie: better-auth.session_token=x'
curl -sSI https://staging.hospeda.com.ar/es/alojamientos/ -H 'Cookie: __Secure-better-auth.session_token=x'
curl -sSI 'https://staging.hospeda.com.ar/es/alojamientos/?types=HOTEL'
```

To prove a **purge** rather than an expiry, read the status, not the `age`:
Cloudflare returns `EXPIRED` when an object ages out naturally and `MISS` when
it was explicitly evicted. An `age` reset alone proves nothing. Bound the
confirmed-HIT → purge → probe sequence well inside the object's TTL and print
the elapsed seconds, or a slow run will read a natural expiry as a successful
purge.

Measured 2026-08-04: propagation ≤ ~4 s; purging `preview:list-accom` evicted
`/es/alojamientos/` and `/es/alojamientos/page/2/` while the `/_astro/*` chunks
kept climbing their `age` untouched (purge by tag is not affected by custom
cache keys and does not reach static assets).

Purge scoping was then measured in **both** directions, which is what makes it
a demonstration rather than a coincidence:

| Purged tag | Detail page (es/en/pt) | Listing |
|---|---|---|
| `preview:accom-<slug>` | **MISS ×3** | `HIT` — survived |
| `preview:list-accom` | `HIT` ×3 — survived | **MISS** |

W2-2 repeated the same two-direction check for the borrowed `site-config` tag,
against `/es/nosotros/`, `/es/legal/terminos/` and `/pt/colaborar/`. Both probes
ran 6–7 s after the purge — far enough inside the 300 s TTL that neither result
can be a natural expiry, and `MISS` rather than `EXPIRED` confirms an explicit
eviction:

| Purged tag | Static pages (3) | `/es/alojamientos/` |
|---|---|---|
| `preview:site-config` | **MISS ×3** | `HIT` — survived |
| `preview:list-accom` | `HIT` ×3 — survived | **MISS** |

### Measured on 2026-08-04, after W2-2 was applied

All 36 static-page URLs reached `HIT` on the second request, with a rising
`age`. The bypasses hold on every one of them:

| Probe on `/es/legal/terminos/` | Result |
|---|---|
| plain `GET` | `HIT` |
| `Cookie: better-auth.session_token=x` | `DYNAMIC` |
| `Cookie: __Secure-better-auth.session_token=x` | `DYNAMIC` |
| `?foo=1` | `DYNAMIC` |
| `HEAD` | `DYNAMIC` |

The `HEAD` row is not redundant. `curl -sSI` sends `HEAD`, the expression
requires `GET`, and a probe written that way therefore reports `DYNAMIC`
forever — on a zone where the cache is working perfectly. Probe with
`curl -sS -o /dev/null -D -`. This cost real debugging time on 2026-08-04.

The fail-closed choice of an exact path set over `starts_with` was confirmed by
measurement rather than left as an argument: `/es/legal/` — which
`starts_with(path, "/es/legal")` would have matched — returns `DYNAMIC`, as does
`/es/mi-cuenta/`.

### Measured on 2026-08-04, after W2-3 was applied

All fourteen catalog pages reach `HIT`. **Pagination was the point of the
exercise** and it caches, which is what proves `hasOnlyPaginationParams` was
needed: these URLs are `Astro.rewrite`s carrying `?page=N` into the parent
listing, so a `Astro.url.search === ''` gate would have left every one of them
private while page 1 kept working.

| Probe | Result |
|---|---|
| `/es/publicaciones/page/2/` | `HIT` |
| `/es/eventos/page/2/` | `HIT` |
| `/es/publicaciones/categoria/culture/page/2/` | `HIT` |
| `/es/destinos/colon/alojamientos/page/2/` | `HIT` |

Purge scoping, both directions, each probe 7 s after the purge:

| Purged tag | Post listing | Post detail | `/es/destinos/` | `/es/eventos/` |
|---|---|---|---|---|
| `preview:list-post` | **MISS** | `HIT` — survived | `HIT` | `HIT` |
| `preview:post-<slug>` | `HIT` — survived | **MISS** | `HIT` | `HIT` |

That first row is the whole argument for not tagging a detail page with its
collection, demonstrated: every post write evicts the listing without touching
any individual post's page. The last two columns show the families are isolated
from each other.

The six deliberately-excluded pages fail closed at **two different layers**,
which is worth knowing when reading a probe:

| Path | Result | Why |
|---|---|---|
| `/es/destinos/{atraccion,lugar}/<slug>/` | `BYPASS` | matches the `/es/destinos` prefix; origin never opts in |
| `/es/{gastronomia,experiencias}/` | `DYNAMIC` | no prefix in the expression at all |

`BYPASS` there is the `bypass_by_default` mechanism doing its job, not a defect.

One trap when probing by hand: an invented slug returns **404**, and the 404
guard runs BEFORE `applyCacheHeaders`, so the response carries no
`Cache-Control` at all and reads as `BYPASS`. That looks identical to "the page
refuses to cache" and is not. `/es/publicaciones/categoria/cultura/` is 404;
the real slugs are the lowercased `PostCategoryEnum` values (`culture`,
`tourism`, …). Always check the status code before concluding a page is
misconfigured.

### Measured on 2026-08-04, after W2-4 was applied

The four W2-4 surfaces that have data on staging all reach `HIT`:
`/es/gastronomia/`, `/es/experiencias/`, an experience detail, and two
attraction pages.

Purge scoping, each probe 7 s after the purge:

| Purged tag | `/es/experiencias/` | `/es/gastronomia/` | Experience detail | Attraction |
|---|---|---|---|---|
| `preview:list-exp` | **MISS** | `HIT` | `HIT` | `HIT` |

| Purged tag | `attr-centro-historico` | `attr-complejo-termal-principal` | `/es/experiencias/` | `/es/destinos/` |
|---|---|---|---|---|
| `preview:attr-centro-historico` | **MISS** | `HIT` | `HIT` | `HIT` |

The first table shows the two new commerce collections are isolated from each
other and from the detail pages. The second shows a per-entity tag evicts one
attraction without touching its sibling.

#### The many-to-many fan-out — verified end to end, 2026-08-05

A `curl` cannot trigger this one: confirming that editing a POI evicts every
destination page showing it needs a real write through `PointOfInterestService`,
which means the admin UI. It has now been run, and it passes.

One edit of `palacio_san_jose` (linked to Colón, Concepción del Uruguay and
Concordia) produced five purges, all `trigger = hook`, `status = success`:

```
preview:dest-colon                                pointOfInterest  success  hook
preview:dest-concepcion-del-uruguay               pointOfInterest  success  hook
preview:dest-concordia                            pointOfInterest  success  hook
preview:poi-palacio_san_jose                      pointOfInterest  success  hook
preview:poi-97b617e6-ce5c-4c6e-a6b0-cb2bb0c81b16  pointOfInterest  success  hook
```

Three destination tags from ONE write is the fan-out. All four pages went
`HIT` → `MISS`.

**Two things make the measurement mean something, and the first attempt had
neither.** Warm at 23:40:34, probe at 23:43:53 — 3m19s against a 300s TTL, so
expiry is arithmetically excluded. And the result is `MISS`, not `EXPIRED`:
`EXPIRED` is an object still present but aged out, `MISS` is an object that is
gone. An earlier attempt read three `HIT → EXPIRED` transitions as a working
fan-out; they were the TTL elapsing, and the tell was that the POI's own page —
warmed last, so still young — stayed `HIT`. Everything with an expired clock
fell and everything with a fresh one survived. That is a clock, not a purge.
Prefer the `revalidation_log` query above to cache-status inference: it shows
the service emitting the exact tags, and infers nothing.

#### What this took, and what it exposed

Setting the check up cost two bug fixes, both of which had been live since W2-4
shipped.

**The four W2-4 entity types had no `revalidation_config` row**, so
`scheduleRevalidation` returned at its config lookup and every purge for
`pointOfInterest`, `attraction`, `gastronomy` and `experience` was a silent
no-op on staging AND production. Fixed by seed baseline + data-migration `0036`,
plus a `logger.warn` on that branch and a derived static guard
(`every-entity-type-has-config.guard.test.ts`) that fails when any `entityType`
in the `EntityChangeData` union has no baseline row.

**The three relation mutators scheduled nothing.** `addPointOfInterestToDestination`,
`removePointOfInterestFromDestination` and `updatePointOfInterestDestinationRelation`
were never wired to the purge chain — only `_afterCreate` / `_afterUpdate` on the
POI row were. Linking a POI to a destination changes that destination's page (it
renders its `PRIMARY` POIs server-side) and evicted nothing. Unlinking carried
the subtler half: the link row is already gone by the time the purge runs, so
the one destination whose page actually changed is precisely the one the
relation table can no longer report. It has to be passed to the purge
explicitly.

Two notes for anyone re-running this:

- Staging shipped with **zero rows** in `r_destination_point_of_interest`, so a
  fan-out probe would have passed without fanning out to anything. Link the POI
  to two or more destinations first (admin → POI → Destinations).
- The relation edits now purge too, so **warm the pages after the links exist**,
  not before, or the first probe measures the link purge instead of the
  POI-edit fan-out.

#### What is still NOT verified by probing

Two W2-4 surfaces have no staging data to measure: a gastronomy detail page
(the listing renders no entries) and — until `0031` opened three of them — a POI
detail page gated on `hasOwnPage`.

### Purging from a shell

The probes must run from your own machine (the cache is per-PoP and the VPS
resolves to a different one), while the purge itself runs on the VPS so the
secret never leaves it:

```bash
ssh -p 2222 qazuor@216.238.103.219 'bash -lc "
CID=\$(docker ps --filter label=coolify.serviceName=hospeda-web-staging --format \"{{.Names}}\" | head -1)
S=\$(docker exec \$CID printenv HOSPEDA_REVALIDATION_SECRET | tr -d \"\\n\")
ENC=\$(printf %s \"\$S\" | jq -sRr @uri)
curl -sS -X POST -H \"Content-Type: application/json\" \
  -d \"{\\\"tags\\\":[\\\"preview:list-accom\\\"]}\" \
  \"https://staging.hospeda.com.ar/api/revalidate/?secret=\$ENC\"
"'
```

**Resolve the container by label, never by name.** Coolify assigns a new
container name on every redeploy, so a hardcoded name breaks silently the next
time the app ships: `docker exec` fails, the secret comes back empty, and the
purge returns `Unauthorized` — which looks like a credential problem and is not.

The trailing slash on `/api/revalidate/` is mandatory; without it Astro's
trailing-slash middleware answers 301 and the POST body is lost.

## `/i18n/<locale>.<hash>.js` — outside every rule on this page

Wave D moved the client translation dictionary out of the page HTML (~632 KB for
`es`, byte-identical on every page, 46.4% of a listing page) into a
content-addressed asset served by `apps/web/src/pages/i18n/[file].js.ts`.

**No rule on this page matches it, and none should.** The W1-2 rule requires
`http.request.uri.query eq ""` *and* one of its 24 path prefixes; `/i18n/` is not
one of them. The asset instead falls to Cloudflare's **default** caching for
static file extensions, which honours the origin's `Cache-Control: public,
max-age=31536000, immutable`.

That was a claim about Cloudflare's defaults rather than something this repo
controls, so it was **verified by measurement** like every other row on this
page. Re-run this after any change to the endpoint or the rule set:

```bash
# Read the current hash out of the page, then probe the asset twice.
URL=$(curl -sS https://staging.hospeda.com.ar/es/ | grep -o '/i18n/es\.[0-9a-f]\{8\}\.js' | head -1)
for i in 1 2; do
  curl -sS -o /dev/null -D - "https://staging.hospeda.com.ar$URL" \
    | grep -iE '^(HTTP|cf-cache-status|cache-control)'
done
```

Use `-o /dev/null -D -`, never `-I`: `-I` sends HEAD, and a HEAD never reports a
representative cache status.

### Measured on 2026-08-05, after W3-1 shipped

`/i18n/es.12bb2cea.js`, probed from Buenos Aires immediately after the staging
redeploy:

| probe | `cf-cache-status` | `age` |
|---|---|---|
| 1 | `MISS` | — |
| 2 | `HIT` | 5 |
| 3 | `HIT` | 10 |

`cache-control: public, max-age=31536000, immutable` is returned unchanged, so
Cloudflare's default static-extension caching does honour it. The served body is
658,231 B and its `sha256` prefix is `12bb2cea` — identical to the hash in the
URL, which is the property that makes `immutable` safe to claim.

Both 404 branches were confirmed through the edge, not just in unit tests: a
stale hash (`es.13640a05.js`, from a different build) and an unknown locale
(`zz.…`) each return 404.

**The HTML pages still cache.** `/es/alojamientos/` went `EXPIRED` → `HIT`
(`age: 3`) on consecutive requests with `s-maxage=300` intact — moving the
dictionary tag into `<head>` did not disturb W2-2/W2-3.

**This asset is never purged, by design.** The filename carries
`sha256(body).slice(0,8)`, so changing a translation produces a NEW URL and the
old one simply stops being requested. The endpoint 404s any hash that is not the
current one — without that, a stale URL would be answered with fresh content
under `immutable` headers and pinned for a year in every cache that asked, with
nothing able to invalidate it. That is also why the endpoint deliberately does
not call `applyCacheHeaders`: it carries no cache tag, because there is no purge
for a tag to trigger. Both cache-tag static guards in `apps/web` carry an
explicit exemption entry for it.

---

## `HOS-369 - staging /_image/ endpoint`

Makes Astro's on-demand image endpoint eligible for edge caching **on staging
only**.

- **Rule id**: `25e1a22682144e9683dbeae6deb57ca6`
- **Phase**: `http_request_cache_settings`
- **Order**: 2
- **Status**: active
- **Created**: 2026-08-05 (HOS-369)

### The problem it fixes

`/_image/` is Astro's image-transform endpoint: `apps/web` renders
`<Image>` / `<img src="/_image/?href=…&w=…&h=…&f=webp">`, and the ORIGIN decodes
and re-encodes the source image per request. Measured on the staging home
(2026-08-05, cold, Slow 4G + 4x CPU):

- every `/_image/` response returns **`cf-cache-status: DYNAMIC`** — Cloudflare
  never caches it, despite the origin sending
  `cache-control: public, max-age=31536000, immutable`
- **9 requests / 292 kB** on the home alone
- the LCP element (`/_image/?href=/_astro/hero-*.jpg&w=1200&h=835&f=webp`) had a
  **6,487 ms load duration**, the dominant term in a 15,266 ms LCP

Two independent reasons it is uncached, both of which this rule addresses:

1. The `HOS-369 W1-2` rule above requires `http.request.uri.query eq ""`. Every
   `/_image/` URL carries its parameters in the query string, so it can never
   match. It is not an oversight in that rule — that clause is what keeps
   filtered listing URLs out of the cache.
2. With no rule matching, Cloudflare falls back to its default behaviour, which
   caches by file extension. `/_image/` has no extension, so the default set
   does not cover it either.

### Expression

```
(http.host eq "staging.hospeda.com.ar"
 and http.request.method eq "GET"
 and starts_with(http.request.uri.path, "/_image/"))
```

Scoped to staging. Production is covered by its own twin, rule 3 — see
[Production twins](#production-twins). The zone is shared, so each host gets a
separate rule rather than one widened clause.

### Settings

| Setting | Value | API equivalent |
|---|---|---|
| Cache eligibility | Eligible for cache | `"cache": true` |
| Edge TTL | Use cache-control header if present, **bypass cache if not** | `edge_ttl.mode = "bypass_by_default"` |
| Browser TTL | Respect origin TTL | `browser_ttl.mode = "respect_origin"` |
| Cache key → query string | **Include all** (the default) | do NOT set `ignore_query_strings` |

```json
"action": "set_cache_settings",
"action_parameters": {
  "cache": true,
  "edge_ttl":    { "mode": "bypass_by_default" },
  "browser_ttl": { "mode": "respect_origin" }
}
```

> **Corrected 2026-08-15 (H-12).** The Edge TTL row read `respect_origin` from
> the day this section was written; the live rule has always been
> `bypass_by_default`. The 2026-08-12 pass found the discrepancy and left the row
> as written on purpose, so the drift stayed visible rather than being quietly
> papered over, asking for a deliberate correction after re-reading the live
> rule. That re-read happened on 2026-08-15, against the dashboard, control by
> control — hence this correction.
>
> No behavioural change either way: the origin always sends
> `cache-control: public, max-age=31536000, immutable` here, so both modes cache
> identically, and `bypass_by_default` is the safer of the two if it ever stops.
>
> Worth noting *which* row drifted. Rule 1 states its settings twice, as a table
> **and** as a JSON block, and both were correct. This rule stated them once, in
> prose. The JSON block above was added so this section gets checked the same way.

The cache key MUST keep the query string: `href`, `w`, `h` and `f` ARE the
image's identity. Ignoring it would serve one transform for every variant — the
hero at thumbnail size, or a WebP where an AVIF was asked for. This is the one
setting that turns the rule from a win into a visible bug, so it is called out
rather than left to the default.

No cookie or session clause is needed: the endpoint reads nothing but its query
parameters and returns no per-user content. It is already `x-robots-tag:
noindex, nofollow` at the origin.

### Purging

Not required, and no tag is emitted. The `href` parameter points at a
content-hashed build asset (`/_astro/hero-playa.1jJv_K_i.jpg`), so changing an
image produces a new hash, a new query string, and therefore a new cache key.
The old key simply stops being requested — the same reasoning as the i18n
dictionary asset above.

The exception is a **remote** `href` (`images.pexels.com`, Cloudinary): those
URLs are not content-hashed, so a replaced remote image keeps its cache key for
the full year. If that ever matters, purge by URL; do not shorten the TTL for
everyone to cover it.

### Verifying

```bash
# First request may be MISS; the second must be HIT with a non-zero age.
URL='https://staging.hospeda.com.ar/_image/?href=%2F_astro%2Fhero-playa.1jJv_K_i.jpg&w=1200&h=835&f=webp'
curl -sS -o /dev/null -D - "$URL" | grep -iE '^(cf-cache-status|age|cf-ray):'
curl -sS -o /dev/null -D - "$URL" | grep -iE '^(cf-cache-status|age|cf-ray):'
```

Use `GET`, not `curl -I`: a `HEAD` does not match `http.request.method eq "GET"`
and will report `DYNAMIC` even once the rule is live.

Then confirm the variants stay distinct — the two must differ in body size:

```bash
curl -sS -o /dev/null -w '%{size_download}\n' 'https://staging.hospeda.com.ar/_image/?href=%2F_astro%2Fhero-playa.1jJv_K_i.jpg&w=1200&h=835&f=webp'
curl -sS -o /dev/null -w '%{size_download}\n' 'https://staging.hospeda.com.ar/_image/?href=%2F_astro%2Fhero-playa.1jJv_K_i.jpg&w=400&h=300&f=webp'
```

### Verification run (2026-08-05, at deploy)

Against the three `srcset` variants the staging home actually emits for the hero:

| Variant | Body | 1st request | 2nd request |
|---|---|---|---|
| `w=1200&h=835&f=webp` | 49,564 B | `MISS` | `HIT`, `age: 19` |
| `w=480&h=334&f=webp` | 12,394 B | `MISS` | `HIT`, `age: 0` |
| `w=800&h=557&f=webp` | 28,952 B | `HIT` | `HIT` |

Three distinct body sizes, each with its own `MISS → HIT` cycle: the cache key
kept the query string, so every transform is its own entry. Production answered
`DYNAMIC` in that same run, as intended at the time — it had no rule yet.

> **Superseded.** Production got its own `/_image/` rule on 2026-08-12 (rule 3)
> and answers `HIT`. Re-measured on both hosts 2026-08-15.

One caveat worth knowing: the request issued seconds after deploying the rule
returned `DYNAMIC` while it was still propagating, then settled into `HIT`. A
single `DYNAMIC` immediately after a change is propagation, not a broken
expression — re-probe before concluding anything.

---

## Production twins

Activated **2026-08-12**, after the August batch shipped to `main` and the
production containers were redeployed. Both are byte-for-byte duplicates of the
staging rules above with a single edit — `http.host eq "hospeda.com.ar"` — made
through the dashboard's own **Duplicate rule**, so the 2,419-character catalog
expression was never retyped.

| Order | Rule | Rule id |
|---|---|---|
| 3 | `HOS-369 - prod /_image/ endpoint` | `d248f233545042ed948f69dfa1527bee` |
| 4 | `HOS-369 W1-2 - prod catalog + subscriber` | `3c106fee17d945b693d5db86857e3d59` |

Ids read from the dashboard 2026-08-15, along with a clause-by-clause check that
each twin matches its staging original: rule 3's host/method/path, and rule 4's
`{"GET" "PURGE"}`, empty-query, session-cookie and full 36-path + 24-prefix set.
Both twins' settings match their originals exactly, `bypass_by_default` included.

### Why they could be lifted now

The staging rules carried the note *"Production is behind on the branch that
emits `Cache-Tag`; caching HTML there would produce objects nothing can purge
selectively. Lift this only after staging is promoted."* That precondition was
verified by measurement rather than assumed, and the check is worth repeating
before touching these rules again: **Cloudflare strips `Cache-Tag` from the
response before it reaches the client**, so probing from outside proves nothing.
Ask the origin directly, from the VPS, bypassing the edge:

```bash
curl -sSk --resolve hospeda.com.ar:443:127.0.0.1 -o /dev/null -D - \
  https://hospeda.com.ar/es/alojamientos/ | grep -i cache-tag
# cache-tag: prod:all,prod:list-accom
```

Staging answers `preview:all,preview:list-accom` on the same probe. The
namespaces are disjoint, which is what keeps a production purge from evicting
staging objects on the shared zone.

### Verified after activation (2026-08-12)

| Check | Result |
|---|---|
| Home `/es/`, `/en/`, `/pt/` | `MISS` → `HIT` |
| Catalog: alojamientos, destinos, eventos, publicaciones, gastronomía, experiencias | `MISS` → `HIT` |
| Accommodation detail page | `MISS` → `HIT` |
| Copy-only (`/es/legal/terminos/`, `/es/colaborar/editores/`) | `MISS` → `HIT` |
| Listing **with** a query filter (`?types=HOTEL`) | `DYNAMIC`, both probes |
| Request carrying `better-auth.session_token` | `DYNAMIC` |
| Request carrying `__Secure-better-auth.session_token` | `DYNAMIC` |
| `/_image/` | `MISS` → `HIT`, `content-type: image/avif` |
| `/_image/` at `w=800` and `w=1200` | `MISS` each, while `w=480` stayed `HIT` |
| Effective TTL on `/es/` | `s-maxage=3600`, `age` climbing, **no injected `max-age`** |

That last row is the one to re-check after any edit: an injected
`max-age=14400` would mean Browser TTL slipped off *Respect origin* and
returning visitors are holding HTML no purge can reach.

### Documentation drift found while duplicating

The `/_image/` section above documents **Edge TTL = `respect_origin`**. The
live staging rule is actually **`bypass_by_default`** ("use cache-control if
present, bypass if not"). The production twin replicates the **live** rule, not
the documented one — what is deployed and measured wins over what was written
down. For `/_image/` the two behave identically in practice, because the origin
always sends `cache-control: public, max-age=31536000, immutable` on that
endpoint; the difference only appears if the origin ever stops doing so, where
`bypass_by_default` is the safer of the two. The table above has been left as
written so the drift stays visible rather than being quietly papered over —
correct it deliberately, after re-reading the live rule.
