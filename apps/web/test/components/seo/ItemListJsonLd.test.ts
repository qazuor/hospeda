/**
 * @file ItemListJsonLd.test.ts
 * @description Source-based unit tests for ItemListJsonLd.astro.
 * Follows the Astro testing pattern: read the source file and assert on content
 * (Astro components cannot be rendered in Vitest).
 *
 * SPEC-157 follow-up: extend ItemList JSON-LD to events/destinations/posts
 * listings via a single reusable component routed through the JsonLd wrapper
 * (decision D-1, single canonical JSON-LD path).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/seo/ItemListJsonLd.astro'),
    'utf8'
);

describe('ItemListJsonLd.astro', () => {
    describe('imports', () => {
        it('delegates rendering to the JsonLd wrapper (single canonical path)', () => {
            expect(src).toContain("import JsonLd from '@/components/seo/JsonLd.astro'");
        });

        it('does NOT inline a <script set:html> with JSON.stringify (must route via JsonLd)', () => {
            expect(src).not.toMatch(/<script[^>]*set:html/);
            expect(src).not.toContain('JSON.stringify');
        });
    });

    describe('Props (RO-RO, readonly)', () => {
        it('declares a readonly name prop', () => {
            expect(src).toContain('readonly name: string');
        });

        it('declares a readonly items array prop', () => {
            expect(src).toContain('readonly items: ReadonlyArray<ItemListEntry>');
        });

        it('declares an optional numberOfItems prop', () => {
            expect(src).toContain('readonly numberOfItems?: number');
        });

        it('declares an optional startPosition prop', () => {
            expect(src).toContain('readonly startPosition?: number');
        });

        it('defaults numberOfItems to items.length and startPosition to 1', () => {
            expect(src).toContain('numberOfItems = items.length');
            expect(src).toContain('startPosition = 1');
        });
    });

    describe('schema.org shape', () => {
        it('uses the schema.org context', () => {
            expect(src).toContain("'@context': 'https://schema.org'");
        });

        it('uses the ItemList @type', () => {
            expect(src).toContain("'@type': 'ItemList'");
        });

        it('maps entries to ListItem nodes with position offset by startPosition', () => {
            expect(src).toContain("'@type': 'ListItem'");
            expect(src).toContain('position: startPosition + i');
        });

        it('carries the url and name on each entry', () => {
            expect(src).toContain('url: item.url');
            expect(src).toContain('name: item.name');
        });
    });

    describe('rendering', () => {
        it('renders the JsonLd wrapper with the structured data', () => {
            expect(src).toContain('<JsonLd data={data} />');
        });
    });
});
