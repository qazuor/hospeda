/**
 * @fileoverview
 * Unit tests for the llms.txt endpoint (src/pages/llms.txt.ts).
 *
 * Strategy: mock `@/lib/env` and `@/lib/middleware-helpers`, then call the GET
 * handler directly with a synthetic Request object.
 *
 * The llms.txt standard (https://llmstxt.org) exposes a concise, link-rich
 * markdown index so LLM agents can discover the site's primary sections.
 *
 * Assertions cover:
 *  - Content-Type text/plain and Cache-Control public, max-age=3600.
 *  - The H1 title and the blockquote summary are present.
 *  - All 8 section links are emitted with absolute URLs derived from
 *    getSiteUrl() (never hardcoded), each with the /es prefix.
 *  - The trailing slash on the site URL is stripped (no double-slash).
 *  - Noindex hosts receive a minimal body with the title only (no links).
 */

import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — declared before any dynamic import of the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/env', () => ({
    getSiteUrl: vi.fn(() => 'https://hospeda.test'),
    getNoindexHosts: vi.fn(() => undefined)
}));

vi.mock('@/lib/middleware-helpers', () => ({
    parseNoindexHosts: vi.fn((raw: string | undefined) =>
        raw ? raw.split(',').map((h) => h.trim().toLowerCase()) : ['staging.hospeda.com.ar']
    )
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(host: string): Request {
    return new Request('http://localhost/llms.txt', {
        headers: { host }
    });
}

const EXPECTED_SECTION_PATHS = [
    '/es/alojamientos/',
    '/es/destinos/',
    '/es/eventos/',
    '/es/publicaciones/',
    '/es/nosotros/',
    '/es/preguntas-frecuentes/',
    '/es/contacto/',
    '/es/'
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('llms.txt — GET handler', () => {
    it('returns status 200', async () => {
        const { GET } = await import('../../src/pages/llms.txt.js');
        const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
        expect(response.status).toBe(200);
    });

    it('returns Content-Type: text/plain; charset=utf-8', async () => {
        const { GET } = await import('../../src/pages/llms.txt.js');
        const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
        expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
    });

    it('returns Cache-Control: public, max-age=3600', async () => {
        const { GET } = await import('../../src/pages/llms.txt.js');
        const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
        expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
    });

    describe('indexable host — full markdown index', () => {
        it('starts with the H1 brand title', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body.startsWith('# Hospeda')).toBe(true);
        });

        it('includes the blockquote summary', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('> Hospeda es la plataforma');
        });

        it('emits all 8 section links with absolute /es-prefixed URLs', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            for (const path of EXPECTED_SECTION_PATHS) {
                expect(body).toContain(`https://hospeda.test${path}`);
            }
        });

        it('renders the Secciones principales heading', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('## Secciones principales');
        });

        it('strips a trailing slash from the site URL before appending paths', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test/');

            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).toContain('https://hospeda.test/es/alojamientos/');
            expect(body).not.toContain('hospeda.test//es/');
        });

        it('uses the injected site URL (never hardcodes hospeda.com.ar)', async () => {
            const { getSiteUrl } = await import('@/lib/env');
            vi.mocked(getSiteUrl).mockReturnValue('https://hospeda.test');

            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({ request: makeRequest('hospeda.com.ar') } as never);
            const body = await response.text();

            expect(body).not.toContain('hospeda.com.ar');
        });
    });

    describe('noindex host — minimal body', () => {
        it('returns only the H1 title (no section links)', async () => {
            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({
                request: makeRequest('staging.hospeda.com.ar')
            } as never);
            const body = await response.text();

            expect(body).toContain('# Hospeda');
            expect(body).not.toContain('## Secciones principales');
            for (const path of EXPECTED_SECTION_PATHS) {
                expect(body).not.toContain(path);
            }
        });

        it('still returns status 200', async () => {
            const { GET } = await import('../../src/pages/llms.txt.js');
            const response = await GET({
                request: makeRequest('staging.hospeda.com.ar')
            } as never);
            expect(response.status).toBe(200);
        });
    });
});
