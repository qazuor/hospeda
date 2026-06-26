import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/pages/[lang]/partners/index.astro'), 'utf8');

describe('partners listing page', () => {
    it('renders ItemListJsonLd for SEO', () => {
        expect(src).toContain('ItemListJsonLd');
    });

    it('renders the filter sidebar for partner type', () => {
        expect(src).toContain('FilterSidebar');
        expect(src).toContain("id: 'type'");
    });
});
