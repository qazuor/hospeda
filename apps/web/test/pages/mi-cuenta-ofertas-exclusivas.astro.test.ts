/**
 * @file mi-cuenta-ofertas-exclusivas.astro.test.ts
 * @description HOS-2589 AC-32: the retired exclusive-deals page is a 301 to the
 * public `/{lang}/promociones/` page in the same locale, keeping the query string.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPricingRedirectTarget } from '../../src/lib/pricing-redirect';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/ofertas-exclusivas/index.astro'),
    'utf8'
);

describe('mi-cuenta/ofertas-exclusivas/index.astro (HOS-2589)', () => {
    it('is a permanent redirect to promociones with the request locale and query', () => {
        expect(source).toContain(
            "buildPricingRedirectTarget({ locale, path: 'promociones', search: Astro.url.search })"
        );
        expect(source).toContain('301');
        expect(source).not.toContain('ExclusiveDealsList');
    });

    it('builds the localized target', () => {
        expect(
            buildPricingRedirectTarget({ locale: 'pt', path: 'promociones', search: '?a=1' })
        ).toBe('/pt/promociones/?a=1');
    });
});
