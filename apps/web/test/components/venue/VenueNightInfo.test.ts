/**
 * @file VenueNightInfo.test.ts
 * @description Source-read guards for the public `nightInfo` component
 * (HOS-1849 / 4.5, AC:4:4 and AC:4:5).
 *
 * `.astro` components cannot be rendered by this app's Vitest setup (the
 * documented approach is a source read — see `VenueMenu.photo.test.ts` and
 * `VenueCard.test.ts`). The decisions the template makes are exercised for
 * real in `test/lib/venue/night-info.test.ts`; these assertions prove the
 * component actually consumes them instead of re-deriving them, which is where
 * the two regressions this file exists for would hide:
 *
 *  - a fixed title that ignores `multiLine` (DEC-FAC-050), and
 *  - the legal text rendered without its badge, or for an absent `minAge`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/venue/VenueNightInfo.astro'),
    'utf8'
);

describe('VenueNightInfo.astro — rendering gate (AC:4:4)', () => {
    it('renders nothing when no nightInfo field arrived', () => {
        // The section is not `available` when the API removed every field, so
        // the early return is the whole gate.
        expect(src).toContain('if (!nightInfo || !hasNightInfoContent(nightInfo)) return;');
    });

    it('never compares business lines (G-FAC-03)', () => {
        // The frontmatter comment explains WHY it must not; the assertions
        // target code reads, not prose.
        expect(src).not.toContain('.businessLines');
        expect(src).not.toContain('businessLines:');
        expect(src).not.toContain("includes('nightlife')");
    });

    it('uses the catalog heading selected by multiLine, never a literal', () => {
        expect(src).toContain('nightInfoHeadingKey({ multiLine: nightInfo.multiLine })');
        expect(src).toContain('t(nightInfoHeadingKey');
        // The Spanish text lives in the locale file; a `t('De noche')` here
        // would bypass it (and the i18n-key guard).
        expect(src).not.toMatch(/t\(\s*['"]De noche['"]/);
    });
});

describe('VenueNightInfo.astro — entry, price and dress code', () => {
    it('resolves the entryKind labels through t()', () => {
        expect(src).toContain("t('venue.detail.nightInfo.entryKind.free')");
        expect(src).toContain("t('venue.detail.nightInfo.entryKind.paid')");
        expect(src).toContain("t('venue.detail.nightInfo.entryKind.varies')");
    });

    it('formats the price through formatPrice, in the same centavos conversion as the carta', () => {
        expect(src).toContain(
            'formatPrice({ amount: nightInfo.entryPriceFromCents / 100, locale })'
        );
    });

    it('formats the update date through formatMonthYearLabel', () => {
        expect(src).toContain(
            'formatMonthYearLabel({ date: new Date(nightInfo.entryPriceUpdatedAt), locale })'
        );
        expect(src).toContain("t('venue.detail.nightInfo.approxUpdated')");
    });

    it('resolves every approved dress-code label', () => {
        for (const code of ['casual', 'smart_casual', 'elegant', 'no_restrictions']) {
            expect(src).toContain(`t('venue.detail.nightInfo.dressCode.${code}')`);
        }
    });

    it('renders the localized notes the mapper resolved', () => {
        expect(src).toContain('nightInfo.entryNote');
        expect(src).toContain('nightInfo.dressCodeNote');
    });
});

describe('VenueNightInfo.astro — age badge (AC:4:5)', () => {
    it('derives the badge and legal key from the same notice', () => {
        expect(src).toContain('ageNotice({ minAge: nightInfo.minAge })');
        expect(src).toMatch(
            /\{notice && \([\s\S]*?notice\.badge[\s\S]*?t\(notice\.legalTextKey\)[\s\S]*?\)\}/
        );
    });

    it('renders the legal text as visible content, not as a title or tooltip', () => {
        expect(src).toContain(
            '<span class="venue-night-info__legal">{t(notice.legalTextKey)}</span>'
        );
        expect(src).not.toMatch(/\btitle=\{[^}]*legal/i);
        expect(src).not.toMatch(/\baria-label=\{[^}]*legal/i);
    });
});

describe('VenueNightInfo.astro — styling', () => {
    it('uses a scoped style block with design tokens', () => {
        expect(src).toContain('<style>');
        expect(src).toContain('var(--core-card)');
        expect(src).toContain('var(--core-foreground)');
        expect(src).toContain('var(--brand-accent)');
    });

    it('does not use Tailwind utilities or inline styles', () => {
        expect(src).not.toMatch(/class="[^"]*\b(bg-|text-|p-|m-|flex-|grid-)\w/);
        expect(src).not.toMatch(/\bstyle="/);
    });
});
