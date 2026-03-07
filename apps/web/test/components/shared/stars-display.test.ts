/**
 * @file stars-display.test.ts
 * @description Tests for StarsDisplay.astro component.
 *
 * StarsDisplay renders a row of filled and unfilled star icons using StarIcon
 * from @repo/icons. It accepts a mandatory `count` prop for filled stars, an
 * optional `max` prop for total stars (default 5), and an optional `size` prop
 * for icon size ("sm" = 16px, "md" = 20px).
 *
 * Strategy: read the source file and assert on its textual content, since
 * Astro components cannot be rendered in a Vitest/jsdom environment.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/StarsDisplay.astro');
const src = readFileSync(componentPath, 'utf8');

describe('StarsDisplay.astro', () => {
    describe('Props interface', () => {
        it('should declare a required count prop', () => {
            // count drives how many stars are rendered as filled.
            expect(src).toContain('readonly count: number');
        });

        it('should declare an optional max prop', () => {
            expect(src).toContain('readonly max?: number');
        });

        it('should declare an optional size prop with "sm" | "md" union type', () => {
            expect(src).toContain('readonly size?: "sm" | "md"');
        });

        it('should default max to 5', () => {
            expect(src).toContain('max = 5');
        });

        it('should default size to "sm"', () => {
            expect(src).toContain('size = "sm"');
        });
    });

    describe('Icon import', () => {
        it('should import StarIcon from @repo/icons', () => {
            expect(src).toContain('@repo/icons');
            expect(src).toContain('StarIcon');
        });
    });

    describe('Rendering logic', () => {
        it('should use Array.from to generate the star elements', () => {
            // The component iterates over an array of length `max` to render all stars.
            expect(src).toContain('Array.from');
        });

        it('should pass "fill" weight to filled stars', () => {
            // Stars at index < count must be rendered as filled.
            expect(src).toContain('"fill"');
        });

        it('should pass "duotone" weight to unfilled stars', () => {
            // Stars at index >= count must be rendered as unfilled.
            expect(src).toContain('"duotone"');
        });

        it('should apply text-accent class to filled stars', () => {
            expect(src).toContain('text-accent');
        });

        it('should apply text-muted class to unfilled stars', () => {
            expect(src).toContain('text-muted');
        });

        it('should compare index against count for filled/unfilled split', () => {
            // The conditional expression `i < count` controls which weight is applied.
            expect(src).toContain('i < count');
        });
    });

    describe('Size variant', () => {
        it('should calculate iconSize of 16 for the "sm" variant', () => {
            // sm maps to 16px per the component specification.
            expect(src).toContain('size === "sm" ? 16 : 20');
        });

        it('should use iconSize of 20 for the "md" variant', () => {
            // md is the other branch of the ternary, resulting in 20px.
            expect(src).toContain('20');
        });

        it('should pass iconSize to the StarIcon size prop', () => {
            expect(src).toContain('size={iconSize}');
        });
    });

    describe('Layout', () => {
        it('should wrap stars in a flex container', () => {
            expect(src).toContain('flex');
        });

        it('should apply a small gap between stars', () => {
            expect(src).toContain('gap-0.5');
        });
    });
});
