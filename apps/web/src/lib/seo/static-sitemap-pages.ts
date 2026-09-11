/**
 * @fileoverview
 * The curated set of locale-agnostic, parameter-free pages served by
 * `/sitemap-static.xml`, plus the classification of every parameter-free page
 * deliberately left out of it.
 *
 * WHY AN EXPLICIT LIST: these pages cannot be discovered at runtime. The app
 * renders every route on demand, so there is no build-time page manifest to
 * read, and "is this page indexable?" is not derivable from the route path —
 * it depends on the `noindex` prop, in-page auth guards, and whether the page
 * is a redirect. Guessing produces a sitemap advertising login walls and
 * payment-return URLs.
 *
 * WHY THE EXCLUSION MAP: an allowlist alone rots — a new page is simply
 * forgotten. `test/lib/seo/static-sitemap-pages.guard.test.ts` walks
 * `src/pages/[lang]` and fails CI when a parameter-free page appears in
 * neither list, forcing whoever adds a page to classify it once.
 *
 * Entity detail pages, listing pages and facet landings are NOT here — they
 * are DB-driven and live in `/sitemap-dynamic.xml`.
 */

/** A page emitted into the static sitemap, once per locale. */
export interface StaticSitemapPage {
    /**
     * Locale-agnostic path with a leading and trailing slash. `/` is the home
     * page, which renders at `/es/`, `/en/` and `/pt/`.
     */
    readonly path: string;
    /** Sitemap `changefreq` hint. */
    readonly changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
    /** Sitemap priority, relative to the rest of THIS site. */
    readonly priority: number;
}

/**
 * Marketing and informational pages, in sitemap order.
 *
 * Priorities follow the site's own conversion hierarchy: home first, then the
 * plan/publish funnel that turns visitors into hosts, then supporting
 * marketing, then legal boilerplate (which must be crawlable but never
 * outranks real content).
 */
