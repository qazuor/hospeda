/**
 * @file account-layout-mobile-sticky-nav.test.ts
 * @description Source-level tests for the mobile sticky account-nav behavior
 * ([NOSPEC:account-nav-sticky]). On mobile the collapsed `/mi-cuenta` menu
 * pins below the sticky site header and morphs from a rounded dropdown into a
 * full-bleed header bar once stuck (detected via IntersectionObserver, no
 * scroll listener). The open panel becomes an absolutely positioned dropdown
 * with capped height + internal scroll so the tall menu stays usable.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, '../../src/layouts/AccountLayout.astro'), 'utf8');

describe('AccountLayout — mobile sticky nav markup', () => {
    it('wraps the toggle + sidebar in a single .account-page__nav sticky wrapper', () => {
        const wrapperIndex = source.indexOf('<div class="account-page__nav">');
        const toggleIndex = source.indexOf('class="account-page__toggle"');
        const asideIndex = source.indexOf('id="account-nav"');
        expect(wrapperIndex).toBeGreaterThan(-1);
        expect(toggleIndex).toBeGreaterThan(wrapperIndex);
        expect(asideIndex).toBeGreaterThan(toggleIndex);
    });

    it('shows the active section as the collapsed toggle label (not the generic menu label)', () => {
        expect(source).toContain('<span class="account-page__toggle-label">{activeLabel}</span>');
    });

    it('keeps the generic menu label only as the resolveActiveLabel fallback + aria-label context', () => {
        expect(source).toContain("return t('account.menu', 'Menú de cuenta');");
        expect(source).toContain('aria-label={`${t(');
        expect(source).toContain('${activeLabel}`}');
    });

    it('derives the active label by matching the active nav item / door via getActiveSectionKey', () => {
        expect(source).toContain('function resolveActiveLabel(): string {');
        expect(source).toContain('if (getActiveSectionKey(item.href) === activeSection) {');
        expect(source).toContain('const activeLabel = resolveActiveLabel();');
    });
});

describe('AccountLayout — stuck detection (no scroll listener)', () => {
    it('flips .is-stuck via a single IntersectionObserver on the wrapper', () => {
        expect(source).toContain('new IntersectionObserver(');
        expect(source).toContain(
            "wrapper.classList.toggle('is-stuck', entry.intersectionRatio < 1)"
        );
        expect(source).toContain('rootMargin: `-${stickyTop + 1}px 0px 0px 0px`');
        expect(source).toContain('threshold: [1]');
        expect(source).toContain('stickyObserver.observe(wrapper)');
    });

    it('does NOT use a scroll event listener (avoids per-frame jank)', () => {
        expect(source).not.toContain("addEventListener('scroll'");
    });
});

describe('AccountLayout — open panel + close affordances', () => {
    it('closes the panel after tapping a nav link (soft-nav keeps the DOM)', () => {
        expect(source).toContain("if ((event.target as HTMLElement).closest('a')) {");
        expect(source).toContain('setOpen(false);');
    });

    it('closes on outside click and on Escape', () => {
        expect(source).toContain('!wrapper.contains(event.target as Node)');
        expect(source).toContain("if (event.key === 'Escape'");
    });

    it('locks page scroll (on the <html> scroll root) while the panel is open, restoring on close', () => {
        expect(source).toContain("document.documentElement.style.overflow = open ? 'hidden' : '';");
    });
});

describe('AccountLayout — mobile CSS contract', () => {
    it('pins the wrapper flush against the 76px sticky site header (no gap), under its z-index', () => {
        expect(source).toContain('top: 76px;');
        expect(source).toContain('z-index: 40;');
    });

    it('derives the observer rootMargin from the wrapper top so detection matches the real pin line', () => {
        expect(source).toContain(
            'const stickyTop = Number.parseInt(getComputedStyle(wrapper).top, 10) || 0;'
        );
        expect(source).toContain('rootMargin: `-${stickyTop + 1}px 0px 0px 0px`');
    });

    it('preserves the desktop inner-sticky travel by stretching the wrapper column', () => {
        expect(source).toContain('align-self: stretch;');
    });

    it('morphs the stuck toggle into a full-viewport-width squared header bar', () => {
        expect(source).toContain('.account-page__nav.is-stuck {');
        expect(source).toContain('width: 100vw;');
        expect(source).toContain('margin-inline: calc(50% - 50vw);');
        expect(source).toContain('border-radius: 0;');
    });

    it('renders the open panel as an absolute dropdown with capped height + internal scroll', () => {
        expect(source).toContain('position: absolute;');
        expect(source).toContain('max-height: calc(100dvh - 10rem);');
        expect(source).toContain('overflow-y: auto;');
    });
});
