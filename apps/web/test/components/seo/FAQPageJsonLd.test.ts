/**
 * @file FAQPageJsonLd.test.ts
 * @description Source-based unit tests for FAQPageJsonLd.astro.
 *
 * SPEC-096 / REQ-096-42 (T-053).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/FAQPageJsonLd.astro'),
    'utf8'
);

describe('FAQPageJsonLd.astro', () => {
    describe('imports', () => {
        it('delegates to JsonLd wrapper', () => {
            expect(src).toContain("import JsonLd from './JsonLd.astro'");
        });
    });

    describe('Props', () => {
        it('exports an FAQSection interface', () => {
            expect(src).toContain('export interface FAQSection');
        });

        it('declares heading and body fields', () => {
            expect(src).toContain('readonly heading: string');
            expect(src).toContain('readonly body: string');
        });

        it('declares sections prop as ReadonlyArray', () => {
            expect(src).toContain('readonly sections: ReadonlyArray<FAQSection>');
        });
    });

    describe('schema.org shape', () => {
        it('uses schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses FAQPage type', () => {
            expect(src).toContain("'@type': 'FAQPage'");
        });

        it('builds a mainEntity from sections', () => {
            expect(src).toContain('mainEntity: sections.map');
        });

        it('uses Question type for each section', () => {
            expect(src).toContain("'@type': 'Question'");
        });

        it('nests an Answer under acceptedAnswer', () => {
            expect(src).toContain('acceptedAnswer:');
            expect(src).toContain("'@type': 'Answer'");
        });

        it('maps heading to question name and body to answer text', () => {
            expect(src).toMatch(/name:\s*section\.heading/);
            expect(src).toMatch(/text:\s*section\.body/);
        });
    });

    describe('rendering', () => {
        it('renders one JsonLd block', () => {
            expect(src).toContain('<JsonLd data={structuredData} />');
        });
    });
});
