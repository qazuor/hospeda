/**
 * @file mi-cuenta-ofertas-exclusivas.astro.test.ts
 * @description Source-level assertions for the exclusive-deals SSR shell
 * page (HOS-21 T-011). Astro pages cannot be rendered via Vitest, so we
 * lean on string-level assertions on the .astro source — same pattern used
 * by `mi-cuenta-editar.astro.test.ts` and the `alertas` precedent.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/ofertas-exclusivas/index.astro'),
    'utf8'
);

describe('mi-cuenta/ofertas-exclusivas/index.astro (HOS-21 T-011)', () => {
    it('redirects unauthenticated visitors to signin (safety-net guard)', () => {
        expect(source).toContain('Astro.locals.user');
        expect(source).toMatch(/if\s*\(\s*!user\s*\)/);
        expect(source).toContain("path: 'auth/signin'");
    });

    it('resolves locale from Astro.locals', () => {
        expect(source).toContain('Astro.locals.locale as SupportedLocale');
    });

    it('uses the account.pages.exclusiveDeals i18n keys for title/description', () => {
        expect(source).toContain("'account.pages.exclusiveDeals.title'");
        expect(source).toContain("'account.pages.exclusiveDeals.description'");
    });

    it('mounts the ExclusiveDealsList island with client:load', () => {
        expect(source).toContain('<ExclusiveDealsList');
        expect(source).toContain('client:load');
    });

    it('forwards locale, apiUrl, and userId to the island', () => {
        expect(source).toMatch(/locale={locale}/);
        expect(source).toMatch(/apiUrl={apiUrl}/);
        expect(source).toMatch(/userId={user\.id}/);
    });

    it('wraps content in AccountLayout with the ofertas-exclusivas active section', () => {
        expect(source).toContain('<AccountLayout');
        expect(source).toContain('activeSection="ofertas-exclusivas"');
    });
});
