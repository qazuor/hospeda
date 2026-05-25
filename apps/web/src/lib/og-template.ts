/**
 * @file og-template.ts
 * @description Pure builders + helpers for the dynamic Open Graph image endpoint
 * (`src/pages/api/og.ts`). Kept as a standalone module so the endpoint file stays
 * a thin wrapper under the 500-line cap.
 *
 * Two render modes (mirrors the approved prototype, SPEC OG redesign):
 *  - PHOTO mode  → entity detail cards (alojamiento / destino / evento / post):
 *    full-bleed featured image + dark gradient + logo chip + colored type badge
 *    + Geologica title + subtitle (locality + gold star + rating) + brand URL.
 *  - BRAND mode  → home / listings / other pages: light `--brand-secondary` bg +
 *    logo + Caveat tagline + Geologica title + Roboto description + brand URL +
 *    a hero photo clipped into the hero blob shape.
 *
 * satori cannot read CSS `@font-face`; binary fonts are fetched at runtime and
 * cached in module scope by the endpoint, then passed into the builders here.
 *
 * Asset loading (logo + hero images) is intentionally decoupled: the endpoint
 * resolves data URIs once at module load via {@link loadStaticAssets} and passes
 * them in, so these builders stay pure and unit-testable.
 */

/**
 * Convert an oklch color to an sRGB hex string. The design tokens are authored
 * in oklch; satori only understands hex/rgb, so we precompute the exact hex at
 * runtime to stay in lockstep with `@repo/design-tokens` without hardcoding.
 */
export function oklchToHex(L: number, C: number, h: number): string {
    const hr = (h * Math.PI) / 180;
    const a = C * Math.cos(hr);
    const b = C * Math.sin(hr);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;
    const l = l_ ** 3;
    const m = m_ ** 3;
    const s = s_ ** 3;
    const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
    const gamma = (c: number): number =>
        c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    const to255 = (c: number): number => Math.max(0, Math.min(255, Math.round(gamma(c) * 255)));
    const hex = (x: number): string => x.toString(16).padStart(2, '0');
    return `#${hex(to255(r))}${hex(to255(g))}${hex(to255(bl))}`;
}

/** Brand palette resolved from the design-token oklch values (sRGB hex). */
export const OG_COLORS = {
    primary: oklchToHex(0.63, 0.19, 259),
    secondary: oklchToHex(0.96, 0.02, 236),
    foreground: oklchToHex(0.2, 0.02, 220),
    muted: oklchToHex(0.45, 0.03, 230),
    forest: oklchToHex(0.5, 0.14, 155),
    accent: oklchToHex(0.7, 0.18, 55),
    sky: oklchToHex(0.8, 0.08, 259),
    star: oklchToHex(0.78, 0.16, 75)
} as const;

/**
 * Type-badge color per entity label. Defaults to brand-primary for unknown
 * labels so a future entity type still renders a valid (on-brand) badge.
 */
export const TYPE_BADGE: Readonly<Record<string, string>> = {
    Alojamiento: OG_COLORS.primary,
    Destino: OG_COLORS.forest,
    Evento: OG_COLORS.accent,
    Guía: '#8b5cf6'
};

/** Stable list of hero-image keys, in declaration order (used by the hash). */
export const HERO_KEYS = ['atardecer', 'isla', 'playa'] as const;
export type HeroKey = (typeof HERO_KEYS)[number];

/** Hero blob path (viewBox 0 0 1 1) — matches the site hero clip shape. */
export const BLOB_PATH =
    'M0.3477 0.0025 C0.2385 0.0171 0.1531 0.0856 0.1360 0.1733 C0.1340 0.1836 0.1324 0.2231 0.1324 0.2607 C0.1324 0.3609 0.1234 0.4024 0.0800 0.5026 C0.0249 0.6294 0.0095 0.6748 0.0022 0.7334 C-0.0212 0.9217 0.1487 1.0580 0.3043 0.9753 C0.3210 0.9664 0.3651 0.9366 0.4028 0.9089 C0.5143 0.8265 0.5326 0.8183 0.5977 0.8215 C0.6291 0.8233 0.6505 0.8268 0.6932 0.8382 C0.8318 0.8744 0.8932 0.8556 0.9456 0.7604 C1.0000 0.6613 1.0147 0.5438 0.9847 0.4429 C0.9643 0.3736 0.9353 0.3236 0.8822 0.2678 C0.8137 0.1957 0.7440 0.1556 0.6295 0.1225 C0.5654 0.1041 0.5430 0.0909 0.4956 0.0437 C0.4592 0.0071 0.4115 -0.0060 0.3477 0.0025Z';

