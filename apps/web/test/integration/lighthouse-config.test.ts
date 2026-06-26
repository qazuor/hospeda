/**
 * @file lighthouse-config.test.ts
 * @description Source-based test asserting that the Lighthouse CI config
 * exists and meets the contract.
 *
 * SPEC-269 T-269-11 reconciled this config from the original flat SPEC-096
 * shape (all categories `error` >= 0.8 on the same page list) into a per-URL
 * `assertMatrix`:
 *   - Home (`.../es/$`): performance is the blocking gate (`error`, minScore
 *     0.8); accessibility / best-practices / SEO stay advisory (`warn`, 0.9).
 *   - The public listing pages (alojamientos / eventos / destinos): every
 *     category is advisory (`warn`) because their scores are noisier and not
 *     the focus of the SPEC-269 fixes.
 * The home `performance` threshold is intentionally kept at 0.8 until a clean
 * CI baseline confirms the real score; promotion to 0.9 / hard-block is a
 * documented follow-up.
 *
 * SPEC-096 / REQ-096-38 (T-069) originally introduced the config; SPEC-269
 * T-269-11 owns its current shape.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFIG_PATH = resolve(__dirname, '../../lighthouserc.json');

type Assertion = readonly [string, { readonly minScore: number }];

describe('lighthouserc.json (SPEC-269 T-269-11)', () => {
    it('exists at apps/web/lighthouserc.json', () => {
        expect(existsSync(CONFIG_PATH)).toBe(true);
    });

    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw) as {
        ci: {
            collect: { url: string[] };
            assert: {
                assertMatrix: {
                    matchingUrlPattern: string;
                    assertions: Record<string, Assertion>;
                }[];
            };
        };
    };

    describe('collect.url', () => {
        const urls = cfg.ci.collect.url;
        it.each(['/es/', '/es/alojamientos/', '/es/eventos/', '/es/destinos/'])(
            'audits %s',
            (suffix) => {
                expect(urls.some((u) => u.endsWith(suffix))).toBe(true);
            }
        );
    });

    describe('assert.assertMatrix', () => {
        const matrix = cfg.ci.assert.assertMatrix;

        const homeGroup = matrix.find((g) => g.matchingUrlPattern === '.*/es/$');
        const listingGroup = matrix.find((g) => g.matchingUrlPattern.includes('alojamientos'));

        it('defines a home group and a listing group', () => {
            expect(homeGroup).toBeDefined();
            expect(listingGroup).toBeDefined();
        });

        it('blocks on home performance (error >= 0.8)', () => {
            expect(homeGroup?.assertions['categories:performance']).toEqual([
                'error',
                { minScore: 0.8 }
            ]);
        });

        it.each(['categories:accessibility', 'categories:best-practices', 'categories:seo'])(
            'keeps home %s advisory (warn >= 0.9)',
            (key) => {
                expect(homeGroup?.assertions[key]).toEqual(['warn', { minScore: 0.9 }]);
            }
        );

        it('keeps listing performance advisory (warn)', () => {
            expect(listingGroup?.assertions['categories:performance']?.[0]).toBe('warn');
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
