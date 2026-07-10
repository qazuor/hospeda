/**
 * @file FilterChips.test.ts
 * @description Source-reading unit tests for FilterChips.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify props, structure, accessibility, and styling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/ui/FilterChips.astro'),
    'utf8'
);

describe('FilterChips.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file FilterChips.astro');
        });

        it('defines a ChipItem interface', () => {
            expect(src).toContain('interface ChipItem');
        });

        it('defines a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('accepts chips prop as ReadonlyArray<ChipItem>', () => {
            expect(src).toContain('ReadonlyArray<ChipItem>');
        });

        it('accepts ariaLabel prop as string', () => {
            expect(src).toContain('readonly ariaLabel: string');
        });
    });

    describe('ChipItem interface', () => {
        it('defines readonly label property', () => {
            expect(src).toContain('readonly label: string');
        });

        it('defines readonly href property', () => {
            expect(src).toContain('readonly href: string');
        });

        it('defines an optional readonly icon property (BETA-113 icon parity)', () => {
            expect(src).toContain('readonly icon?: ComponentType<IconProps>');
        });
    });

    describe('accessible markup', () => {
        it('wraps chips in a <nav class="filter-chips__nav"> landmark inside the root container', () => {
            expect(src).toContain('<nav class="filter-chips__nav"');
            expect(src).toContain('class="filter-chips"');
        });

        it('passes ariaLabel to the nav aria-label attribute', () => {
            expect(src).toContain('aria-label={ariaLabel}');
        });

        it('renders a <ul> list with role="list"', () => {
            expect(src).toContain('<ul');
            expect(src).toContain('role="list"');
        });

        it('renders <li> items inside the list', () => {
            expect(src).toContain('<li');
        });

        it('renders each chip as an <a> anchor element', () => {
            expect(src).toContain('<a');
            expect(src).toContain('href={href}');
        });
    });

    describe('chip rendering', () => {
        it('applies filter-chips__chip class to anchor elements', () => {
            expect(src).toContain("'filter-chips__chip'");
        });

        it('supports an active/selected chip state', () => {
            expect(src).toContain('filter-chips__chip--active');
            expect(src).toContain('aria-current');
        });

        it('applies filter-chips__item class to list items', () => {
            expect(src).toContain('class="filter-chips__item"');
        });

        it('applies filter-chips__list class to the ul', () => {
            expect(src).toContain('class="filter-chips__list"');
        });

        it('maps over chips array to render each chip', () => {
            expect(src).toContain('chips.map(');
        });

        it('renders the chip label inside the anchor', () => {
            expect(src).toContain('{label}');
        });
    });

    describe('horizontal scroll behaviour', () => {
        it('sets overflow-x: auto on the list', () => {
            expect(src).toContain('overflow-x: auto');
        });

        it('uses flex-wrap: nowrap to prevent line breaks', () => {
            expect(src).toContain('flex-wrap: nowrap');
        });

        it('uses flex-direction: row for horizontal layout', () => {
            expect(src).toContain('flex-direction: row');
        });

        it('sets flex-shrink: 0 on chips to prevent squishing', () => {
            expect(src).toContain('flex-shrink: 0');
        });

        // Regression (HOS-97 owner feedback): an inline-flex chip inside an
        // overflowing nowrap flex row is shrink-to-fit sized by Chromium in a
        // way that undercounts its trailing padding, gluing the label to the
        // right edge. `min-width: max-content` forces the intrinsic width to
        // include the full padding so left/right padding stays symmetric.
        it('sets min-width: max-content on chips so trailing padding is not clipped', () => {
            expect(src).toContain('min-width: max-content');
        });

        // The label is wrapped in its own element (not a bare text expression)
        // so template whitespace can never leak into the chip's inline box.
        it('wraps the chip label in a dedicated element', () => {
            expect(src).toContain('filter-chips__chip-label');
        });

        it('hides the scrollbar with scrollbar-width: none', () => {
            expect(src).toContain('scrollbar-width: none');
        });
    });

    describe('styles', () => {
        it('uses --radius-pill for chip border-radius', () => {
            expect(src).toContain('var(--radius-pill');
        });

        it('uses --card for chip background', () => {
            expect(src).toContain('var(--core-card)');
        });

        it('uses --font-sans for chip text', () => {
            expect(src).toContain('var(--font-sans)');
        });

        it('uses --text-body-sm for chip font size', () => {
            expect(src).toContain('var(--text-body-sm)');
        });

        it('uses --accent for hover state', () => {
            expect(src).toContain('var(--brand-accent)');
        });

        it('uses --duration-normal for transitions', () => {
            expect(src).toContain('var(--duration-normal)');
        });

        it('includes focus-visible rule for keyboard navigation', () => {
            expect(src).toContain(':focus-visible');
        });

        it('spaces the chip row from the results grid below it (BETA-120)', () => {
            // Without a bottom margin the chip row sits flush against the
            // first cards. The rule lives on .filter-chips (the nav wrapper).
            expect(src).toMatch(/\.filter-chips\s*\{[^}]*margin-bottom:\s*var\(--space-6/);
        });
    });

    describe('scroll-edge fade (BETA-30)', () => {
        it('defaults both edge fades to 0 so the first chip is never dimmed at rest', () => {
            expect(src).toContain('--filter-chips-fade-start: 0px');
            expect(src).toContain('--filter-chips-fade-end: 0px');
        });

        it('drives the mask from the fade custom properties (not a fixed 48px left fade)', () => {
            expect(src).toContain('black var(--filter-chips-fade-start)');
            expect(src).toContain('calc(100% - var(--filter-chips-fade-end))');
            // The old fixed-width fade in the gradient must be gone.
            expect(src).not.toContain('black 48px');
        });

        it('toggles the fades from a scroll-state script', () => {
            expect(src).toContain('<script>');
            expect(src).toContain("addEventListener('scroll'");
            expect(src).toContain('--filter-chips-fade-start');
            expect(src).toContain('scrollLeft');
        });

        it('re-evaluates on resize and on every page load (incl. View Transitions)', () => {
            expect(src).toContain('ResizeObserver');
            expect(src).toContain("addEventListener('astro:page-load'");
        });

        it('is idempotent per instance via a root-level ready guard', () => {
            expect(src).toContain('dataset.filterChipsReady');
            expect(src).toContain(':not([data-filter-chips-ready])');
        });

        it('scopes all script lookups to the component root (no page-global list selector)', () => {
            // Multiple FilterChips instances on the same page must never
            // collide — every lookup must go through container.querySelector,
            // not a flat document-wide selector for the list/buttons.
            expect(src).toContain(
                "container.querySelector<HTMLElement>('[data-filter-chips-list]')"
            );
            expect(src).not.toContain(
                "document.querySelectorAll<HTMLElement>('.filter-chips__list')"
            );
        });
    });

    describe('BETA-113 — optional leading icon (icon parity across quick-filter chips)', () => {
        it('destructures an optional icon as a component reference (`icon: Icon`)', () => {
            expect(src).toContain('icon: Icon');
        });

        it('renders the icon conditionally, only when provided', () => {
            expect(src).toMatch(/\{Icon\s*&&\s*\(/);
        });

        it('renders the icon inside a dedicated wrapper span marked aria-hidden', () => {
            expect(src).toContain('filter-chips__chip-icon');
            expect(src).toMatch(/filter-chips__chip-icon[\s\S]*?aria-hidden="true"/);
        });

        it('renders the icon at 14px, matching the destinos attraction-filter chip icon size', () => {
            expect(src).toMatch(/<Icon\s+size=\{14\}/);
        });

        it('adds a gap between icon and label on the chip (no gap regression when icon is absent)', () => {
            expect(src).toMatch(/\.filter-chips__chip\s*\{[^}]*gap:\s*0\.375rem/);
        });

        it('imports ComponentType and IconProps for the icon prop type', () => {
            expect(src).toContain("import type { ComponentType } from 'react'");
            expect(src).toContain("import type { IconProps } from '@repo/icons'");
        });
    });

    describe('HOS-96 T-009 — aria-pressed passthrough (multi-select toggle semantics)', () => {
        it('defines an optional readonly ariaPressed boolean on ChipItem', () => {
            expect(src).toContain('readonly ariaPressed?: boolean');
        });

        it('destructures ariaPressed from each chip when mapping', () => {
            expect(src).toMatch(/chips\.map\(\(\{[^}]*ariaPressed[^}]*\}\)/);
        });

        it('renders aria-pressed="true"/"false" driven by ariaPressed when defined', () => {
            expect(src).toContain(
                "aria-pressed={typeof ariaPressed === 'boolean' ? (ariaPressed ? 'true' : 'false') : undefined}"
            );
        });

        it('omits aria-pressed entirely when ariaPressed is undefined (backward compatible with single-select callers)', () => {
            // The false branch of the ternary must resolve to the `undefined` literal
            // (not the string 'false'), so Astro drops the attribute altogether.
            expect(src).toMatch(/aria-pressed=\{[^}]*:\s*undefined\}/);
        });

        it('keeps aria-current/active class behavior unchanged alongside aria-pressed', () => {
            expect(src).toContain("aria-current={active ? 'true' : undefined}");
            expect(src).toContain('filter-chips__chip--active');
        });
    });

    describe('HOS-97 — href-agnostic canonical component', () => {
        it('does not hardcode any query-param toggle or route-nav logic (caller-resolved hrefs)', () => {
            expect(src).not.toContain('URLSearchParams');
        });

        it('documents itself as the canonical quick-filter chip row', () => {
            expect(src).toContain('canonical');
        });
    });

    describe('HOS-97 (second pass) — desktop scroll buttons ported from ScrollableNav', () => {
        it('defines showScrollButtons as an optional boolean prop, defaulting to false', () => {
            expect(src).toContain('readonly showScrollButtons?: boolean');
            expect(src).toContain('showScrollButtons = false');
        });

        it('defines optional prevLabel/nextLabel props with Anterior/Siguiente defaults', () => {
            expect(src).toContain('readonly prevLabel?: string');
            expect(src).toContain('readonly nextLabel?: string');
            expect(src).toContain("prevLabel = 'Anterior'");
            expect(src).toContain("nextLabel = 'Siguiente'");
        });

        it('renders the arrow buttons conditionally on showScrollButtons (omitted when false)', () => {
            expect(src).toMatch(/\{showScrollButtons\s*&&\s*\(/);
        });

        it('renders a type="button" prev arrow with a tabindex="-1" and an aria-label', () => {
            expect(src).toContain('filter-chips__arrow filter-chips__arrow--prev');
            expect(src).toContain('data-filter-chips-prev');
            expect(src).toContain('aria-label={prevLabel}');
        });

        it('renders a type="button" next arrow with a tabindex="-1" and an aria-label', () => {
            expect(src).toContain('filter-chips__arrow filter-chips__arrow--next');
            expect(src).toContain('data-filter-chips-next');
            expect(src).toContain('aria-label={nextLabel}');
        });

        it('both arrow buttons use type="button" and tabindex="-1" (faithful ScrollableNav port)', () => {
            const buttonOccurrences = src.match(/type="button"/g) ?? [];
            const tabindexOccurrences = src.match(/tabindex="-1"/g) ?? [];
            expect(buttonOccurrences.length).toBe(2);
            expect(tabindexOccurrences.length).toBe(2);
        });

        it('uses the classic ‹ › glyphs, matching ScrollableNav', () => {
            expect(src).toContain('&lsaquo;');
            expect(src).toContain('&rsaquo;');
        });

        it('marks the root with a data-scroll-buttons attribute only when enabled', () => {
            expect(src).toContain("data-scroll-buttons={showScrollButtons ? 'true' : undefined}");
        });

        it('hides arrows on mobile (<768px), matching ScrollableNav', () => {
            expect(src).toMatch(
                /@media \(max-width: 767px\)\s*\{\s*\.filter-chips__arrow\s*\{\s*display:\s*none;/
            );
        });

        it('positions and styles arrows on desktop (>=768px), matching ScrollableNav', () => {
            expect(src).toContain('@media (min-width: 768px)');
            expect(src).toMatch(/\.filter-chips__arrow\s*\{[^}]*position:\s*absolute/);
            expect(src).toMatch(/\.filter-chips__arrow\s*\{[^}]*width:\s*42px/);
            expect(src).toContain('.filter-chips__arrow--prev');
            expect(src).toContain('.filter-chips__arrow--next');
        });

        // HOS-97 owner feedback: no padding gutter is reserved for the arrows
        // (it pushed the first chip out of alignment with the card grid and
        // starved the fade). Instead the arrows float and a wider desktop fade
        // dissolves the chip beneath an arrow into the page background.
        it('reserves NO padding gutter for the arrows (leading chip stays flush with the grid)', () => {
            expect(src).not.toContain(
                ".filter-chips[data-scroll-buttons='true'][data-overflow='true'] .filter-chips__list"
            );
            expect(src).not.toMatch(/padding-inline:\s*calc\(36px/);
        });

        it('widens the edge-fade on desktop when the arrows are shown (FADE_WIDE)', () => {
            expect(src).toContain('FADE_WIDE');
            expect(src).toMatch(/const wideFade\s*=/);
            expect(src).toContain("window.matchMedia('(min-width: 768px)')");
        });

        it('shows an arrow only when there is overflow AND not already at that edge (enable/disable-at-extremes)', () => {
            expect(src).toMatch(
                /\.filter-chips\[data-overflow='true'\]:not\(\[data-scroll-start='true'\]\)\s*\n?\s*\.filter-chips__arrow--prev/
            );
            expect(src).toMatch(
                /\.filter-chips\[data-overflow='true'\]:not\(\[data-scroll-end='true'\]\)\s*\n?\s*\.filter-chips__arrow--next/
            );
        });

        it('wires click handlers to scroll the list by ~70% of the visible width', () => {
            expect(src).toContain('scrollByViewport');
            expect(src).toContain('clientWidth * 0.7');
            expect(src).toContain("behavior: 'smooth'");
            expect(src).toContain('data-filter-chips-prev');
            expect(src).toContain('data-filter-chips-next');
        });

        it('computes data-overflow/data-scroll-start/data-scroll-end on the root for the arrow-visibility CSS', () => {
            expect(src).toContain('container.dataset.overflow');
            expect(src).toContain('container.dataset.scrollStart');
            expect(src).toContain('container.dataset.scrollEnd');
        });
    });
});