/** Direct .ttf URLs (fontsource CDN serves Google fonts as truetype). */
export const OG_FONT_URLS = {
    geologica: 'https://cdn.jsdelivr.net/fontsource/fonts/geologica@latest/latin-700-normal.ttf',
    caveat: 'https://cdn.jsdelivr.net/fontsource/fonts/caveat@latest/latin-700-normal.ttf',
    robotoRegular: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-400-normal.ttf',
    robotoBold: 'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-normal.ttf'
} as const;

/**
 * Deterministically pick a hero key from a seed string. Same seed → same hero
 * (cache-friendly, stable per URL), while different page seeds spread across the
 * three heroes. Uses a small FNV-1a-style hash so the distribution doesn't bias
 * toward the first key for short seeds.
 */
export function pickHeroKey(seed: string): HeroKey {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    // `>>> 0` coerces to an unsigned 32-bit int before the modulo.
    const index = (hash >>> 0) % HERO_KEYS.length;
    return HERO_KEYS[index];
}

/**
 * Truncate on a word boundary with an ellipsis. Avoids the previous mid-word cut
 * at 40 chars. If the first word alone exceeds `max`, it hard-cuts that word so
 * the layout never overflows.
 */
export function truncateWords(value: string, max: number): string {
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    const slice = trimmed.slice(0, max);
    const lastSpace = slice.lastIndexOf(' ');
    const head = lastSpace > 0 ? slice.slice(0, lastSpace) : slice;
    return `${head.trimEnd()}…`;
}

/** satori element node (plain-object form of a React element — avoids JSX). */
export type SatoriNode = {
    readonly type: string;
    readonly props: Record<string, unknown>;
};

/** Static (file-backed) assets the builders need, as base64 data URIs. */
export interface OgAssets {
    /** Logo isotipo (android-chrome-512x512.png) as a data URI. */
    readonly logo: string;
    /** Hero images keyed by {@link HeroKey}, each a data URI. */
    readonly heroes: Readonly<Record<HeroKey, string>>;
}

/** Parsed/normalized request params after applying defaults + mode detection. */
export interface OgParams {
    readonly mode: 'photo' | 'brand';
    readonly title: string;
    readonly description: string;
    /** Badge label, photo mode only (e.g. Alojamiento/Destino/Evento/Guía). */
    readonly type: string;
    /** Featured image URL, photo mode only. */
    readonly image: string;
    /** Subtitle line (locality/region), photo mode. */
    readonly subtitle: string;
    /** Rating value (e.g. "4.8"), photo mode. */
    readonly rating: string;
    /** Caveat tagline, brand mode. */
    readonly tagline: string;
    /** Deterministic hero key for brand mode. */
    readonly heroKey: HeroKey;
}

/**
 * Parse the endpoint query params into normalized {@link OgParams}. Mode is
 * `photo` when an `image` is provided, else `brand`. The hero key is derived
 * from `seed` (falling back to `title`) so brand cards stay stable per URL.
 */
export function parseOgParams(searchParams: URLSearchParams): OgParams {
    const rawTitle = searchParams.get('title') || 'Hospeda';
    const image = searchParams.get('image') || '';
    const mode: 'photo' | 'brand' = image ? 'photo' : 'brand';
    const seed = searchParams.get('seed') || rawTitle;
    return {
        mode,
        // Brand titles get a touch more room than photo titles (no badge row).
        title: truncateWords(rawTitle, mode === 'photo' ? 64 : 70),
        description: truncateWords(searchParams.get('description') || '', 140),
        type: searchParams.get('type') || 'Alojamiento',
        image,
        subtitle: searchParams.get('subtitle') || '',
        rating: searchParams.get('rating') || '',
        tagline: searchParams.get('tagline') || 'Descubrí el Litoral',
        heroKey: pickHeroKey(seed)
    };
}

