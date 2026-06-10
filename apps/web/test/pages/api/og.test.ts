// @vitest-environment node
//
// satori + resvg (inside @vercel/og) rasterise the SVG to PNG using a WASM
// module that only initialises under a real Node environment — not jsdom (the
// global default). Without this override the endpoint emits the intermediate
// SVG and the PNG-byte assertions fail. This test also performs a real network
// fetch of the Roboto .ttf (fontsource CDN) — see the runtime-fetch font choice.

/**
 * @fileoverview
 * Unit tests for the dynamic OG image endpoint (src/pages/api/og.ts).
 *
 * SPEC-157 REQ-1: social platforms (Facebook, X, LinkedIn, WhatsApp) reject SVG
 * for Open Graph previews. The endpoint MUST return a real PNG at 1200x630.
 *
 * Strategy: call the GET handler directly with a stub APIContext that only
 * carries the `url` (the only field the handler reads), then assert on the
 * response Content-Type and the raw bytes of the body:
 *  - Content-Type is image/png.
 *  - The body starts with the 8-byte PNG signature.
 *  - The IHDR chunk declares 1200x630 dimensions.
 */

import { describe, expect, it } from 'vitest';
import { GET } from '../../../src/pages/api/og';

/** Minimal APIContext stub — the handler only reads `url.searchParams`. */
function buildContext(search = '?title=Test+Title&description=Hello'): Parameters<typeof GET>[0] {
    return { url: new URL(`http://localhost/api/og${search}`) } as Parameters<typeof GET>[0];
}

/** The 8-byte PNG file signature. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * The endpoint fetches its font from the fontsource CDN at runtime. These
 * assertions therefore need outbound network. Probe once up-front and skip
 * (not fail) when offline so CI without egress stays green.
 */
async function networkAvailable(): Promise<boolean> {
    try {
        const response = await fetch(
            'https://cdn.jsdelivr.net/fontsource/fonts/roboto@latest/latin-700-normal.ttf',
            { method: 'HEAD', signal: AbortSignal.timeout(5_000) }
        );
        return response.ok;
    } catch {
        return false;
    }
}

const hasNetwork = await networkAvailable();

describe('og.ts — GET handler (SPEC-157 REQ-1)', () => {
    it.skipIf(!hasNetwork)('returns Content-Type image/png', async () => {
        const response = await GET(buildContext());
        expect(response.headers.get('Content-Type')).toBe('image/png');
    });

    it.skipIf(!hasNetwork)(
        'returns a non-empty body that starts with the PNG signature',
        async () => {
            const response = await GET(buildContext());
            const bytes = new Uint8Array(await response.arrayBuffer());

            expect(bytes.byteLength).toBeGreaterThan(0);
            expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
        }
    );

    it.skipIf(!hasNetwork)('renders the image at 1200x630 pixels (IHDR chunk)', async () => {
        const response = await GET(buildContext());
        const bytes = new Uint8Array(await response.arrayBuffer());
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

        // PNG layout: 8-byte signature, then the IHDR chunk. Width and height
        // are big-endian uint32 at byte offsets 16 and 20 respectively.
        const width = view.getUint32(16);
        const height = view.getUint32(20);

        expect(width).toBe(1200);
        expect(height).toBe(630);
    });

    it.skipIf(!hasNetwork)('still returns a PNG when no query params are supplied', async () => {
        const response = await GET(buildContext(''));
        expect(response.headers.get('Content-Type')).toBe('image/png');

        const bytes = new Uint8Array(await response.arrayBuffer());
        expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
    });

    it.skipIf(!hasNetwork)('renders a BRAND card (no image) as a 1200x630 PNG', async () => {
        const response = await GET(
            buildContext(
                '?title=Tu+escapada+empieza+ac%C3%A1&description=Los+mejores+alojamientos&tagline=Descubr%C3%AD+el+Litoral'
            )
        );
        const bytes = new Uint8Array(await response.arrayBuffer());
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
        expect(view.getUint32(16)).toBe(1200);
        expect(view.getUint32(20)).toBe(630);
    });

    it.skipIf(!hasNetwork)('renders a PHOTO card (with image) as a 1200x630 PNG', async () => {
        const image = encodeURIComponent(
            'https://images.pexels.com/photos/338504/pexels-photo-338504.jpeg?auto=compress&w=1200'
        );
        const response = await GET(
            buildContext(
                `?title=Para%C3%ADso+Natural+Hotel&type=Alojamiento&image=${image}&subtitle=Ubajay&rating=4.8`
            )
        );
        const bytes = new Uint8Array(await response.arrayBuffer());
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
        expect(view.getUint32(16)).toBe(1200);
        expect(view.getUint32(20)).toBe(630);
    });
});
