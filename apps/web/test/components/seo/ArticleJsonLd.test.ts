/**
 * @file ArticleJsonLd.test.ts
 * @description Source-based unit tests for ArticleJsonLd.astro.
 * Follows the Astro testing pattern: read the source file and assert on content.
 *
 * Covers the AEO `speakable` enhancement (voice-assistant friendly markup):
 * when `speakableCssSelectors` is passed, a SpeakableSpecification block is
 * emitted; otherwise it is omitted.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/ArticleJsonLd.astro'),
    'utf8'
);

describe('ArticleJsonLd.astro', () => {
    describe('imports', () => {
        it('delegates rendering to JsonLd wrapper', () => {
            expect(src).toContain("import JsonLd from './JsonLd.astro'");
        });
    });

    describe('Props', () => {
        it('declares headline prop', () => {
            expect(src).toContain('readonly headline: string');
        });

        it('declares the optional speakableCssSelectors prop as ReadonlyArray', () => {
            expect(src).toContain('readonly speakableCssSelectors?: ReadonlyArray<string>');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('keeps the existing publisher Organization block', () => {
            expect(src).toContain("'@type': 'Organization'");
        });
    });

    describe('speakable (AEO / voice)', () => {
        it('emits a SpeakableSpecification type', () => {
            expect(src).toContain("'@type': 'SpeakableSpecification'");
        });

        it('uses the cssSelector key for speakable selectors', () => {
            expect(src).toContain('cssSelector');
        });

        it('only emits speakable when selectors are present and non-empty', () => {
            // The implementation must guard on length so an empty array is omitted.
            expect(src).toMatch(/speakableCssSelectors\b[^\n]*length/);
        });

        it('attaches speakable to the structured data object', () => {
            expect(src).toMatch(/structuredData\.speakable\s*=/);
        });
    });

    describe('rendering', () => {
        it('renders the JsonLd wrapper with the structured data', () => {
            expect(src).toContain('<JsonLd data={structuredData} />');
        });
    });
});
