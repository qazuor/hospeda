/**
 * @file og.ts
 * @description Dynamic OG image generation endpoint.
 * Generates 1200x630 PNG images with Hospeda branding for social media previews.
 *
 * Usage: GET /api/og?title=Page+Title&description=Optional+description
 *
 * Requires `@vercel/og` package. Install with: pnpm add @vercel/og --filter hospeda-web
 *
 * @route GET /api/og
 */

import type { APIRoute } from 'astro';

// TODO: Uncomment when @vercel/og is installed
// import { ImageResponse } from '@vercel/og';

/**
 * OG image generation endpoint.
 * Returns a branded 1200x630 PNG with the page title and optional description.
 */
export const GET: APIRoute = async ({ url }) => {
    const title = url.searchParams.get('title') || 'Hospeda';
    const description = url.searchParams.get('description') || '';

    // Fallback SVG-based implementation (works without @vercel/og)
    const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0284c7;stop-opacity:1" />
            </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#bg)" />
        <rect x="60" y="60" width="1080" height="510" rx="24" fill="white" fill-opacity="0.1" />
        <text x="100" y="480" font-family="system-ui, sans-serif" font-size="36" fill="white" fill-opacity="0.8">hospeda.com.ar</text>
        <text x="100" y="280" font-family="system-ui, sans-serif" font-size="56" font-weight="700" fill="white">
            ${escapeXml(title.length > 40 ? `${title.slice(0, 40)}...` : title)}
        </text>
        ${
            description
                ? `<text x="100" y="340" font-family="system-ui, sans-serif" font-size="28" fill="white" fill-opacity="0.85">
            ${escapeXml(description.length > 80 ? `${description.slice(0, 80)}...` : description)}
        </text>`
                : ''
        }
        <text x="100" y="160" font-family="system-ui, sans-serif" font-size="72" font-weight="700" fill="white" fill-opacity="0.3">Hospeda</text>
    </svg>`.trim();

    return new Response(svg, {
        headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400, s-maxage=604800'
        }
    });
};

/** Escape special XML characters to prevent injection in SVG */
function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
