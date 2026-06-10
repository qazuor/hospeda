/**
 * @file ContributionBackLink.test.ts
 * @description Source-reading tests for ContributionBackLink.astro
 * (SPEC-191 follow-up: smart "Volver" on the /colaborar subpages).
 *
 * Behavior: the anchor's href points at the contribution hub (no-JS /
 * direct-entry fallback), but when the visitor arrived from another page of
 * the site the hoisted script intercepts the click and calls history.back().
 * Because the site uses Astro's ClientRouter (view transitions),
 * document.referrer is NOT updated on internal navigations — the script also
 * checks the router's history.state.index as the in-app history signal.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/contributions/ContributionBackLink.astro'),
    'utf8'
);

describe('ContributionBackLink.astro', () => {
    it('falls back to the contribution hub via buildUrl', () => {
        expect(src).toContain("path: 'colaborar'");
        expect(src).toMatch(/href=\{hubUrl\}/);
    });

    it('uses the shared back label from the contributions namespace', () => {
        expect(src).toMatch(/t\(\s*'contributions\.back'/);
    });

    it('renders the ArrowLeftIcon from @repo/icons', () => {
        expect(src).toContain('ArrowLeftIcon');
        expect(src).toContain("from '@repo/icons'");
    });

    it('intercepts the click with history.back() when in-app history exists', () => {
        expect(src).toContain('data-contribution-back');
        expect(src).toContain('history.back()');
        expect(src).toContain('preventDefault');
    });

    it('re-binds on every view-transitions navigation (astro:page-load)', () => {
        // Hoisted module scripts run ONCE per session; after a VT swap the
        // link element is new and would otherwise have no listener.
        expect(src).toContain('astro:page-load');
    });

    it('detects in-app history via the view-transitions router state AND the referrer', () => {
        // ClientRouter pushState does not update document.referrer, so both
        // signals are needed.
        expect(src).toMatch(/history\.state/);
        expect(src).toContain('document.referrer');
        expect(src).toMatch(/origin/);
    });
});
