/**
 * @file publicaciones-not-found.test.ts
 * @description Source-read tests for 404/410 handling on the post detail page
 * (HOS-117 T-022). Mirrors the equivalent "404 handling" coverage in
 * gastronomia-detail.test.ts / experiencias-detail.test.ts — no such coverage
 * previously existed for publicaciones/[slug].astro.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicaciones/[slug].astro'),
    'utf8'
);

describe('publicaciones/[slug].astro — 404/410 handling', () => {
    it('returns 404 when slug is missing', () => {
        expect(src).toContain('if (!slug)');
        expect(src).toContain('return new Response(null, { status: 404 })');
    });

    it('returns 404 when the API call fails without a GONE status', () => {
        expect(src).toContain('if (!result.ok)');
    });

    it('propagates 410 (GONE) for soft-deleted posts, 404 otherwise', () => {
        expect(src).toContain(
            'if (!result.ok) return new Response(null, { status: result.error.status === 410 ? 410 : 404 });'
        );
    });
});
