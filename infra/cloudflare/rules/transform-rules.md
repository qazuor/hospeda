# Transform Rules (URL Rewrite)

Mirror of the URL Rewrite Rules for the zone `hospeda.com.ar`. See
[`../README.md`](../README.md) for why these rules are documented here and not
applied from code, and for the shared-zone constraint every rule must follow.

Dashboard path: **hospeda.com.ar → Rules → Overview → Create rule → URL Rewrite Rule**.

Current state: **0 active rules.** The two rules below are **drafted and not applied**
(HOS-2359, owner decision OD-6). The owner applies them by hand. Nobody else does.

---

## `HOS-2359 - <env> strip utm before cache`

### What it is for

Campaign links (email, share buttons, QR codes, `/go/` short links) arrive with
`utm_*` params in the query. The cache rules in [`cache-rules.md`](cache-rules.md)
(rule 1 for staging, rule 4 for production) require `http.request.uri.query eq ""`.
So `/es/alojamientos/?utm_source=whatsapp` measured `DYNAMIC`. Every campaign visit
went to the origin, and the cache was useless for exactly the traffic a campaign
brings in.

On the Free plan, a Cache Rule cannot drop single params from the cache key, because
"Query string" cache-key control is Enterprise-only (see `cache-rules.md`, "Ignore
query string"). A URL Rewrite Rule runs in `http_request_transform`, **before** the
cache phase. It removes the five `utm_*` params, so a request whose only params were
`utm_*` reaches rules 1 and 4 with an empty query. It then shares the plain URL's
cache object.

What is unchanged:

- **The browser URL.** A rewrite happens on the server side only. The Umami tracker
  still reads the UTMs from `location`, so attribution keeps working.
- **Any other param.** It stays in the query. The request still fails
  `query eq ""` and behaves exactly as it does today (`DYNAMIC`).
- **The origin.** It no longer sees `utm_*` on the matched paths. No server code reads
  them: `rg utm_ apps/*/src` finds only comments, and the part-1 guards keep it that
  way.

### Plan check (Free), from the Cloudflare docs, 2026-11-23

| Needed | Free plan | Source |
|---|---|---|
| URL Rewrite Rules (Transform Rules) | **Yes.** 10 active Transform Rules. No regex, and we use none. | [Transform Rules → Availability](https://developers.cloudflare.com/rules/transform/#availability) |
| Dynamic rewrite without regex | **Yes.** "Free and Pro plans support string matching rules … that do not require regular expressions". The example is a dynamic `concat()` rewrite. | [Images → Serve from custom paths](https://developers.cloudflare.com/images/optimization/transformations/rewrite-rules/) |
| `http.request.uri.args.names` in the filter | **Yes.** URL rewrite filters accept `http.request.uri.*`. | [URL rewrite → Available fields and functions](https://developers.cloudflare.com/rules/transform/url-rewrite/reference/fields-functions/), [field reference](https://developers.cloudflare.com/ruleset-engine/rules-language/fields/reference/http.request.uri.args.names/) |
| `any(...[*])` | **Yes.** It is a core Rules-language function with no plan gate. The field page shows `any(http.request.uri.args.names[*] == "search")`. | [Functions → any](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/), [Values → Arrays](https://developers.cloudflare.com/ruleset-engine/rules-language/values/) |
| `remove_query_args()` | **Yes.** It is allowed "in rewrite expressions of Transform Rules", with no plan restriction. The `field` must be `http.request.uri.query`. Each param is named explicitly, and every repeated occurrence of a named param is removed. | [Functions → remove_query_args](https://developers.cloudflare.com/ruleset-engine/rules-language/functions/) |
| Rewrite runs before the cache | **Yes.** Execution order: Single Redirects → **URL Rewrite Rules** → … → **Cache Rules**. Fields "will have a different value in phases after `http_request_transform`". | [Cache Rules → Order](https://developers.cloudflare.com/cache/how-to/cache-rules/order/), [Field values during rule evaluation](https://developers.cloudflare.com/ruleset-engine/about/rules/#field-values-during-rule-evaluation) |
| Expression length | 4,096 characters, on any plan. The rule below is about 3,140. | [Expressions](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/) |

**One point the docs do not show literally.** They document `[*]` on transformation
functions (`any(lower(names[*])[*] == "x")`), but none of their examples calls
`starts_with(names[*], "utm_")` on an array. The dashboard checks the expression when
you save it. If it rejects the `starts_with` form, use the **fallback clause** below.
The fallback is built only from shapes the docs show verbatim.

**Quota.** This adds 2 of the 10 Transform Rules. This repo documents no other
Transform Rule, but the dashboard has drifted from this directory before (see
`cache-rules.md`, W2-5). Count the rules in the dashboard before adding these two.

### Filter expression (staging)

Build it from the **live** rule 1 expression, not from this page. `cache-rules.md`
says the same thing: read the dashboard first. Make two edits and nothing else:

1. Replace `http.request.uri.query eq ""` with
   `any(starts_with(http.request.uri.args.names[*], "utm_"))`.
2. Add `and ends_with(http.request.uri.path, "/")` right after it.

Keep everything else exactly as rule 1 has it: the host, the method set, the
session-cookie exclusion, the exact path set and the 36 prefixes. As documented
today, that gives:

```
(http.host eq "staging.hospeda.com.ar"
 and http.request.method in {"GET" "PURGE"}
 and any(starts_with(http.request.uri.args.names[*], "utm_"))
 and ends_with(http.request.uri.path, "/")
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
   or starts_with(http.request.uri.path, "/es/comer-y-salir")
   or starts_with(http.request.uri.path, "/en/gastronomia")
   or starts_with(http.request.uri.path, "/en/comer-y-salir")
   or starts_with(http.request.uri.path, "/pt/gastronomia")
   or starts_with(http.request.uri.path, "/pt/comer-y-salir")
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

**Production twin** (`HOS-2359 - prod strip utm before cache`): change only the first
line, to `http.host eq "hospeda.com.ar"`. Build it from the live **rule 4**.

**Fallback clause.** Use it only if the dashboard rejects step 1. It goes in the same
place:

```
(any(http.request.uri.args.names[*] == "utm_source")
  or any(http.request.uri.args.names[*] == "utm_medium")
  or any(http.request.uri.args.names[*] == "utm_campaign")
  or any(http.request.uri.args.names[*] == "utm_content")
  or any(http.request.uri.args.names[*] == "utm_term"))
```

It is a little stricter: an unknown `utm_*` param on its own, such as `utm_id`, does
not trigger the rewrite. That makes no difference. The rewrite would leave such a
param in the query anyway, so the request would stay uncached either way.

### Action

| Setting | Value |
|---|---|
| Path | Preserve |
| Query | Rewrite to → **Dynamic** |
| Expression | `remove_query_args(http.request.uri.query, "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term")` |

The five names are the full vocabulary `withUtm()` emits (`@repo/analytics`, OD-4),
plus `utm_term`, which external tools add.

### Why each clause

- **`http.host`.** The zone is shared by production and staging (README). One twin
  per host.
- **The utm-name clause** (instead of `query eq ""`). It touches only requests that
  carry a utm param. Requests without one are left alone, and rule 1 or 4 decides
  them as today.
- **`ends_with(path, "/")`.** A slashless path gets the trailing-slash redirect from
  the origin. If the rewrite ran first, that redirect would lose the UTMs, because the
  origin never saw them. Every page in the exact set and every canonical URL under the
  prefixes ends in `/`.
- **The locale prefix** is already part of every path in the set. A locale-less path
  (`/alojamientos/?utm_source=x`) never matches, so the locale redirect still sees and
  copies the query.
- **The session-cookie exclusion and the path set** are copied from rule 1 or 4. The
  rewrite runs only where the cache rule would then cache. Anywhere else, removing the
  UTMs would gain nothing and would only hide them from the origin.

### Residual risk: known losses

A redirect the origin issues on a matched path loses the UTMs, because the origin
received the rewritten query. The middleware's own redirects with `Cache-Control:
no-store` (locale and trailing slash) are excluded by the clauses above. What remains
are the `resolveLegacyRedirectTarget` sources (`apps/web/src/lib/legacy-redirects.ts`,
`catalog-retired-slugs.ts`) that live under a cached prefix and end in `/`:

| Source (any locale) | Redirects to |
|---|---|
| `/{l}/gastronomia/…` | `/{l}/comer-y-salir/…` |
| `/{l}/planes/gastronomia/…` | `/{l}/planes/comer-y-salir/…` |
| `/{l}/presentacion/gastronomia/…` | `/{l}/presentacion/comer-y-salir/…` |
| `/{l}/publicaciones/autor/…` | `/{l}/autores/…` |
| `/{l}/alojamientos/tipo/<legacy English slug>/` | the Spanish slug |
| `/{l}/eventos/categoria/<legacy English slug>/` | the Spanish slug |
| `/{l}/publicaciones/categoria/<legacy English slug>/` | the Spanish slug |
| `/{l}/alojamientos/{comodidades,caracteristicas}/<retired slug>/` | the surviving slug's landing |

These are **known losses**. A campaign link built on one of these old URLs arrives
without UTMs. Every link Hospeda generates today points at the canonical URL
(`withUtm` on the entity URL, `/go/` → `/es/presentacion/<audience>/`, QR →
`targetUrl`), so none of them takes this path. These redirects carry no query, so
they get no `no-store` either. They stay out of the cache because rules 1 and 4 use
`bypass_by_default` and a redirect response does not opt in.

The `/` root is not affected. The edge Single Redirect (`redirect-rules.md`) runs
**before** the rewrite and keeps the query string.

### Verifying (run by the owner after applying, on staging first)

Use `GET` requests. `curl -I` makes a working rule look dead (`cache-rules.md`,
"What needs a rule").

```bash
U=https://staging.hospeda.com.ar/es/presentacion/alojamientos/
curl -s -o /dev/null -D - "$U" | grep -i cf-cache-status                                       # MISS, then HIT
curl -s -o /dev/null -D - "$U?utm_source=whatsapp&utm_medium=share" | grep -i cf-cache-status  # HIT (same object)
curl -s -o /dev/null -D - "$U?utm_source=x&foo=1" | grep -i cf-cache-status                    # DYNAMIC (other param untouched)
curl -s -o /dev/null -D - "https://staging.hospeda.com.ar/alojamientos/?utm_source=x" | grep -iE "^location|^cache-control"
#   Location: /es/alojamientos/?utm_source=x  and  Cache-Control: no-store  (origin locale redirect, HOS-2359 §6.C.3)
```

The last check uses a locale-less path on purpose. `/?utm_source=x` is answered by
the edge Single Redirect, which keeps the query but never sets `no-store`. It does not
test the origin.

Then open `$U?utm_source=whatsapp&utm_medium=share&utm_campaign=presentacion-alojamientos`
in a browser and confirm that Umami → Realtime shows the visit with those UTMs. That
proves the browser URL kept them.

### Rollback

Disable the rule in the dashboard. Nothing in the code depends on it. Without the
rule, campaign visits are `DYNAMIC` again, which is how they behaved before HOS-2359.
