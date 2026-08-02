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
        // Matched by symbol rather than by the whole import line: the component
        // legitimately imports more than one formatter from this module, and a
        // literal-line assertion breaks on every added import without the
        // delegation itself having changed.
        expect(componentSrc).toMatch(
            /import \{[^}]*\bformatEventDetailDateRange\b[^}]*\} from '@\/lib\/format-utils';/
        );
        expect(componentSrc).toContain(
            'formatEventDetailDateRange({ startDate, endDate, precision, locale })'
        );
    });

    it('also renders a compact date variant for narrow viewports', () => {
        expect(componentSrc).toMatch(
            /import \{[^}]*\bformatEventDetailDateRangeCompact\b[^}]*\} from '@\/lib\/format-utils';/
        );
        expect(componentSrc).toContain('formatEventDetailDateRangeCompact({');
        expect(componentSrc).toContain('dateRangeCompact.label');
    });

    it('ships both date variants and swaps them with CSS, never with JS', () => {
        // The server cannot know the viewport, so both variants must exist in
        // the SSR HTML. Picking one at runtime would leave crawlers and the
        // pre-hydration frame with whichever was the default.
        expect(componentSrc).toContain('event-header__date--long');
        expect(componentSrc).toContain('event-header__date--compact');
        expect(componentSrc).toMatch(/@media \(max-width: 640px\)/);
    });

    it('hides the inactive date variant with display:none so it leaves the a11y tree', () => {
        // `visibility: hidden` or clipping would keep the hidden variant
        // announced by screen readers, so the date would be read twice.
        const compactRule = componentSrc.slice(
            componentSrc.indexOf('.event-header__date--compact {')
        );
        expect(compactRule).toMatch(/^\.event-header__date--compact \{\s*display: none;/);
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
