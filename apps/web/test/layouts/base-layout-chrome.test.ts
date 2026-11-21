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
    it('provides the compact header, the one-line footer and the account toast region', () => {
        expect(shell).toContain('<AccountHeader slot="chrome-header"');
        expect(shell).toContain('<AccountFooter slot="chrome-footer"');
        expect(shell).toContain('<AccountToastRegion slot="chrome-toasts" client:idle');
        expect(shell.match(/<AccountToastRegion/g)).toHaveLength(1);
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
