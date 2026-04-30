/**
 * @file lighthouse-config.test.ts
 * @description Source-based test asserting that the Lighthouse CI config
 * exists and meets the SPEC-096 / REQ-096-38 contract:
 *   - All four categories (performance, accessibility, best-practices, seo)
 *     are asserted at minScore >= 0.8.
 *   - The audit covers the representative page list mandated by REQ-096-38.
 *
 * SPEC-096 / REQ-096-38 (T-069).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFIG_PATH = resolve(__dirname, '../../lighthouserc.json');

describe('lighthouserc.json (SPEC-096 REQ-096-38)', () => {
    it('exists at apps/web/lighthouserc.json', () => {
        expect(existsSync(CONFIG_PATH)).toBe(true);
    });

    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw) as {
        ci: {
            collect: { url: string[] };
            assert: { assertions: Record<string, unknown> };
        };
    };

    describe('collect.url', () => {
        const urls = cfg.ci.collect.url;
        it.each(['/es/', '/es/alojamientos/', '/es/mi-cuenta/', '/es/contacto/'])(
            'audits %s',
            (suffix) => {
                expect(urls.some((u) => u.endsWith(suffix))).toBe(true);
            }
        );
    });

    describe('assert.assertions', () => {
        const assertions = cfg.ci.assert.assertions;

        it.each([
            'categories:performance',
            'categories:accessibility',
            'categories:best-practices',
            'categories:seo'
        ])('asserts %s at >= 0.8', (key) => {
            const rule = assertions[key];
            expect(Array.isArray(rule)).toBe(true);
            expect(rule).toEqual(['error', { minScore: 0.8 }]);
        });
    });
});

describe('Lighthouse audit playbook docs', () => {
    const docPath = resolve(__dirname, '../../docs/quality/lighthouse-audit.md');

    it('exists at apps/web/docs/quality/lighthouse-audit.md', () => {
        expect(existsSync(docPath)).toBe(true);
    });

    it('lists all five audit pages', () => {
        const md = readFileSync(docPath, 'utf8');
        expect(md).toContain('/{locale}/');
        expect(md).toContain('/{locale}/alojamientos/');
        expect(md).toContain('/{locale}/alojamientos/{representative-slug}/');
        expect(md).toContain('/{locale}/mi-cuenta/');
        expect(md).toContain('/{locale}/contacto/');
    });

    it('documents the >= 80 beta target per category', () => {
        const md = readFileSync(docPath, 'utf8');
        expect(md.toLowerCase()).toMatch(/>=\s*80/);
    });
});

describe('JSON-LD audit doc', () => {
    const docPath = resolve(__dirname, '../../docs/seo/json-ld-audit.md');

    it('exists at apps/web/docs/seo/json-ld-audit.md', () => {
        expect(existsSync(docPath)).toBe(true);
    });

    it('lists all entity JSON-LD generators', () => {
        const md = readFileSync(docPath, 'utf8');
        expect(md).toContain('LodgingBusinessJsonLd');
        expect(md).toContain('EventJsonLd');
        expect(md).toContain('PlaceJsonLd');
        expect(md).toContain('ArticleJsonLd');
        expect(md).toContain('BreadcrumbJsonLd');
        expect(md).toContain('FAQPageJsonLd');
        expect(md).toContain('AboutPageJsonLd');
        expect(md).toContain('PriceSpecificationJsonLd');
    });
});
