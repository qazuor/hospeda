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
    { path: '/suscriptores/planes/', changefreq: 'weekly', priority: 0.8 },
    { path: '/suscriptores/planes/comparar/', changefreq: 'monthly', priority: 0.7 },
    { path: '/suscriptores/propietarios/', changefreq: 'monthly', priority: 0.8 },
    { path: '/suscriptores/turistas/', changefreq: 'monthly', priority: 0.8 },
    { path: '/suscriptores/turistas/comparar/', changefreq: 'monthly', priority: 0.7 },
    { path: '/publicar/', changefreq: 'monthly', priority: 0.8 },
    { path: '/publicar-restaurante/', changefreq: 'monthly', priority: 0.7 },
    { path: '/publicar-experiencia/', changefreq: 'monthly', priority: 0.7 },

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
 * `/mi-cuenta/`, `/feedback/`) are absent by construction — they are also
 * `Disallow`ed in robots.txt — so the guard filters them before consulting
 * this map.
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
    '/alojamientos/comparar/': 'noindex',
    '/alojamientos/mapa/': 'noindex',
    '/destinos/mapa/': 'noindex',
    '/suscriptores/plan1/': 'noindex',
    '/newsletter/confirma-tu-email/': 'noindex',
    '/newsletter/confirmado/': 'noindex',
    '/newsletter/desuscripto/': 'noindex',
    '/newsletter/error/': 'noindex',

    // Host-only draft creation form; redirects anonymous visitors to login.
    '/publicar/nueva/': 'auth-guarded',

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