export const STATIC_SITEMAP_PAGES: readonly StaticSitemapPage[] = [
    // Home.
    { path: '/', changefreq: 'daily', priority: 1.0 },

    // Conversion funnel: plans and publishing.
    //
    // HOS-942 turned `/suscriptores/planes/` into the five-audience INDEX and
    // moved the two pricing pages under it. HOS-1032 then moved every pricing
    // page again, into the `/planes/` namespace HOS-941 D-8 settled on, so the
    // family is now three levels deep and each level is listed here once:
    //
    //   /suscriptores/planes/       index      (H8 moves it to `/planes/`)
    //   /planes/<audiencia>/        sales      (level 2, HOS-985)
    //   /planes/<audiencia>/precios/  pricing  (level 3, HOS-1032)
    //
    // The URLs that used to serve pricing — `/suscriptores/planes/anfitriones/`,
    // `/suscriptores/planes/turistas/`, both `/comparar/` pages, and the two
    // `/publicar-*` landings — are 301s now and LEFT this list, because a
    // sitemap advertising a redirect asks a crawler to spend a request learning
    // the URL moved. They are classified below in the exclusion map instead,
    // which is what keeps the guard from flagging them as unclassified pages.
    { path: '/suscriptores/planes/', changefreq: 'weekly', priority: 0.8 },
    { path: '/publicar/', changefreq: 'monthly', priority: 0.8 },
    // HOS-1156: one publish page per vertical. All three are public, indexable
    // and carry their own copy, so all three belong here — they are the pages a
    // restaurant owner searching "publicar mi restaurante" should land on, and
    // until now that search had nowhere to land at all inside this namespace.
    { path: '/publicar/gastronomia/', changefreq: 'monthly', priority: 0.8 },
    { path: '/publicar/experiencias/', changefreq: 'monthly', priority: 0.8 },
    // HOS-985: level 2 of the three-level structure (HOS-941 D-7) — the sales
    // page for a vertical, with its prices one level below at
    // `/planes/<audiencia>/precios/`. `gastronomia`, not `restaurantes`: D-9,
    // because HOS-986 is open over "restaurante" reading as excluding food
    // trucks, rotiserías and parrillas, and a URL is the most expensive place
    // to carry that word.
    { path: '/planes/gastronomia/', changefreq: 'monthly', priority: 0.7 },
    // HOS-985: the experience vertical's own level-2 sales page, alongside
    // gastronomy's above.
    { path: '/planes/experiencias/', changefreq: 'monthly', priority: 0.7 },
    // HOS-985: the host-audience level-2 sales page. It inherits the priority
    // the retired `/suscriptores/propietarios/` landing carried, since it is
    // the page that URL now 301s to.
    { path: '/planes/anfitriones/', changefreq: 'monthly', priority: 0.8 },
    // HOS-985: the traveller audience's level-2 sales page. It is the only one
    // of the five that had NO landing before, so it is a genuinely new
    // indexable URL rather than a relocation.
    { path: '/planes/turistas/', changefreq: 'monthly', priority: 0.8 },
    // HOS-985: the partner audience's level-2 sales page. `/sumate/partner/`
    // below still answers 200 and keeps its entry: it holds the lead form both
    // partner pages send people to, and cannot 301 into this family until that
    // form has a home inside it.
    { path: '/planes/aliados/', changefreq: 'monthly', priority: 0.8 },

    // HOS-1032: level 3 — the five pricing pages. They carry the priority the
    // URLs they replace had, because they are the same content at a new
    // address, and each is the page that answers "cuánto cuesta …" for its
    // audience, which is a search intent distinct from its sales page's.
    //
    // The three verticals' entries are NEW rather than relocated: no pricing URL
    // ever existed for gastronomy, experiences or aliados. Their price moved
    // DOWN out of a landing that keeps serving, rather than ACROSS from a page
    // that stopped — which is also why no redirect points at them.
    { path: '/planes/anfitriones/precios/', changefreq: 'weekly', priority: 0.8 },
    { path: '/planes/turistas/precios/', changefreq: 'monthly', priority: 0.8 },
    { path: '/planes/gastronomia/precios/', changefreq: 'monthly', priority: 0.7 },
    { path: '/planes/experiencias/precios/', changefreq: 'monthly', priority: 0.7 },
    { path: '/planes/aliados/precios/', changefreq: 'monthly', priority: 0.7 },

    // Partner / collaborator acquisition.
    { path: '/sumate/partner/', changefreq: 'monthly', priority: 0.6 },
    { path: '/sumate/proveedor/', changefreq: 'monthly', priority: 0.6 },
    { path: '/sumate/sponsor/', changefreq: 'monthly', priority: 0.6 },
    // `/partners/` is gone (HOS-294 D-4). The filtered directory was deleted and
    // the URL now 404s; a gold partner's own page is emitted by the DYNAMIC
    // sitemap instead, since it is DB-driven. Note that the guard below cannot
    // catch this line on its own: it walks `src/pages/[lang]` and fails on a
    // page that is classified nowhere, but an entry here whose page was deleted
    // is invisible to it — it would have kept advertising a 404 with CI green.
    { path: '/colaborar/', changefreq: 'monthly', priority: 0.6 },
    { path: '/colaborar/editores/', changefreq: 'monthly', priority: 0.5 },
    { path: '/colaborar/fotos/', changefreq: 'monthly', priority: 0.5 },
    { path: '/colaborar/reportar/', changefreq: 'monthly', priority: 0.5 },

    // Supporting marketing content.
    { path: '/nosotros/', changefreq: 'monthly', priority: 0.6 },
    { path: '/beneficios/', changefreq: 'monthly', priority: 0.6 },
    { path: '/funcionalidades/', changefreq: 'monthly', priority: 0.6 },
    { path: '/preguntas-frecuentes/', changefreq: 'monthly', priority: 0.6 },
    { path: '/contacto/', changefreq: 'yearly', priority: 0.5 },
    { path: '/integraciones/google-calendar/', changefreq: 'yearly', priority: 0.4 },

    // Legal.
    { path: '/legal/terminos/', changefreq: 'yearly', priority: 0.3 },
    { path: '/legal/privacidad/', changefreq: 'yearly', priority: 0.3 },
    { path: '/legal/cookies/', changefreq: 'yearly', priority: 0.3 }
] as const;

/** Why a parameter-free page is kept out of the static sitemap. */
export type StaticSitemapExclusionReason =
    /** Already emitted by `/sitemap-dynamic.xml`. */
    | 'in-dynamic-sitemap'
    /** The page sends `noindex`, so advertising it would contradict its own head. */
    | 'noindex'
    /** Guarded by an in-page auth check that redirects anonymous visitors. */
    | 'auth-guarded'
    /** A redirect or a payment-provider return target, never a landing page. */
    | 'transactional'
    /** Reachable only through a one-time emailed token. */
    | 'token-gated';

