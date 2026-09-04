/**
 * @file pricing-page-paths.test.ts
 * @description The ONE place `PRICING_PAGE_PATH_BY_AUDIENCE`'s literal values
 * are frozen, plus the guard that every path it names is a page this repo
 * actually serves (HOS-1032 AC-51).
 *
 * ## Why one place
 *
 * These five URLs had been spelled by hand in eleven modules — the account
 * upsells, four `.client.tsx` islands, both comparison tables, the audience
 * index and `account-roles.ts` — and the assertions about them were spread just
 * as thin. The pages then moved twice (HOS-942, then HOS-1032), and each move
 * rewrote every literal in every test without a single one of them catching a
 * defect: a test that restates the value the code was just changed to cannot
 * fail. So the consumers now read the map, their tests assert the DECISION they
 * make with it (which audience, not which URL), and the values are pinned here.
 *
 * A change to any of these five strings is a URL migration. It needs redirects
 * from the old paths, both inventories updated (`static-sitemap-pages.ts` and
 * the a11y sweep), and every in-product link repointed. Failing this file is the
 * reminder that the string is not the whole change.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '../../src/lib/pricing-plans';

const PAGES_ROOT = resolve(__dirname, '../../src/pages/[lang]');

describe('PRICING_PAGE_PATH_BY_AUDIENCE', () => {
    it('names the five pricing pages under the /planes/ namespace', () => {
        expect(PRICING_PAGE_PATH_BY_AUDIENCE).toEqual({
            owner: 'planes/anfitriones/precios',
            tourist: 'planes/turistas/precios',
            gastronomy: 'planes/gastronomia/precios',
            experience: 'planes/experiencias/precios',
            partner: 'planes/aliados/precios'
        });
    });

    it('points every audience at a page file that exists', () => {
        // The half a value-freeze cannot do on its own. A path can be updated to
        // a URL nothing serves — which typechecks, renders a link, and 404s only
        // for whoever clicks it — so each one is resolved against the routes on
        // disk. `[lang]` is a real directory name here, not a glob.
        for (const [audience, path] of Object.entries(PRICING_PAGE_PATH_BY_AUDIENCE)) {
            const pageFile = resolve(PAGES_ROOT, path, 'index.astro');
            expect(existsSync(pageFile), `${audience} → ${path} has no page file`).toBe(true);
        }
    });

    it('gives every audience a distinct path', () => {
        const paths = Object.values(PRICING_PAGE_PATH_BY_AUDIENCE);
        expect(new Set(paths).size).toBe(paths.length);
    });

    it('names no path that this repo answers with a redirect', () => {
        // The URLs HOS-1032 retired. Pointing the map back at one of them would
        // send every consumer — the upsells, the islands, both comparison
        // tables — through a 301 that resolves to the page they were already
        // trying to reach.
        const RETIRED = [
            'suscriptores/planes/anfitriones',
            'suscriptores/planes/turistas',
            'suscriptores/planes/comparar',
            'suscriptores/turistas',
            'suscriptores/turistas/comparar',
            'suscriptores/propietarios',
            'publicar-restaurante',
            'publicar-experiencia'
        ];
        for (const path of Object.values(PRICING_PAGE_PATH_BY_AUDIENCE)) {
            expect(RETIRED).not.toContain(path);
        }
    });
});
