/**
 * @file HeaderBackButton.test.ts
 * @description Source-reading tests for HeaderBackButton.astro (HOS-84 T-006:
 * shared, history-aware back button for reworked entity page headers).
 *
 * Behavior: the anchor's `href` is the caller-provided fallback (no-JS /
 * direct-entry), but when the visitor arrived from another page of the site
 * the hoisted script intercepts the click and calls history.back(). Because
 * the site uses Astro's ClientRouter (view transitions), document.referrer is
 * NOT updated on internal navigations — the script also checks the router's
 * history.state.index as the in-app history signal.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/ui/HeaderBackButton.astro'),
    'utf8'
);

describe('HeaderBackButton.astro', () => {
    it('accepts a required href and locale, with optional label and class props', () => {
        expect(src).toMatch(/readonly href: string;/);
        expect(src).toMatch(/readonly locale: SupportedLocale;/);
        expect(src).toMatch(/readonly label\?: string;/);
        expect(src).toMatch(/readonly class\?: string;/);
    });

    it('falls back to the caller-provided href', () => {
        expect(src).toMatch(/href=\{href\}/);
    });

    it('uses the shared ui.actions.goBack i18n key with a label override', () => {
        expect(src).toMatch(/label \?\? t\(\s*'ui\.actions\.goBack'/);
    });

    it('renders the ArrowLeftIcon from @repo/icons', () => {
        expect(src).toContain('ArrowLeftIcon');
        expect(src).toContain("from '@repo/icons'");
    });

    it('intercepts the click with history.back() when in-app history exists', () => {
        expect(src).toContain('data-header-back-button');
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

    it('has no inline style attributes (CSP, SPEC-046)', () => {
        expect(src).not.toMatch(/style=/);
    });

    it('respects prefers-reduced-motion', () => {
        expect(src).toContain('prefers-reduced-motion: reduce');
    });
});
