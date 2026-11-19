/**
 * @file effective-set-degraded-cache.test.ts
 * @description HOS-2009 regression: a page that reads a public venue or
 * experience payload must veto its own edge cacheability when the API answered
 * in the degraded state (effective set unresolved, `Cache-Control: no-store`).
 * Astro pages cannot be rendered in Vitest, so the wiring is asserted on source.
 * The header decision itself is covered by `middleware-degraded-cache.test.ts`
 * and `response-cache.test.ts`; the API flag by `client.test.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES = [
    '[lang]/comer-y-salir/[slug].astro',
    '[lang]/comer-y-salir/[slug]/carta.astro',
    '[lang]/comer-y-salir/index.astro',
    '[lang]/comer-y-salir/rubro/[rubro]/index.astro',
    '[lang]/experiencias/[slug].astro',
    '[lang]/experiencias/index.astro'
] as const;

describe('pages reading the effective-set-gated public payload (HOS-2009)', () => {
    it.each(PAGES)('%s marks the response degraded from the API result', (page) => {
        const src = readFileSync(resolve(__dirname, '../../src/pages', page), 'utf8');

        expect(src).toContain('markResponseDegradedFromApi');
        expect(src).toMatch(/markResponseDegradedFromApi\(\{[\s\S]*?results:\s*\[/);
    });
});

describe('venue detail optional promotion read', () => {
    it('marks failed or rejected promotion reads degraded before rendering an empty list', () => {
        const src = readFileSync(
            resolve(__dirname, '../../src/pages/[lang]/comer-y-salir/[slug].astro'),
            'utf8'
        );

        expect(src).toContain('markResponseDegraded({ locals: Astro.locals })');
        expect(src).toMatch(/if \(promotionsResult\?\.ok\)[\s\S]*?else \{\s*markResponseDegraded/);
    });
});
