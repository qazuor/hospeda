/**
 * @file og.ts
 * @description Dynamic Open Graph image endpoint.
 *
 * SPEC-157 REQ-1: social platforms (Facebook, X, LinkedIn, WhatsApp) reject SVG
 * for OG image previews, so this endpoint renders a real 1200x630 PNG via
 * `@vercel/og` (satori + resvg). The element tree is built with plain satori
 * objects (no JSX) so the file stays a `.ts` Astro endpoint.
 *
 * Fonts: satori needs a binary font (it cannot read a CSS @font-face). The
 * Roboto faces are fetched at runtime from the fontsource CDN and cached in
 * module scope — the standalone Node server is long-lived, so each face is
 * downloaded at most once per process.
 *
 * Usage: GET /api/og?title=Page+Title&description=Optional+description
 *
 * @route GET /api/og
 */

import { ImageResponse } from '@vercel/og';
import type { APIRoute } from 'astro';

export const prerender = false;

/** Direct .ttf URLs (fontsource CDN serves Google fonts as truetype). */
const FONT_URL_REGULAR =
    'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-400-normal.ttf';
const FONT_URL_BOLD =
    'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-normal.ttf';

interface OgFonts {
    readonly regular: ArrayBuffer;
    readonly bold: ArrayBuffer;
}

/**
 * Module-scope font cache. Promises are memoised so concurrent cold requests
 * share a single in-flight download. On failure the cache is reset so the next
 * request retries instead of caching a rejected promise forever.
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
        fontsCache = Promise.all([fetchFont(FONT_URL_REGULAR), fetchFont(FONT_URL_BOLD)])
            .then(([regular, bold]) => ({ regular, bold }))
            .catch((error) => {
                fontsCache = null;
                throw error;
            });
    }
    return fontsCache;
}

/** Truncate a string to `max` chars with an ellipsis. */
function truncate(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}...` : value;
}

/** satori element node (plain-object form of a React element — avoids JSX). */
type SatoriNode = {
    readonly type: string;
    readonly props: Record<string, unknown>;
};

export const GET: APIRoute = async ({ url }) => {
    const title = truncate(url.searchParams.get('title') || 'Hospeda', 40);
    const description = url.searchParams.get('description') || '';

    let fonts: OgFonts;
    try {
        fonts = await loadFonts();
    } catch {
        return new Response('OG image unavailable: font could not be loaded', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }

    const children: SatoriNode[] = [
        {
            type: 'div',
            props: {
                style: { fontSize: 72, fontWeight: 700, opacity: 0.3 },
                children: 'Hospeda'
            }
        },
        {
            type: 'div',
            props: {
                style: { fontSize: 56, fontWeight: 700, marginTop: 40, lineHeight: 1.15 },
                children: title
            }
        }
    ];

    if (description) {
        children.push({
            type: 'div',
            props: {
                style: { fontSize: 28, opacity: 0.85, marginTop: 24, lineHeight: 1.3 },
                children: truncate(description, 80)
            }
        });
    }

    children.push({
        type: 'div',
        props: {
            style: { fontSize: 32, opacity: 0.8, marginTop: 'auto' },
            children: 'hospeda.com.ar'
        }
    });

    const element: SatoriNode = {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                height: '100%',
                padding: 100,
                backgroundImage: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                color: 'white',
                fontFamily: 'Roboto'
            },
            children
        }
    };

    return new ImageResponse(element as unknown as ConstructorParameters<typeof ImageResponse>[0], {
        width: 1200,
        height: 630,
        fonts: [
            { name: 'Roboto', data: fonts.regular, weight: 400, style: 'normal' },
            { name: 'Roboto', data: fonts.bold, weight: 700, style: 'normal' }
        ],
        headers: {
            'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        }
    });
};
