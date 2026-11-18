/**
 * @file presentacion-proveedores.test.ts
 * @description Wiring of the category chips on `/presentacion/proveedores`
 * (HOS-919 AC-6.1 to AC-6.3). What the chips contain is covered by
 * `test/lib/presentacion/provider-category-chips.test.ts`; this file pins how
 * the page uses it. `.astro` cannot render in Vitest, so these read the source
 * (the pattern `static-pages-cache.test.ts` established for the same family).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/presentacion/proveedores/index.astro'),
    'utf8'
);

/** Argument text of the page's `applyCacheHeaders(...)` call. */
function cacheCallArgs(): string {
    const start = src.indexOf('applyCacheHeaders({');
    expect(start, 'applyCacheHeaders({ not found').toBeGreaterThan(-1);
    let depth = 0;
    for (let i = start + 'applyCacheHeaders'.length; i < src.length; i++) {
        if (src[i] === '(') depth++;
        if (src[i] === ')') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('unbalanced applyCacheHeaders call');
}

describe('presentacion/proveedores — chips come from the catalog (AC-6.1)', () => {
    it('fetches the public catalog through the endpoints layer at SSR', () => {
        expect(src).toContain("from '@/lib/api/endpoints'");
        expect(src).toMatch(/await hostTradeCategoryApi\.getHostTradeCatalog\(\)/);
    });

    it('renders an <h3> per group with the existing .chip spans', () => {
        expect(src).toMatch(/<h3[^>]*>\{group\.title\}<\/h3>/);
        expect(src).toMatch(/<span class="chip">\{chip\.label\}<\/span>/);
    });

    it('keeps no hand-written chip labels', () => {
        const handWritten = src.match(/<span class="chip">[^{<][^<]*<\/span>/g) ?? [];
        expect(handWritten).toEqual([]);
        for (const label of ['Plomería', 'Instalación de gas', 'Pileta y jardín', 'Fletes']) {
            expect(src).not.toContain(`>${label}<`);
        }
    });

    // Owner decision (2026-11-17): the page copy is Spanish-only under every
    // locale BY DESIGN (HOS-978), so the chips are Spanish too. Following the
    // URL locale mixed English chips into Spanish prose on /en/ and /pt/.
    it('renders the chips in Spanish whatever the URL locale', () => {
        const call = src.slice(src.indexOf('buildProviderCategoryChipGroups({'));
        const args = call.slice(0, call.indexOf('});'));
        expect(args).toMatch(/locale:\s*'es'/);
    });

    it('keeps the «uno o más rubros» copy (it is true now)', () => {
        expect(src).toContain('elegís uno o más rubros');
    });
});

describe('presentacion/proveedores — catalog failure degrades, never breaks (AC-6.2)', () => {
    it('renders the chips block only when there are groups to show', () => {
        expect(src).toMatch(/\{chipGroups\.length > 0 &&/);
    });

    it('keeps the «Si tu oficio no está…» sentence outside the chips block', () => {
        const sentence = src.indexOf('Si tu oficio no está');
        const block = src.indexOf('{chipGroups.length > 0 &&');
        expect(sentence).toBeGreaterThan(-1);
        expect(block).toBeGreaterThan(-1);
        // The sentence follows the conditional block, so it renders either way.
        expect(sentence).toBeGreaterThan(block);
        const blockEnd = src.indexOf('</div>', src.indexOf('chips', block));
        expect(sentence).toBeGreaterThan(blockEnd);
    });

    it('keeps a degraded render out of the shared cache', () => {
        expect(src).toContain('import { applyCacheHeaders, markResponseDegraded } from');
        expect(src).toMatch(
            /if \(degraded\) \{\s*markResponseDegraded\(\{ locals: Astro\.locals \}\);/
        );
    });
});

describe('presentacion/proveedores — cache tag (AC-6.1, §6.6)', () => {
    it('emits the catalog tag next to site-config', () => {
        const args = cacheCallArgs();
        expect(args).toMatch(/\bCACHE_TAG_HOST_TRADE_CATEGORIES\b/);
        expect(args).toMatch(/\bCACHE_TAG_SITE_CONFIG\b/);
    });

    it('imports the tag from @repo/cache-tags', () => {
        expect(src).toMatch(
            /import \{[^}]*CACHE_TAG_HOST_TRADE_CATEGORIES[^}]*\} from '@repo\/cache-tags'/
        );
    });

    it('stays on the static class that pairs with site-config', () => {
        expect(cacheCallArgs()).toMatch(/cacheClass:\s*'static'/);
    });
});

describe('presentacion/proveedores — session-blind (AC-6.3)', () => {
    it('reads no session state', () => {
        expect(src).not.toContain('Astro.locals.user');
        expect(src).not.toMatch(/locals\s+as\s+\{[^}]*user/);
    });

    it('does not forward cookies to the catalog call', () => {
        expect(src).not.toMatch(/cookie/i);
    });
});
