/**
 * @file csp-soft-nav-check.test.ts
 * @description Unit tests for the pure helpers behind the over-the-wire
 * soft-navigation CSP check (HOS-807, `scripts/csp-soft-nav-check.mjs`).
 *
 * AAA pattern.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    extractExecutableInlineScripts,
    findSoftNavViolations,
    hasClientRouter,
    parseScriptSrcHashes,
    resolveCheckablePaths
} from '../../scripts/csp-soft-nav-check.mjs';

const referenceHash = (source: string): string =>
    `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`;

describe('extractExecutableInlineScripts', () => {
    it('hashes executable inline scripts only, untrimmed', () => {
        // Arrange
        const html = [
            '<html><head><script>\n a() \n</script>',
            '<script type="module">b()</script>',
            '<script src="/c.js"></script>',
            '<script type="application/ld+json">{"@type":"Place"}</script>',
            '<noscript><script>d()</script></noscript>',
            '<script></script></head></html>'
        ].join('');

        // Act
        const scripts = extractExecutableInlineScripts({ html });

        // Assert
        expect(scripts.map((script: { hash: string }) => script.hash)).toEqual([
            referenceHash('\n a() \n'),
            referenceHash('b()')
        ]);
    });
});

describe('hasClientRouter', () => {
    it('detects the meta tag <ClientRouter /> renders', () => {
        expect(
            hasClientRouter({
                html: '<meta name="astro-view-transitions-enabled" content="true">'
            })
        ).toBe(true);
        expect(hasClientRouter({ html: '<html></html>' })).toBe(false);
    });
});

describe('parseScriptSrcHashes', () => {
    it('reads the sha256 sources of script-src only', () => {
        // Act
        const hashes = parseScriptSrcHashes({
            csp: "default-src 'self'; script-src 'self' 'sha256-A=' 'sha256-B='; style-src 'sha256-C='"
        });

        // Assert
        expect([...hashes]).toEqual(['sha256-A=', 'sha256-B=']);
    });
});

describe('resolveCheckablePaths', () => {
    it('turns [lang]-only patterns into paths and reports the rest as skipped', () => {
        // Act
        const result = resolveCheckablePaths({
            pageRoutes: [
                { pattern: '/[lang]/alojamientos', params: ['lang'] },
                { pattern: '/[lang]/alojamientos/[slug]', params: ['lang', 'slug'] },
                { pattern: '/404', params: [] }
            ],
            locale: 'es'
        });

        // Assert
        expect(result.paths).toEqual(['/404/', '/es/alojamientos/']);
        expect(result.skipped).toEqual(['/[lang]/alojamientos/[slug]']);
    });
});

describe('findSoftNavViolations', () => {
    it('flags a script of one page that another page CSP does not authorise', () => {
        // Arrange: the HOS-807 shape — the listing's chips script is authorised
        // by the listing's own header, not by the home's.
        const chips = { hash: 'sha256-CHIPS=', preview: 'chips()' };
        const pages = [
            { path: '/es/', scripts: [], headerHashes: new Set<string>() },
            { path: '/es/alojamientos/', scripts: [chips], headerHashes: new Set([chips.hash]) }
        ];

        // Act
        const violations = findSoftNavViolations({ pages });

        // Assert
        expect(violations).toEqual([
            {
                hash: chips.hash,
                preview: 'chips()',
                destinations: ['/es/alojamientos/'],
                origins: ['/es/']
            }
        ]);
    });

    it('passes when every header carries every page script (the union)', () => {
        // Arrange
        const chips = { hash: 'sha256-CHIPS=', preview: 'chips()' };
        const union = new Set([chips.hash]);
        const pages = [
            { path: '/es/', scripts: [], headerHashes: union },
            { path: '/es/alojamientos/', scripts: [chips], headerHashes: union }
        ];

        // Act + Assert
        expect(findSoftNavViolations({ pages })).toEqual([]);
    });
});