/** Inputs for assembling the auto-generated `/api/og?...` URL (used by SEOHead). */
export interface OgImageUrlInput {
    readonly title: string;
    readonly description?: string;
    /** Type badge label → switches the generated card to photo mode. */
    readonly type?: string;
    /** Featured image URL → switches the generated card to photo mode. */
    readonly image?: string;
    /** Subtitle line (locality/region), photo mode. */
    readonly subtitle?: string;
    /** Rating value (e.g. "4.8"), photo mode. */
    readonly rating?: string;
    /** Caveat tagline, brand mode. */
    readonly tagline?: string;
    /** Hero-image hash seed; defaults to `title` when omitted (brand mode). */
    readonly seed?: string;
}

/**
 * Assemble the relative `/api/og?...` URL from the given inputs, URL-encoding
 * every value and omitting empty params. Keeps SEOHead backward-compatible:
 * passing only `title`+`description` yields a valid brand-mode OG URL.
 */
export function buildOgImagePath(input: OgImageUrlInput): string {
    const params = new URLSearchParams();
    params.set('title', input.title);
    const entries: ReadonlyArray<readonly [string, string | undefined]> = [
        ['description', input.description],
        ['type', input.type],
        ['image', input.image],
        ['subtitle', input.subtitle],
        ['rating', input.rating],
        ['tagline', input.tagline],
        ['seed', input.seed]
    ];
    for (const [key, value] of entries) {
        if (value !== undefined && value !== null && value !== '') {
            params.set(key, value);
        }
    }
    return `/api/og?${params.toString()}`;
}

function node(type: string, style: Record<string, unknown>, children?: unknown): SatoriNode {
    return { type, props: { style, ...(children !== undefined ? { children } : {}) } };
}

function img(src: string, style: Record<string, unknown>): SatoriNode {
    return { type: 'img', props: { src, style } };
}

function starSvg(size: number): SatoriNode {
    return {
        type: 'svg',
        props: {
            width: size,
            height: size,
            viewBox: '0 0 24 24',
            fill: OG_COLORS.star,
            children: {
                type: 'path',
                props: {
                    d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
                }
            }
        }
    };
}

/** Photo-mode card (entity detail pages). */
export function buildPhotoCard(params: OgParams, assets: OgAssets): SatoriNode {
    const { image, type, title, subtitle, rating } = params;
    const subtitleChildren: unknown[] = [node('span', { display: 'flex' }, subtitle)];
    if (rating) {
        subtitleChildren.push(
            node('span', { display: 'flex', margin: '0 10px', opacity: 0.6 }, '·'),
            starSvg(30),
            node('span', { display: 'flex', marginLeft: 6, fontWeight: 700 }, rating)
        );
    }
    return node(
        'div',
        {
            display: 'flex',
            width: '100%',
            height: '100%',
            position: 'relative',
            fontFamily: 'Roboto'
        },
        [
            img(image, {
                position: 'absolute',
                top: 0,
                left: 0,
                width: 1200,
                height: 630,
                objectFit: 'cover'
            }),
            node(
                'div',
                {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 1200,
                    height: 630,
                    display: 'flex',
                    backgroundImage:
                        'linear-gradient(to bottom, rgba(15,23,30,0.05) 0%, rgba(15,23,30,0.42) 50%, rgba(15,23,30,0.92) 100%)'
                },
                []
            ),
            node(
                'div',
                {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 1200,
                    height: 630,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: 60,
                    color: 'white'
                },
                [
                    node(
                        'div',
                        {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start'
                        },
                        [
                            node(
                                'div',
                                {
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 84,
                                    height: 84,
                                    borderRadius: 9999,
                                    backgroundColor: 'rgba(255,255,255,0.92)'
                                },
                                [img(assets.logo, { width: 64, height: 64 })]
                            ),
                            node(
                                'div',
                                {
                                    display: 'flex',
                                    fontSize: 26,
                                    fontWeight: 700,
                                    backgroundColor: TYPE_BADGE[type] ?? OG_COLORS.primary,
                                    color: 'white',
                                    padding: '12px 28px',
                                    borderRadius: 9999
                                },
                                type
                            )
                        ]
                    ),
                    node('div', { display: 'flex', flexDirection: 'column' }, [
                        node(
                            'div',
                            {
                                display: 'flex',
                                fontFamily: 'Geologica',
                                fontSize: 68,
                                fontWeight: 700,
                                lineHeight: 1.05,
                                marginBottom: 16,
                                letterSpacing: -1
                            },
                            title
                        ),
                        node(
                            'div',
                            { display: 'flex', alignItems: 'center', fontSize: 31, opacity: 0.95 },
                            subtitleChildren
                        ),
                        node(
                            'div',
                            { display: 'flex', fontSize: 26, opacity: 0.8, marginTop: 22 },
                            'hospeda.com.ar'
                        )
                    ])
                ]
            )
        ]
    );
}

