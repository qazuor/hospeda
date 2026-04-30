/**
 * @file AboutPageJsonLd.test.ts
 * @description Source-based unit tests for AboutPageJsonLd.astro.
 * Follows the Astro testing pattern: read the source file and assert on content.
 *
 * SPEC-096 / REQ-096-40 (T-051).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/AboutPageJsonLd.astro'),
    'utf8'
);

describe('AboutPageJsonLd.astro', () => {
    describe('imports', () => {
        it('delegates rendering to JsonLd wrapper', () => {
            expect(src).toContain("import JsonLd from './JsonLd.astro'");
        });
    });

    describe('Props', () => {
        it('declares title prop', () => {
            expect(src).toContain('readonly title: string');
        });

        it('declares description prop', () => {
            expect(src).toContain('readonly description: string');
        });

        it('declares url prop', () => {
            expect(src).toContain('readonly url: string');
        });

        it('declares inLanguage prop', () => {
            expect(src).toContain('readonly inLanguage: string');
        });

        it('declares optional image prop', () => {
            expect(src).toContain('readonly image?: string');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses AboutPage type', () => {
            expect(src).toContain("'@type': 'AboutPage'");
        });

        it('maps title to name', () => {
            expect(src).toMatch(/name:\s*title/);
        });

        it('includes description, url and inLanguage in payload', () => {
            expect(src).toMatch(/description,\s*\n\s*url,\s*\n\s*inLanguage/);
        });

        it('only adds image when provided', () => {
            expect(src).toMatch(/if\s*\(image\)/);
            expect(src).toMatch(/structuredData\.image\s*=\s*image/);
        });
    });

    describe('rendering', () => {
        it('renders the JsonLd wrapper with the structured data', () => {
            expect(src).toContain('<JsonLd data={structuredData} />');
        });
    });
});
