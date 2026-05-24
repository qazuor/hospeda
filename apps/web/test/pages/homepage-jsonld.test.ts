/**
 * @file homepage-jsonld.test.ts
 * @description Source-based tests asserting that the homepage imports and
 * mounts both WebSiteJsonLd and OrganizationJsonLd into the head-extra slot.
 *
 * SPEC-157 / REQ-5.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/index.astro'), 'utf8');

describe('Homepage JSON-LD wiring (SPEC-157 REQ-5)', () => {
    it('imports WebSiteJsonLd component', () => {
        // Accept either single or double quotes (Astro files commonly use double quotes for imports)
        expect(src).toMatch(
            /import WebSiteJsonLd from ['"]@\/components\/seo\/WebSiteJsonLd\.astro['"]/
        );
    });

    it('imports OrganizationJsonLd component', () => {
        // Accept either single or double quotes (Astro files commonly use double quotes for imports)
        expect(src).toMatch(
            /import OrganizationJsonLd from ['"]@\/components\/seo\/OrganizationJsonLd\.astro['"]/
        );
    });

    it('mounts <WebSiteJsonLd /> into the head-extra slot', () => {
        expect(src).toMatch(/<WebSiteJsonLd[^>]*slot=["']head-extra["'][^>]*\/>/);
    });

    it('mounts <OrganizationJsonLd /> into the head-extra slot', () => {
        expect(src).toMatch(/<OrganizationJsonLd[^>]*slot=["']head-extra["'][^>]*\/>/);
    });
});
