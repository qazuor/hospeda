/**
 * @file DetailHeader.test.ts
 * @description Source-reading tests for DetailHeader.astro after the
 * AccommodationTypeBadge unification. The detail header delegates the type
 * pill to the shared `AccommodationTypeBadge` component (single source of
 * truth for type colour + label) while keeping the generic `Badge` primitive
 * for status pills (featured/new). Compact-mode overrides reach into the
 * type badge through the `--acc-type-*` custom properties exposed by it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/DetailHeader.astro'),
    'utf8'
);

describe('DetailHeader.astro — type badge unification', () => {
    describe('imports', () => {
        it('imports AccommodationTypeBadge from shared/ui', () => {
            expect(src).toContain("from '@/components/shared/ui/AccommodationTypeBadge.astro'");
        });

        it('imports the generic Badge for status pills', () => {
            expect(src).toContain("from '@/components/shared/ui/Badge.astro'");
        });

        it('imports getBadgeStatusColor from @/lib/colors', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getBadgeStatusColor');
        });

        it('no longer imports getAccommodationTypeColor or its solid variant', () => {
            expect(src).not.toContain('getAccommodationTypeColor');
            expect(src).not.toContain('getAccommodationTypeColorSolid');
        });

        it('no longer imports getAccommodationTypeLabel (moved into the badge)', () => {
            expect(src).not.toContain('getAccommodationTypeLabel');
        });
    });

    describe('badge rendering', () => {
        it('renders the shared AccommodationTypeBadge for the type pill', () => {
            expect(src).toMatch(/<AccommodationTypeBadge[^>]*type=\{accommodation\.type\}/);
        });

        it('forwards size="sm" to the type badge', () => {
            expect(src).toMatch(/<AccommodationTypeBadge[\s\S]*?size="sm"/);
        });

        it('forwards class="detail-header__type-badge" so compact mode can target it', () => {
            expect(src).toMatch(/<AccommodationTypeBadge[\s\S]*?class="detail-header__type-badge"/);
        });

        it('still uses the generic Badge primitive for status pills', () => {
            expect(src).toContain('<Badge');
            expect(src).toContain('class="detail-header__status-badge"');
        });

        it('does not render an inline `<span class="detail-header__type-badge">`', () => {
            expect(src).not.toMatch(/<span[^>]*class="detail-header__type-badge"/);
        });
    });

    describe('CSS overrides preserved', () => {
        it('still defines compact-mode rules for the status pills', () => {
            expect(src).toMatch(/wave-header--compact[\s\S]*?detail-header__status-badge/);
        });

        it('compact mode overrides the type badge via custom properties (no !important)', () => {
            expect(src).toMatch(
                /wave-header--compact[\s\S]*?detail-header__type-badge[\s\S]*?--acc-type-font-size/
            );
            expect(src).toMatch(
                /wave-header--compact[\s\S]*?detail-header__type-badge[\s\S]*?--acc-type-padding/
            );
            expect(src).not.toMatch(/--acc-type-font-size:[^;]*!important/);
        });
    });
});
