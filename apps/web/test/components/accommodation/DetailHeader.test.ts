/**
 * @file DetailHeader.test.ts
 * @description Source-reading tests for DetailHeader.astro after the Badge
 * migration (Phase 2). Asserts that the inline `<span>` badges have been
 * replaced by the shared Badge primitive, per-type colors via
 * `getAccommodationTypeColor`, and status colors via `getBadgeStatusColor`.
 * The `.detail-header__type-badge` / `.detail-header__status-badge` CSS rules
 * must still exist so compact-mode overrides keep working.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/accommodation/DetailHeader.astro'),
    'utf8'
);

describe('DetailHeader.astro — Badge migration', () => {
    describe('imports', () => {
        it('imports Badge from Badge.astro', () => {
            expect(src).toContain("from '@/components/shared/ui/Badge.astro'");
        });

        it('imports getAccommodationTypeColor and getBadgeStatusColor', () => {
            expect(src).toContain("from '@/lib/colors'");
            expect(src).toContain('getAccommodationTypeColor');
            expect(src).toContain('getBadgeStatusColor');
        });

        it('still imports getAccommodationTypeLabel for the label', () => {
            expect(src).toContain('getAccommodationTypeLabel');
        });
    });

    describe('badge rendering', () => {
        it('uses the shared Badge primitive', () => {
            expect(src).toContain('<Badge');
        });

        it('does not render a `<span class="detail-header__type-badge">`', () => {
            expect(src).not.toMatch(/<span[^>]*class="detail-header__type-badge"/);
        });

        it('does not render a `<span class="detail-header__status-badge">`', () => {
            expect(src).not.toMatch(/<span[^>]*class="detail-header__status-badge"/);
        });

        it('forwards the class prop to Badge for the type pill', () => {
            expect(src).toContain('class="detail-header__type-badge"');
        });

        it('forwards the class prop to Badge for status pills', () => {
            expect(src).toContain('class="detail-header__status-badge"');
        });
    });

    describe('CSS overrides preserved', () => {
        it('still defines rules for `.detail-header__type-badge`', () => {
            // Preserved for compact-mode and typography overrides, even after
            // the Badge primitive owns the base colors.
            expect(src).toContain('.detail-header__type-badge');
        });

        it('still defines rules for `.detail-header__status-badge`', () => {
            expect(src).toContain('.detail-header__status-badge');
        });

        it('still defines the compact-mode overrides for badges', () => {
            expect(src).toContain('.wave-header--compact');
            expect(src).toMatch(/wave-header--compact[^{]*detail-header__type-badge/);
        });
    });
});