function blobImage(src: string, w: number, h: number): SatoriNode {
    return {
        type: 'svg',
        props: {
            width: w,
            height: h,
            viewBox: '0 0 1 1',
            children: [
                {
                    type: 'defs',
                    props: {
                        children: {
                            type: 'clipPath',
                            props: {
                                id: 'b',
                                clipPathUnits: 'userSpaceOnUse',
                                children: { type: 'path', props: { d: BLOB_PATH } }
                            }
                        }
                    }
                },
                {
                    type: 'image',
                    props: {
                        href: src,
                        x: 0,
                        y: 0,
                        width: 1,
                        height: 1,
                        preserveAspectRatio: 'xMidYMid slice',
                        'clip-path': 'url(#b)'
                    }
                }
            ]
        }
    };
}

/** Brand/hero-mode card (home / listings / other pages). */
export function buildHeroCard(params: OgParams, assets: OgAssets): SatoriNode {
    const { tagline, title, description, heroKey } = params;
    const heroImage = assets.heroes[heroKey];
    return node(
        'div',
        {
            display: 'flex',
            width: '100%',
            height: '100%',
            backgroundColor: OG_COLORS.secondary,
            fontFamily: 'Roboto',
            position: 'relative'
        },
        [
            node(
                'div',
                {
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    width: 700,
                    height: '100%',
                    padding: '58px 0 58px 64px'
                },
                [
                    node('div', { display: 'flex' }, [img(assets.logo, { width: 76, height: 76 })]),
                    node('div', { display: 'flex', flexDirection: 'column' }, [
                        node(
                            'div',
                            {
                                display: 'flex',
                                fontFamily: 'Caveat',
                                fontSize: 46,
                                fontWeight: 700,
                                color: OG_COLORS.primary,
                                marginBottom: 6
                            },
                            tagline
                        ),
                        node(
                            'div',
                            {
                                display: 'flex',
                                fontFamily: 'Geologica',
                                fontSize: 74,
                                fontWeight: 700,
                                color: OG_COLORS.foreground,
                                lineHeight: 0.98,
                                letterSpacing: -2,
                                marginBottom: 20
                            },
                            title
                        ),
                        node(
                            'div',
                            {
                                display: 'flex',
                                fontSize: 28,
                                color: OG_COLORS.muted,
                                lineHeight: 1.35,
                                maxWidth: 590
                            },
                            description
                        )
                    ]),
                    node(
                        'div',
                        {
                            display: 'flex',
                            fontSize: 26,
                            fontWeight: 700,
                            color: OG_COLORS.primary
                        },
                        'hospeda.com.ar'
                    )
                ]
            ),
            node(
                'div',
                {
                    display: 'flex',
                    position: 'absolute',
                    top: 55,
                    right: 36,
                    width: 500,
                    height: 520
                },
                [
                    {
                        type: 'svg',
                        props: {
                            style: { position: 'absolute', top: 18, left: -14 },
                            width: 500,
                            height: 520,
                            viewBox: '0 0 1 1',
                            children: {
                                type: 'path',
                                props: { d: BLOB_PATH, fill: OG_COLORS.sky, 'fill-opacity': 0.55 }
                            }
                        }
                    },
                    node('div', { display: 'flex', position: 'absolute', top: 0, left: 0 }, [
                        blobImage(heroImage, 500, 520)
                    ])
                ]
            )
        ]
    );
}

/** Build the satori element tree for the given (already-parsed) params. */
export function buildOgElement(params: OgParams, assets: OgAssets): SatoriNode {
    return params.mode === 'photo' ? buildPhotoCard(params, assets) : buildHeroCard(params, assets);
}
