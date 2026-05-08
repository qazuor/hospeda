/**
 * @file AccommodationTypeBadge.test.ts
 * @description Source-reading tests for the shared AccommodationTypeBadge —
 * the single source of truth for the accommodation-type pill across the app.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/ui/AccommodationTypeBadge.astro'),
    'utf8'
);

describe('AccommodationTypeBadge.astro', () => {
    describe('imports + helpers', () => {
        it('imports getAccommodationTypeIcon (per-type icon)', () => {
            expect(src).toContain('getAccommodationTypeIcon');
        });

        it('imports getAccommodationTypeLabel (i18n label)', () => {
            expect(src).toContain('getAccommodationTypeLabel');
        });

        it('imports createTranslations from i18n', () => {
            expect(src).toContain('createTranslations');
        });
    });

    describe('props contract', () => {
        it('declares a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('accepts a readonly type prop (string, case-insensitive)', () => {
            expect(src).toContain('readonly type: string');
        });

        it('accepts a readonly locale prop typed as SupportedLocale', () => {
            expect(src).toContain('readonly locale: SupportedLocale');
        });

        it('accepts an optional size prop limited to xs | sm', () => {
            expect(src).toMatch(/readonly size\?:\s*'xs'\s*\|\s*'sm'/);
        });

        it('accepts an optional class prop for ancestor-driven overrides', () => {
            expect(src).toContain('readonly class?:');
        });

        it('accepts an optional href prop (renders as <a> when present)', () => {
            expect(src).toContain('readonly href?: string');
        });
    });

    describe('anchor mode', () => {
        it('renders an <a> element when href is provided', () => {
            expect(src).toMatch(/href \? \(\s*<a/);
        });

        it('renders a <span> when no href is provided', () => {
            expect(src).toMatch(/\) : \(\s*<span/);
        });

        it('adds the interactive modifier class when href is set', () => {
            expect(src).toContain("'acc-type-badge--interactive'");
        });

        it('defines tap-target min-height + hover lift for the anchor variant', () => {
            expect(src).toMatch(/a\.acc-type-badge[\s\S]*?min-height/);
            expect(src).toMatch(/a\.acc-type-badge:hover[\s\S]*?translateY/);
        });

        it('exposes a focus-visible outline for keyboard navigation', () => {
            expect(src).toMatch(/a\.acc-type-badge:focus-visible[\s\S]*?outline/);
        });
    });

    describe('rendering', () => {
        it('renders the leading icon resolved from the type', () => {
            expect(src).toMatch(/<Icon\s+size=\{iconSize\}/);
            expect(src).toContain('weight="bold"');
        });

        it('marks the icon as decorative via aria-hidden', () => {
            expect(src).toMatch(/<Icon[\s\S]*?aria-hidden="true"/);
        });

        it('lowercases the type before resolving icon and label', () => {
            expect(src).toContain('type.toLowerCase()');
        });

        it('renders the base + size classes', () => {
            expect(src).toContain('acc-type-badge');
            expect(src).toContain('acc-type-badge--size-${size}');
        });

        it('uses smaller icon (14px) for the xs density and 16px for sm', () => {
            expect(src).toMatch(/iconSize\s*=\s*size === 'xs' \? 14 : 16/);
        });
    });

    describe('unified colour identity', () => {
        it('uses brand-primary as the badge surface for every type', () => {
            expect(src).toMatch(/background-color:\s*var\(--brand-primary\)/);
        });

        it('uses the primary foreground token for the label colour', () => {
            expect(src).toMatch(/color:\s*var\(--primary-foreground/);
        });

        it('does not import the per-type colour helper anymore', () => {
            expect(src).not.toContain('getAccommodationTypeColorSolid');
        });

        it('does not expose --acc-type-bg / --acc-type-text inline custom properties', () => {
            expect(src).not.toContain('--acc-type-bg:');
            expect(src).not.toContain('--acc-type-text:');
        });
    });

    describe('size variants', () => {
        it('xs variant uses 0.625rem font (listing card density)', () => {
            expect(src).toMatch(/acc-type-badge--size-xs[\s\S]*?--acc-type-font-size:\s*0\.625rem/);
        });

        it('sm variant uses 0.7rem font (detail header density)', () => {
            expect(src).toMatch(/acc-type-badge--size-sm[\s\S]*?--acc-type-font-size:\s*0\.7rem/);
        });
    });

    describe('exposed API for ancestors', () => {
        it('consumes --acc-type-padding from the size variant', () => {
            expect(src).toContain('padding: var(--acc-type-padding)');
        });

        it('consumes --acc-type-font-size from the size variant', () => {
            expect(src).toContain('font-size: var(--acc-type-font-size)');
        });
    });

    describe('a11y / motion', () => {
        it('disables transitions under prefers-reduced-motion', () => {
            expect(src).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?transition:\s*none/);
        });
    });
});
