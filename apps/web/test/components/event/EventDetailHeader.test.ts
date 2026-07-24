/**
 * @file EventDetailHeader.test.ts
 * @description Source-content tests for EventDetailHeader.astro's HOS-280
 * month-only precision support. Astro components can't be rendered in
 * Vitest (per apps/web/CLAUDE.md testing strategy), so these assert on the
 * raw source string.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSrc = readFileSync(
    resolve(__dirname, '../../../src/components/event/EventDetailHeader.astro'),
    'utf8'
);

describe('EventDetailHeader.astro — HOS-280 month-only precision', () => {
    it('declares an optional precision prop defaulting to EXACT', () => {
        expect(componentSrc).toContain("readonly precision?: 'EXACT' | 'MONTH';");
        expect(componentSrc).toContain("precision = 'EXACT',");
    });

    it('delegates date-range formatting to formatEventDetailDateRange', () => {
        expect(componentSrc).toContain(
            "import { formatEventDetailDateRange } from '@/lib/format-utils';"
        );
        expect(componentSrc).toContain(
            'formatEventDetailDateRange({ startDate, endDate, precision, locale })'
        );
    });

    it('renders the EXACT date branch using startLabel/endLabel (unchanged shape)', () => {
        expect(componentSrc).toContain("dateRange.precision === 'EXACT'");
        expect(componentSrc).toContain('dateRange.startLabel');
        expect(componentSrc).toContain('dateRange.endLabel');
    });

    it('renders the MONTH date branch using a single label', () => {
        expect(componentSrc).toContain('dateRange.label');
    });

    it('renders an estimated-date badge only for MONTH precision, using the real i18n key', () => {
        expect(componentSrc).toContain("{precision === 'MONTH' && (");
        expect(componentSrc).toContain('event-header__estimated-badge');
        expect(componentSrc).toContain("t('events.detail.monthOnlyBadge'");
    });

    it('does not rely on color alone for the estimated badge (includes translated text)', () => {
        const badgeBlockStart = componentSrc.indexOf("{precision === 'MONTH' && (");
        const badgeBlock = componentSrc.substring(badgeBlockStart, badgeBlockStart + 300);
        expect(badgeBlock).toContain("t('events.detail.monthOnlyBadge'");
    });
});
