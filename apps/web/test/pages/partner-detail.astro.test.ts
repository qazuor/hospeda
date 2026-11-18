import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/partners/[slug].astro'),
    'utf8'
);

describe('partner detail indexability', () => {
    it('keeps the indexability predicate and actor-blind rendering', () => {
        expect(src).toContain('evaluatePartnerIndexability');
        expect(src).toContain('noindex={!isIndexable}');
        expect(src).not.toContain('Astro.locals.user');
    });

    it('treats an API 200 as confirmation of page presence', () => {
        expect(src).toContain('if (!result.ok) return new Response(null, { status: 404 });');
        expect(src).toContain('hasPublicPage: true');
        expect(src).toContain('description: partner.description');
    });
});

describe('partner detail type label (HOS-2336)', () => {
    it('renders the catalog label in SSR, the legacy keys only as a fallback (AC-5.1)', () => {
        expect(src).toContain('partner.typeLabel ??');
        expect(src).toMatch(/partners\.types\.\$\{partner\.legacyType\}/);
    });

    it('carries the partner type catalog cache tag so a rename reaches the page (R5)', () => {
        expect(src).toContain('CACHE_TAG_PARTNER_TYPES');
    });
});
