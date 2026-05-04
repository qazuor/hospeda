/**
 * @file SearchContextBanner.test.ts
 * @description Source-level assertions for the SearchContextBanner.astro
 * component. Astro components cannot be rendered in Vitest; following the
 * project pattern we read the source and verify key invariants.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../../src/components/shared/feedback/SearchContextBanner.astro'),
    'utf8'
);

describe('SearchContextBanner.astro', () => {
    it('only renders when at least one context param has a meaningful value', () => {
        // hasContext is wrapped around the <aside>. Treats 0-valued guests as
        // "not supplied" so the banner never opens with empty/inventive content.
        expect(src).toContain('hasContext = Boolean(');
        expect(src).toContain('(adults && adults > 0)');
        expect(src).toContain('(children && children > 0)');
        expect(src).toContain('{hasContext &&');
    });

    it('renders only the parts of the guests label the user explicitly chose', () => {
        // Must NOT invent missing pieces — see the bug where `0 niños` was
        // shown because `children` was undefined. Guards on hasAdults / hasChildren
        // prevent that.
        expect(src).toContain('hasAdults');
        expect(src).toContain('hasChildren');
        expect(src).toContain('guestsAdultsOnly');
        expect(src).toContain('guestsChildrenOnly');
    });

    it('uses the i18n disclaimer key with a Spanish fallback explaining no-bookings policy', () => {
        expect(src).toContain('accommodations.list.searchContext.disclaimer');
        expect(src).toContain('no gestionamos reservas');
    });

    it('renders a chip for the date range when both checkIn and checkOut are present', () => {
        expect(src).toContain('accommodations.list.searchContext.dateRange');
        expect(src).toContain('search-context-banner__chip');
    });

    it('renders the InfoIcon and uses the warm surface token', () => {
        expect(src).toContain('InfoIcon');
        expect(src).toContain('var(--surface-warm)');
    });

    it('uses local-date formatting (UTC noon) to dodge TZ shifts', () => {
        expect(src).toContain('Date.UTC(y, m - 1, d, 12)');
    });
});
