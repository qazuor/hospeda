/** @module test/layouts/mobile-dock */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = resolve(__dirname, '../../src');
const read = (path: string): string => readFileSync(resolve(SOURCE, path), 'utf8');
const base = read('layouts/BaseLayout.astro');
const listing = read('layouts/ListingLayout.astro');
const dock = read('components/shared/dock/MobileDock.astro');
const scrollToTop = read('components/shared/navigation/ScrollToTop.astro');
const globalCss = read('styles/global.css');
const toast = read('components/ui/ToastViewport.module.css');
const slots = read('lib/mobile-dock/mobile-dock-slots.ts');

const SLOT_ORDER = ['above', 'filters', 'start', 'map-cards', 'ai-search', 'ai-chat'];

describe('TEST:1768:1 MobileDock layout contract', () => {
    it('mounts one dock in BaseLayout and forwards listing dock-start', () => {
        expect(base.match(/<MobileDock\b/g)).toHaveLength(1);
        expect(base).not.toContain('<ScrollToTop');
        expect(dock).toMatch(/<div class="mobile-dock__end">[\s\S]*?<ScrollToTop[\s\S]*?<\/div>/);
        const markup = dock.split('<style>')[0] ?? '';
        const slotNames = [...markup.matchAll(/data-mobile-dock-slot="([^"]+)"/g)].map(
            (match) => match[1]
        );
        expect(slotNames).toEqual(SLOT_ORDER);
        expect(slots).toMatch(
            /MOBILE_DOCK_SLOTS\s*=\s*\[\s*'above',\s*'filters',\s*'start',\s*'map-cards',\s*'ai-search',\s*'ai-chat'\s*\]\s+as const/
        );
        expect(dock).toContain('data-mobile-dock-slot="start" data-listing-swap="dock-start"');
        expect(dock).not.toMatch(/Astro\.(locals|cookies|request)/);
        expect(dock).not.toContain('style=');
        expect(listing).toContain('<slot name="dock-start" slot="dock-start" />');
    });
});

describe('TEST:1768:2 desktop layout preservation', () => {
    it('uses display contents before the mobile rules and hides the mobile-only start slot', () => {
        const style = dock.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
        const desktop = style.split('@media (max-width: 767px)')[0] ?? '';
        expect(desktop).toMatch(/display:\s*contents/);
        expect(desktop).not.toContain('position: fixed');
        expect(desktop).toMatch(/data-mobile-dock-slot="start"[^}]*display:\s*none/s);
    });

    it('keeps the scroll-to-top base fixed sizing and stacking values', () => {
        const baseRule = scrollToTop.match(/\.scroll-to-top\s*\{([^}]+)\}/)?.[1] ?? '';
        expect(baseRule).toMatch(/position:\s*fixed/);
        expect(baseRule).toMatch(/bottom:\s*1\.5rem/);
        expect(baseRule).toMatch(/right:\s*1\.5rem/);
        expect(baseRule).toMatch(/height:\s*48px/);
        expect(baseRule).toMatch(/width:\s*48px/);
        expect(baseRule).toMatch(/z-index:\s*50/);
    });
});

describe('TEST:1768:5 dock reservation and stacking scale', () => {
    it('defines web-only z and height tokens and reserves the mobile dock after body content', () => {
        expect(globalCss).toContain('--z-floating-dock: calc(var(--z-nav) + 5);');
        expect(globalCss).toContain('--mobile-dock-height: 0px;');
        expect(globalCss).toMatch(
            /@media \(max-width: 767px\)[\s\S]*?body,\s*body\.cookie-banner-open\s*\{[^}]*padding-bottom:\s*calc\(var\(--bottom-safe-inset, 0px\) \+ var\(--mobile-dock-height, 0px\)\)/
        );
    });
});

describe('TEST:1768:6 bars stack with the dock', () => {
    it('places the dock above the cookie banner and raises base toasts above the dock', () => {
        expect(dock).toContain('bottom: var(--bottom-safe-inset, 0px)');
        const baseRule = toast.match(/\.viewport\s*\{([^}]+)\}/)?.[1] ?? '';
        expect(baseRule).toMatch(
            /inset-block-end:\s*calc\([^;]*var\(--bottom-safe-inset, 0px\)\s*\+\s*var\(--mobile-dock-height, 0px\)[^;]*\)/
        );
    });
});

describe('TEST:1768:7 dock overlay rule and z scale', () => {
    it('hides for exactly the three agreed flags and uses the named z token', () => {
        const flags = [...dock.matchAll(/html\[data-([a-z-]+-open)\]/g)].map((match) => match[1]);
        expect(flags).toEqual(['mobile-menu-open', 'search-panel-open', 'filters-drawer-open']);
        expect(dock).toContain('z-index: var(--z-floating-dock)');
        expect(dock).not.toMatch(/z-index:\s*\d/);
    });
});

describe('TEST:1768:8 ScrollToTop dock item', () => {
    it('marks the button and removes it from the mobile row until visible', () => {
        expect(scrollToTop).toMatch(/<button[\s\S]*?data-dock-item/);
        const mobileStart = scrollToTop.indexOf('@media (max-width: 767px)');
        const mobileEnd = scrollToTop.indexOf(
            '@media (prefers-reduced-motion: reduce)',
            mobileStart
        );
        const mobile = scrollToTop.slice(mobileStart, mobileEnd);
        expect(mobile).toMatch(/position:\s*static/);
        expect(mobile).toMatch(/height:\s*44px/);
        expect(mobile).toMatch(/width:\s*44px/);
        expect(mobile).not.toMatch(/\b(bottom|right):/);
        expect(mobile).toMatch(
            /\.scroll-to-top:not\(\.scroll-to-top--visible\)\s*\{[^}]*display:\s*none/s
        );
    });
});

describe('TEST:1768:20 mobile dock auto-hide contract', () => {
    it('initializes auto-hide with the dock and cleans it up with its measurement', () => {
        const script = dock.split('<script>')[1] ?? '';
        expect(script).toContain(
            "import { initDockAutoHide } from '@/lib/mobile-dock/mobile-dock-autohide'"
        );
        expect(script).toMatch(/initDockAutoHide\s*\(/);
        expect(script).toMatch(/cleanupAutoHide/);
    });

    it('keeps hidden transform inside the mobile breakpoint and disables its transition for reduced motion', () => {
        const style = dock.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
        const mobileStart = style.indexOf('@media (max-width: 767px)');
        const mobileEnd = style.indexOf('\n\t}', mobileStart);
        const mobile = style.slice(mobileStart, mobileEnd);
        expect(mobile).toMatch(
            /\.mobile-dock\s*\{[^}]*transition:\s*transform var\(--duration-normal\) ease/s
        );
        expect(mobile).toMatch(
            /\.mobile-dock\[data-dock-hidden\]\s*\{[^}]*transform:\s*translateY\(calc\(100% \+ var\(--bottom-safe-inset, 0px\)\)\)/s
        );
        expect(style).toMatch(
            /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.mobile-dock\s*\{[^}]*transition:\s*none/s
        );
        expect(dock).not.toContain('style=');
    });
});
