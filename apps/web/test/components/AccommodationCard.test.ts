/**
 * @file AccommodationCard.test.ts
 * @description Source-level tests for AccommodationCard.astro.
 * Astro components cannot be rendered in Vitest; we read the source file and
 * assert on its content — the project's documented approach for .astro coverage.
 *
 * SPEC-157 REQ-9: above-the-fold accommodation cards must support an opt-in
 * `eager` prop that switches `loading` to "eager" and adds `fetchpriority="high"`
 * so the browser prioritises LCP candidate images in the first row.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/components/shared/cards/AccommodationCard.astro'),
    'utf8'
);

describe('AccommodationCard.astro', () => {
    describe('SPEC-157 REQ-9 — eager prop for LCP optimisation', () => {
        it('declares an optional readonly eager prop in the Props interface', () => {
            expect(src).toContain('readonly eager?: boolean');
        });

        it('destructures eager from Astro.props with a false default', () => {
            expect(src).toMatch(/eager\s*=\s*false/);
        });

        it('uses the conditional loading expression on the <Image> branch', () => {
            expect(src).toContain("loading={eager ? 'eager' : 'lazy'}");
        });

        it('sets fetchpriority conditionally on the <Image> branch', () => {
            expect(src).toContain("fetchpriority={eager ? 'high' : undefined}");
        });

        it('uses the conditional loading expression on the plain <img> fallback branch', () => {
            // Both image branches must respect the eager flag — assert the
            // conditional appears at least twice (once per branch).
            const matches = src.match(/loading=\{eager \? 'eager' : 'lazy'\}/g);
            expect(matches).not.toBeNull();
            expect(matches!.length).toBeGreaterThanOrEqual(2);
        });

        it('sets fetchpriority conditionally on the plain <img> fallback branch too', () => {
            const matches = src.match(/fetchpriority=\{eager \? 'high' : undefined\}/g);
            expect(matches).not.toBeNull();
            expect(matches!.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('default behaviour (eager=false)', () => {
        it('does not hardcode loading="lazy" without the conditional', () => {
            // There must be no bare loading="lazy" attribute left — all loading
            // attributes should use the conditional expression.
            expect(src).not.toContain('loading="lazy"');
        });
    });
});
