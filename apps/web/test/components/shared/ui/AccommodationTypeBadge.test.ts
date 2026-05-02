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
        it('imports getAccommodationTypeColorSolid (per-type identity)', () => {
            expect(src).toContain('getAccommodationTypeColorSolid');
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
        it('renders the colour scheme via inline custom properties', () => {
            expect(src).toContain('--acc-type-bg:');
            expect(src).toContain('--acc-type-text:');
        });

        it('lowercases the type before resolving colours', () => {
            expect(src).toContain('type.toLowerCase()');
        });

        it('renders a <span> with the base + size classes', () => {
            expect(src).toContain('acc-type-badge');
            expect(src).toContain('acc-type-badge--size-${size}');
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
