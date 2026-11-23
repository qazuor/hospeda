/**
 * @file presentation-links.ts
 * @description The commercial presentations and their `/go/<slug>/` short links
 * (HOS-2359 §6.D.2, owner decision OD-5).
 *
 * The team sends presentations by hand (WhatsApp, Facebook, X, Telegram or a
 * copied link). Each send uses a short link that 302s to the canonical
 * presentation page with campaign UTMs, so Umami can tell which channel brought
 * the visit. The canonical pages themselves never redirect and never carry UTMs.
 *
 * - `PRESENTATIONS` is the single list: the `/presentacion/` index renders it and
 *   the short links are derived from it.
 * - `PRESENTATION_SHORT_LINKS` is the full product audiences x channels (30), built
 *   by a function so a new presentation or channel cannot be half-wired.
 */
import {
    DIRECT_OUTREACH_SOURCES,
    type DirectOutreachUtmParams,
    type PresentationAudience,
    withUtm
} from '@repo/analytics';
import type { HospedinPose } from '@/lib/presentacion/hospedin-pose';

/** One presentation listed on the `/presentacion/` index. */
export interface PresentationEntry {
    /** The `/presentacion/<slug>/` segment, also the UTM audience. */
    readonly slug: PresentationAudience;
    readonly name: string;
    readonly audience: string;
    readonly headline: string;
    /** The Hospedín pose that page's masthead uses, so the card previews it. */
    readonly pose: HospedinPose;
}

/** Every `/presentacion/<slug>/` page, in the order the index lists them. */
export const PRESENTATIONS: readonly PresentationEntry[] = [
    {
        slug: 'alojamientos',
        name: 'Alojamientos',
        audience: 'Cabañas, casas, departamentos, hoteles y complejos',
        headline: 'Publicá tu alojamiento en Hospeda',
        pose: 'telefono'
    },
    {
        slug: 'comer-y-salir',
        name: 'Comer y salir',
        audience: 'Restaurantes, bares, cafés, cervecerías y boliches',
        headline: 'Tu local donde se planea el viaje',
        pose: 'senalando'
    },
    {
        slug: 'experiencias',
        name: 'Experiencias',
        audience: 'Excursiones, paseos, alquileres, clases y actividades',
        headline: 'Publicá lo que le ofertás al turista',
        pose: 'vamos'
    },
    {
        slug: 'proveedores',
        name: 'Proveedores',
        audience: 'Oficios y servicios para los anfitriones',
        headline: 'Sumate como proveedor de servicios',
        pose: 'lamparita'
    },
    {
        slug: 'aliados',
        name: 'Aliados',
        audience: 'Comercios, municipios, instituciones y organizaciones',
        headline: 'Acompañá al turismo del Litoral',
        pose: 'te-explico'
    },
    {
        slug: 'editores',
        name: 'Editores',
        audience: 'Quienes escriben notas y cargan la agenda',
        headline: 'Contá el Litoral que conocés',
        pose: 'camara'
    }
] as const;

/** Channels a presentation is handed out through (the `utm_source`). */
export const PRESENTATION_CHANNELS = DIRECT_OUTREACH_SOURCES;

/** A presentation channel. */
export type PresentationChannel = DirectOutreachUtmParams['source'];

/** Short code of each audience in a `/go/` slug. */
const AUDIENCE_CODES: Readonly<Record<PresentationAudience, string>> = {
    alojamientos: 'aloj',
    'comer-y-salir': 'comer',
    experiencias: 'exp',
    proveedores: 'prov',
    aliados: 'aliados',
    editores: 'edit'
};

/** Short code of each channel in a `/go/` slug. */
const CHANNEL_CODES: Readonly<Record<PresentationChannel, string>> = {
    whatsapp: 'wa',
    facebook: 'fb',
    x: 'x',
    telegram: 'tg',
    copy: 'link'
};

/** One `/go/<slug>/` short link. */
export interface PresentationShortLink {
    /** `<audience code>-<channel code>`, e.g. `aloj-wa`. */
    readonly slug: string;
    readonly audience: PresentationAudience;
    readonly channel: PresentationChannel;
}

/**
 * Builds the short-link slug of one presentation and channel.
 *
 * @param input - `audience` and `channel`
 * @returns The slug, e.g. `aloj-wa`
 */
export function buildPresentationShortSlug({
    audience,
    channel
}: {
    readonly audience: PresentationAudience;
    readonly channel: PresentationChannel;
}): string {
    return `${AUDIENCE_CODES[audience]}-${CHANNEL_CODES[channel]}`;
}

/** Builds the full audiences x channels product from {@link PRESENTATIONS}. */
function buildShortLinks(): readonly PresentationShortLink[] {
    return PRESENTATIONS.flatMap((entry) =>
        PRESENTATION_CHANNELS.map((channel) => ({
            slug: buildPresentationShortSlug({ audience: entry.slug, channel }),
            audience: entry.slug,
            channel
        }))
    );
}

/** Every `/go/<slug>/` short link (6 presentations x 5 channels = 30). */
export const PRESENTATION_SHORT_LINKS: readonly PresentationShortLink[] = buildShortLinks();

const SHORT_LINKS_BY_SLUG: ReadonlyMap<string, PresentationShortLink> = new Map(
    PRESENTATION_SHORT_LINKS.map((link) => [link.slug, link])
);

/**
 * Resolves a short-link slug to the site-relative presentation URL with UTMs.
 * Presentations are Spanish under every locale by design, so the target is
 * always `/es/presentacion/<audience>/`.
 *
 * @param input - `slug`: the `/go/<slug>/` segment
 * @returns The redirect target, or `null` for an unknown slug
 */
export function resolvePresentationShortLink({ slug }: { readonly slug: string }): string | null {
    const link = SHORT_LINKS_BY_SLUG.get(slug);
    if (!link) {
        return null;
    }
    return withUtm({
        url: `/es/presentacion/${link.audience}/`,
        source: link.channel,
        medium: 'direct-outreach',
        campaign: `presentacion-${link.audience}`
    });
}

/**
 * Builds the absolute short URL handed out for `slug`, on the site's own origin
 * (so staging hands out staging links).
 *
 * @param input - `siteUrl` (the web app's public URL) and `slug`
 * @returns e.g. `https://hospeda.com.ar/go/aloj-link/`
 */
export function buildPresentationShortUrl({
    siteUrl,
    slug
}: {
    readonly siteUrl: string;
    readonly slug: string;
}): string {
    return `${siteUrl.replace(/\/+$/, '')}/go/${slug}/`;
}

/**
 * Builds the response of the `/go/<slug>/` route.
 *
 * - Unknown slug: a bare 404, which the middleware rewrites to the site 404 page.
 * - Known slug: a 302 (never 301: the target may change and a permanently cached
 *   redirect could not be evicted) to the presentation with UTMs, with
 *   `Cache-Control: no-store` so no shared cache replays it. The page's own
 *   headers are copied so nothing the pipeline attached is lost.
 *
 * @param input - `slug` and the page's `baseHeaders` (`Astro.response.headers`)
 * @returns The redirect or 404 response
 */
export function buildPresentationShortLinkResponse({
    slug,
    baseHeaders
}: {
    readonly slug: string;
    readonly baseHeaders: Headers;
}): Response {
    const location = resolvePresentationShortLink({ slug });
    if (!location) {
        return new Response(null, { status: 404 });
    }
    const headers = new Headers(baseHeaders);
    headers.set('Location', location);
    headers.set('Cache-Control', 'no-store');
    return new Response(null, { status: 302, headers });
}
