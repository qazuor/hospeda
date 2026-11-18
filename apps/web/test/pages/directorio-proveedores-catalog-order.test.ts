/**
 * @file directorio-proveedores-catalog-order.test.ts
 * @description The directory page hands the island the catalog order for its
 * filter pills (HOS-919 AC-5.2), and does not depend on it to render.
 *
 * Source-based: `.astro` pages cannot be rendered in Vitest.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/directorio-proveedores/index.astro'),
    'utf8'
);

describe('mi-cuenta/directorio-proveedores/index.astro — catalog order', () => {
    it('reads the public catalog through the endpoints layer, not a raw fetch', () => {
        expect(src).toContain("from '@/lib/api/endpoints'");
        expect(src).toContain('hostTradeCategoryApi.getHostTradeCatalog()');
        expect(src).not.toMatch(/fetch\([^)]*host-trade-categories/);
    });

    it('passes the slug order to the TradesDirectory island', () => {
        expect(src).toContain('catalogOrder={catalogOrder}');
    });

    it('only uses the catalog when the call succeeded (the page renders without it)', () => {
        expect(src).toMatch(/if \(catalogResult\.ok\)/);
        expect(src).toContain('let catalogOrder: string[] | undefined;');
    });

    it('does not fetch the catalog when there are no providers to filter', () => {
        expect(src).toMatch(/if \(trades\.length > 0\) \{\s*const catalogResult/);
    });
});
