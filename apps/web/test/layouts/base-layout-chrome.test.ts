/**
 * @file base-layout-chrome.test.ts
 * @description Source-level assertions for the `BaseLayout` chrome slots (HOS-2413 T-018).
 * Astro layouts cannot be rendered under Vitest, so this proves the branch is
 * DECLARED. The rendered behaviour (no MobileDock, one toast viewport) is
 * proven by the structural e2e sweep (T-031) on the kit gallery.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const base = readFileSync(resolve(__dirname, '../../src/layouts/BaseLayout.astro'), 'utf8');
const shell = readFileSync(resolve(__dirname, '../../src/layouts/AccountShell.astro'), 'utf8');
const header = readFileSync(resolve(__dirname, '../../src/layouts/AccountHeader.astro'), 'utf8');

describe('BaseLayout chrome slots (HOS-2413)', () => {
    it('exposes the header, footer and toast viewport as slots with the site chrome as fallback', () => {
        expect(base).toContain('<slot name="chrome-header"><Header locale={locale} /></slot>');
        expect(base).toContain('<slot name="chrome-footer">');
        expect(base).toContain('<Footer locale={locale} />');
        expect(base).toContain(
            '<slot name="chrome-toasts"><ToastViewport client:idle locale={locale} /></slot>'
        );
    });

    it('keeps the MobileDock inside the footer slot fallback, so account pages have none', () => {
        const footerSlot = base.indexOf('<slot name="chrome-footer">');
        const dock = base.indexOf('<MobileDock');
        const slotEnd = base.indexOf('</slot>', dock);
        expect(footerSlot).toBeGreaterThan(-1);
        expect(dock).toBeGreaterThan(footerSlot);
        expect(slotEnd).toBeGreaterThan(dock);
    });

    it('imports NO account chrome, so public pages never ship its CSS or JS', () => {
        expect(base).not.toMatch(
            /AccountHeader|AccountFooter|AccountToastRegion|components\/account\//
        );
    });

    it('stays within the 500-line limit', () => {
        expect(base.split('\n').length).toBeLessThanOrEqual(500);
    });
});

describe('AccountShell fills the chrome slots (HOS-2413)', () => {
    it('provides the account header, the two-row footer and the account toast region', () => {
        expect(shell).toContain('<AccountHeader slot="chrome-header"');
        expect(shell).toMatch(
            /<AccountFooter\s+slot="chrome-footer"[^>]*logoSrc=\{footerLogoSrc\}/
        );
        expect(shell).toContain('<AccountToastRegion slot="chrome-toasts" client:idle');
        expect(shell.match(/<AccountToastRegion/g)).toHaveLength(1);
    });
});

describe('AccountHeader.astro (HOS-2413, HOS-2550)', () => {
    it('is 64px tall and composes the existing islands instead of copying them', () => {
        expect(header).toContain('block-size: 4rem;');
        expect(header).toContain('UserMenu');
        expect(header).toContain('PublishMenu');
        expect(header).toContain('MobileMenuIsland');
    });

    it('renders the 36px logo and the site nav from the chrome model', () => {
        expect(header).toMatch(/<Image src=\{logoSrc\} alt="" width=\{34\} height=\{36\}/);
        expect(header).toContain('siteNav.inline.map(');
        expect(header).toContain('navItems={siteNav.menu}');
        expect(header).toContain("aria-label={t('account.ui.chrome.siteNav')}");
    });

    it('shows the inline nav and hides the hamburger only from 80rem', () => {
        const wide = header.slice(header.indexOf('@media (min-width: 80rem)'));
        expect(header).toMatch(/\.account-header__nav \{\s*display: none;/);
        expect(wide).toMatch(/\.account-header__nav \{\s*display: block;/);
        expect(wide).toMatch(/:global\(\.account-header__hamburger\)\s*\{\s*display: none;/);
    });

    it('wires its own hamburger, with an attribute the site header listener ignores', () => {
        expect(header).toContain("data={{ 'account-mobile-toggle': '' }}");
        expect(header).not.toContain("'mobile-toggle'");
        expect(header).toContain('wireAccountMenuToggle({ doc: document });');
    });

    it('carries labelled help and what-s-new icons, the badge as a client island', () => {
        expect(header).toContain("ariaLabel={t('account.ui.chrome.helpCenter')}");
        expect(header).toContain('href={actions.help.href}');
        expect(header).toContain("ariaLabel={t('account.ui.chrome.whatsNew')}");
        expect(header).toContain('href={actions.whatsNew.href}');
        expect(header).toContain('<WhatsNewCountPill locale={locale} client:idle />');
    });
});