/**
 * Every other parameter-free page under `src/pages/[lang]`, and why it is not
 * in {@link STATIC_SITEMAP_PAGES}.
 *
 * Pages under the `SITEMAP_EXCLUDED_PATHS` prefixes (`/auth/`,
 * `/mi-cuenta/`, `/feedback/`, `/presentacion/`) are absent by construction —
 * they are also `Disallow`ed in robots.txt — so the guard filters them before
 * consulting this map.
 *
 * That is why HOS-978's six commercial presentations are not listed
 * individually below: adding `/presentacion/` to the shared prefix list covers
 * all six at once, in the one place that also drives the robots.txt
 * `Disallow`. Listing them here as well would be redundant, and the guard
 * would never reach the entries.
 */
export const NON_SITEMAP_STATIC_PAGES: Readonly<Record<string, StaticSitemapExclusionReason>> = {
    // Listing pages: emitted with fresh `lastmod` by the dynamic sitemap.
    '/alojamientos/': 'in-dynamic-sitemap',
    '/destinos/': 'in-dynamic-sitemap',
    '/eventos/': 'in-dynamic-sitemap',
    '/gastronomia/': 'in-dynamic-sitemap',
    '/experiencias/': 'in-dynamic-sitemap',
    '/publicaciones/': 'in-dynamic-sitemap',

    // Utility views that declare `noindex={true}`.
    // HOS-609: the admin redirects here when an authenticated user lacks
    // ACCESS_PANEL_ADMIN. Nobody navigates to it on purpose and it says
    // nothing to a crawler.
    '/acceso-denegado/': 'noindex',
    '/alojamientos/comparar/': 'noindex',
    '/alojamientos/mapa/': 'noindex',
    '/destinos/mapa/': 'noindex',
    '/suscriptores/plan1/': 'noindex',
    '/newsletter/confirma-tu-email/': 'noindex',
    '/newsletter/confirmado/': 'noindex',
    '/newsletter/desuscripto/': 'noindex',
    '/newsletter/error/': 'noindex',

    // Redirect-only since HOS-1156: the draft-creation form was absorbed into
    // `/publicar/`, which now carries it directly, so this URL 301s there. It
    // was classified `auth-guarded` while it existed as a page — that is no
    // longer what it is.
    '/publicar/nueva/': 'transactional',

    // Redirect-only since HOS-942, retargeted by HOS-1032: the tourist pricing
    // page went to `/suscriptores/planes/turistas/` and then on to
    // `/planes/turistas/precios/`, and this URL now 301s straight to the latter
    // rather than chaining through the former. It must stay out of the sitemap
    // — one that keeps advertising it would be handing crawlers a URL that
    // never serves content again.
    '/suscriptores/turistas/': 'transactional',

    // Redirect-only since HOS-1032. The five pricing URLs the `/planes/`
    // namespace replaced (HOS-941 D-8), plus the two comparison pages whose
    // table moved onto the pricing page itself (D-11) and the two commerce
    // landings whose price block moved down a level (D-9 for the slug).
    //
    // All seven leave the sitemap in the SAME change that turns them into
    // redirects. Their successors are listed above; a sitemap naming both would
    // be advertising two URLs for one page and spending a crawl request to
    // learn that one of them moved.
    '/suscriptores/planes/anfitriones/': 'transactional',
    '/suscriptores/planes/turistas/': 'transactional',
    '/suscriptores/planes/comparar/': 'transactional',
    '/suscriptores/turistas/comparar/': 'transactional',
    // HOS-1156 retargeted these two: their 301 now points at the vertical's
    // PUBLISH page rather than its sales page, overriding HOS-941 D-8. The URL's
    // own name said *publicar*, and it finally leads there. Still redirect-only,
    // so still excluded.
    '/publicar-restaurante/': 'transactional',
    '/publicar-experiencia/': 'transactional',

    // Redirect-only since HOS-985: the owner landing was retired (HOS-941
    // D-12 — it was `/publicar/` minus the auth-aware parts, reading the same
    // `owners.*` copy) and this URL 301s to `/planes/anfitriones/`. Same rule
    // as the entry above: it leaves the sitemap in the change that turns it
    // into a redirect.
    '/suscriptores/propietarios/': 'transactional',

    // MercadoPago return targets and the redirect-only checkout root.
    '/suscriptores/checkout/': 'transactional',
    '/suscriptores/checkout/success/': 'transactional',
    '/suscriptores/checkout/failure/': 'transactional',
    '/suscriptores/checkout/pending/': 'transactional',
    '/partners/checkout/pending/': 'transactional',

    // Guest-messaging landings, reachable only via an emailed access token.
    '/guest/messages/request-access/': 'token-gated',
    '/guest/messages/verify-expired/': 'token-gated'
} as const;
