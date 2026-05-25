/**
 * @file og.ts
 * @description Dynamic Open Graph image endpoint.
 *
 * SPEC-157 REQ-1: social platforms (Facebook, X, LinkedIn, WhatsApp) reject SVG
 * for OG image previews, so this endpoint renders a real 1200x630 PNG via
 * `@vercel/og` (satori + resvg). The element tree is built with plain satori
 * objects (no JSX) — see `src/lib/og-template.ts` for the two card builders
 * (PHOTO mode for entity detail pages, BRAND mode for home/listings/etc).
 *
 * Fonts: satori needs binary fonts (it cannot read a CSS @font-face). Roboto
 * (400/700), Geologica 700 and Caveat 700 are fetched at runtime from the
 * fontsource CDN and cached in module scope — the standalone Node server is
 * long-lived, so each face downloads at most once per process. On failure the
 * cache resets so the next request retries instead of caching a rejected promise.
 *
 * Static assets: the logo isotipo and the three hero images are read from disk
 * once at module load and inlined as base64 data URIs. The path resolver probes
 * the dev/test source layout (`public/`, `src/assets/`) and the production build
 * layout (`dist/client/`) so the same code works in every runtime.
 *
 * Usage:
 *   GET /api/og?title=...&description=...                      → BRAND card
 *   GET /api/og?title=...&type=Alojamiento&image=...&rating=.. → PHOTO card
 *   Optional: subtitle, tagline, seed (brand hero hashing; defaults to title).
 *   Mode = photo when `image` is provided, else brand.
 *
 * @route GET /api/og
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    HERO_KEYS,
    type HeroKey,
    OG_FONT_URLS,
    type OgAssets,
    type SatoriNode,
    buildOgElement,
    parseOgParams
} from '@/lib/og-template';
import { ImageResponse } from '@vercel/og';
import type { APIRoute } from 'astro';

export const prerender = false;

interface OgFonts {
    readonly roboto: ArrayBuffer;
    readonly robotoBold: ArrayBuffer;
    readonly geologica: ArrayBuffer;
    readonly caveat: ArrayBuffer;
}

/**
 * Module-scope font cache. The promise is memoised so concurrent cold requests
 * share a single in-flight download; reset on failure so the next request retries.
 */
let fontsCache: Promise<OgFonts> | null = null;

async function fetchFont(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
        throw new Error(`OG font fetch failed (HTTP ${response.status}): ${url}`);
    }
    return response.arrayBuffer();
}

function loadFonts(): Promise<OgFonts> {
    if (!fontsCache) {
        fontsCache = Promise.all([
            fetchFont(OG_FONT_URLS.robotoRegular),
            fetchFont(OG_FONT_URLS.robotoBold),
            fetchFont(OG_FONT_URLS.geologica),
            fetchFont(OG_FONT_URLS.caveat)
        ])
            .then(([roboto, robotoBold, geologica, caveat]) => ({
                roboto,
                robotoBold,
                geologica,
                caveat
            }))
            .catch((error) => {
                fontsCache = null;
                throw error;
            });
    }
    return fontsCache;
}

/**
 * Read a static asset by trying a list of candidate paths relative to this
 * module, returning the first that resolves. Returns null if none exist (the
 * endpoint then degrades gracefully — satori renders the card without the asset
 * rather than 500ing).
 *
 * Candidates cover:
 *  - dev/test: this file is `src/pages/api/og.ts`, assets live under `public/`
 *    and `src/assets/`.
 *  - production: this file is bundled into `dist/server/`, public assets are
 *    copied to `dist/client/`.
 */
function readAssetDataUri(relativeCandidates: readonly string[], mime: string): string | null {
    for (const candidate of relativeCandidates) {
        try {
            const path = fileURLToPath(new URL(candidate, import.meta.url));
            const buffer = readFileSync(path);
            return `data:${mime};base64,${buffer.toString('base64')}`;
        } catch {
            // Try the next candidate.
        }
    }
    return null;
}

const HERO_FILENAMES: Readonly<Record<HeroKey, string>> = {
    atardecer: 'hero-atardecer.jpg',
    isla: 'hero-isla.jpg',
    playa: 'hero-playa.jpg'
};

/**
 * Module-scope asset cache (logo + hero data URIs). Synchronous + memoised:
 * resolved once on first request, reused for the process lifetime.
 */
let assetsCache: OgAssets | null = null;

function loadStaticAssets(): OgAssets {
    if (assetsCache) return assetsCache;

    const logo =
        readAssetDataUri(
            [
                // dev/test (src/pages/api → public)
                '../../../public/android-chrome-512x512.png',
                // production (dist/server/pages/api or similar → dist/client)
                '../../client/android-chrome-512x512.png',
                '../../../client/android-chrome-512x512.png'
            ],
            'image/png'
        ) ?? '';

    const heroes = Object.fromEntries(
        HERO_KEYS.map((key) => {
            const file = HERO_FILENAMES[key];
            const uri =
                readAssetDataUri(
                    [
                        `../../../public/og/${file}`,
                        `../../../assets/images/hero/${file}`,
                        `../../client/og/${file}`,
                        `../../../client/og/${file}`
                    ],
                    'image/jpeg'
                ) ?? '';
            return [key, uri] as const;
        })
    ) as Record<HeroKey, string>;

    assetsCache = { logo, heroes };
    return assetsCache;
}

export const GET: APIRoute = async ({ url }) => {
    let fonts: OgFonts;
    try {
        fonts = await loadFonts();
    } catch {
        return new Response('OG image unavailable: font could not be loaded', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    const params = parseOgParams(url.searchParams);
    const assets = loadStaticAssets();
    const element = buildOgElement(params, assets) as SatoriNode;

    return new ImageResponse(element as unknown as ConstructorParameters<typeof ImageResponse>[0], {
        width: 1200,
        height: 630,
        fonts: [
            { name: 'Roboto', data: fonts.roboto, weight: 400, style: 'normal' },
            { name: 'Roboto', data: fonts.robotoBold, weight: 700, style: 'normal' },
            { name: 'Geologica', data: fonts.geologica, weight: 700, style: 'normal' },
            { name: 'Caveat', data: fonts.caveat, weight: 700, style: 'normal' }
        ],
        headers: {
            'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        }
    });
};
