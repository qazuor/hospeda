/**
 * @file search-bar-breakpoint-sync.test.ts
 * @description Static guard keeping the hero SearchBar's bottom-sheet
 * breakpoint in sync across its two declarations (HOS-323).
 *
 * `MOBILE_SHEET_MEDIA_QUERY` in `SearchBar.client.tsx` decides when the panels
 * are portaled out of the hero's stacking context; the `@media (max-width: …)`
 * block in `SearchBar.module.css` decides when they actually become
 * `position: fixed` bottom-sheets. The portal is only correct while the two
 * agree, and until now that was enforced by nothing but a code comment.
 *
 * Change the CSS alone to, say, 950px and at 920px the CSS renders a fixed
 * sheet that JS does not portal — HOS-323 silently regresses while the unit
 * suite stays green, because its `matchMedia` mock matches on
 * `query.includes('900px')`, i.e. it checks the JS constant against itself.
 *
 * The breakpoint is read from the TS constant and asserted against the CSS, so
 * the number is never written twice in this file.
 *
 * Mirrors the fs-based scanning style of `commerce-lead-isolation.test.ts` —
 * no new tooling required.
 *
 * @module test/static-guards/search-bar-breakpoint-sync
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_SRC = path.resolve(__dirname, '../../src');
const SEARCH_BAR_TSX = path.join(WEB_SRC, 'components/sections/SearchBar.client.tsx');
const SEARCH_BAR_CSS = path.join(WEB_SRC, 'components/sections/SearchBar.module.css');

/** Extracts the max-width value declared by `MOBILE_SHEET_MEDIA_QUERY`. */
function readTsBreakpoint(): number {
    const source = fs.readFileSync(SEARCH_BAR_TSX, 'utf-8');
    const match = source.match(/MOBILE_SHEET_MEDIA_QUERY\s*=\s*'\(max-width:\s*(\d+)px\)'/);
    if (!match?.[1]) {
        throw new Error(
            `Could not find MOBILE_SHEET_MEDIA_QUERY = '(max-width: Npx)' in ${SEARCH_BAR_TSX}. ` +
                'If the constant was renamed or reshaped, update this guard — do not delete it.'
        );
    }
    return Number(match[1]);
}

/**
 * Finds the max-width of the `@media` block that turns `.panel` into a fixed
 * bottom-sheet, by locating that rule and scanning backwards for the nearest
 * preceding media query. Matching the *specific* block matters: the stylesheet
 * has other `@media (max-width: …)` blocks, so a naive "does the file contain
 * this number" check would pass even after the sheet block alone was retuned.
 */
function readCssSheetBreakpoint(): number {
    const css = fs.readFileSync(SEARCH_BAR_CSS, 'utf-8');
    const panelFixedIndex = css.search(/\.panel\s*\{[^}]*position:\s*fixed/);
    if (panelFixedIndex === -1) {
        throw new Error(
            `Could not find the '.panel { position: fixed }' bottom-sheet rule in ${SEARCH_BAR_CSS}. ` +
                'If the sheet stopped being position:fixed, the portal gate needs rethinking — do not delete this guard.'
        );
    }
    const preceding = css.slice(0, panelFixedIndex);
    const mediaQueries = [...preceding.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)];
    const nearest = mediaQueries[mediaQueries.length - 1];
    if (!nearest?.[1]) {
        throw new Error(
            `'.panel { position: fixed }' in ${SEARCH_BAR_CSS} is not inside a (max-width: Npx) media query.`
        );
    }
    return Number(nearest[1]);
}

describe('HOS-323 static guard — SearchBar sheet breakpoint is declared once', () => {
    it('the CSS bottom-sheet media query matches MOBILE_SHEET_MEDIA_QUERY', () => {
        const tsBreakpoint = readTsBreakpoint();
        const cssBreakpoint = readCssSheetBreakpoint();

        expect(
            cssBreakpoint,
            'SearchBar.module.css switches the panel to a fixed bottom-sheet at a different width ' +
                'than SearchBar.client.tsx portals it. Between the two values the CSS renders a ' +
                'sheet that JS leaves buried in the hero stacking context (HOS-323).'
        ).toBe(tsBreakpoint);
    });
});
