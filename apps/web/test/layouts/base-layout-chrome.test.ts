/**
 * @file base-layout-chrome.test.ts
 * @description Source-level assertions for `BaseLayout chrome` (HOS-2413 T-018).
 * Astro layouts cannot be rendered under Vitest, so this proves the branch is
 * DECLARED. The rendered behaviour (no MobileDock, one toast viewport) is
 * proven by the structural e2e sweep (T-031) on the kit gallery.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const base = readFileSync(resolve(__dirname, '../../src/layouts/BaseLayout.astro'), 'utf8');
const header = readFileSync(resolve(__dirname, '../../src/layouts/AccountHeader.astro'), 'utf8');

describe('BaseLayout chrome (HOS-2413)', () => {
    it("declares chrome as 'site' | 'account' and defaults to the public chrome", () => {
        expect(base).toContain("readonly chrome?: 'site' | 'account';");
        expect(base).toContain("chrome = 'site',");
        expect(base).toContain("const isAccountChrome = chrome === 'account';");
    });

    it('renders the compact header and footer under account chrome', () => {
        expect(base).toContain('<AccountHeader locale={locale} />');
        expect(base).toContain('<AccountFooter locale={locale}');
    });

    it('keeps the public Header, Footer and MobileDock together in the site branch', () => {
        expect(base).toContain('<Header locale={locale} />');
        const accountBranchStart = base.indexOf('<AccountFooter');
        const dockIndex = base.indexOf('<MobileDock');
        const siteBranchStart = base.indexOf('<Footer locale={locale} />');
        expect(accountBranchStart).toBeGreaterThan(-1);
        expect(siteBranchStart).toBeGreaterThan(accountBranchStart);
        expect(dockIndex).toBeGreaterThan(siteBranchStart);
    });

    it('stays within the 500-line limit', () => {
        expect(base.split('\n').length).toBeLessThanOrEqual(500);
    });
});

describe('AccountHeader.astro (HOS-2413)', () => {
    it('is 56px tall and composes the existing islands instead of copying them', () => {
        expect(header).toContain('block-size: 3.5rem;');
        expect(header).toContain('UserMenu');
        expect(header).toContain('PublishMenu');
        expect(header).toContain('MobileMenuIsland');
        expect(header).toContain("'mobile-toggle'");
    });
});
