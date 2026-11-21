import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SupportedLocale } from '@/lib/i18n';
import { formatHostSince } from '@/lib/listing-contact/format-host-since';

const source = (path: string) => readFileSync(resolve(__dirname, '../../../src', path), 'utf8');

describe('MobileBookingSummary', () => {
    it('server renders the price, stay lengths and public host before hydrating the actions', () => {
        const summary = source('components/accommodation/MobileBookingSummary.astro');

        expect(summary).toContain('getListingContactPrice({ price, locale })');
        expect(summary).toContain('minNightsFact');
        expect(summary).toContain('maxNightsFact');
        expect(summary).toContain('{owner.name}');
        expect(summary).toContain('src={avatar}');
        expect(summary).toContain('summary.hostSince');
        expect(summary).toContain(
            '<MobileBookingSummaryActions client:media="(max-width: 1024px)"'
        );
        expect(summary).not.toMatch(/Astro\.locals|\/protected\//);
    });

    it('passes the nullable public join date to the summary instead of the legacy owner fallback', () => {
        const page = source('pages/[lang]/alojamientos/[slug].astro');
        const summary = source('components/accommodation/MobileBookingSummary.astro');
        const summaryTag = page.match(/<MobileBookingSummary\b[^>]*\/>/)?.[0];

        expect(summaryTag).toMatch(
            /ownerJoinedAt=\{result\.data\.owner\?\.createdAt\s*\?\?\s*null\}/
        );
        expect(summary).not.toContain('owner.createdAt');
        expect(summary).toContain('formatHostSince({ ownerJoinedAt, locale })');
        expect(summary).toMatch(
            /\{since\s*&&\s*<p>\{t\('accommodations\.detail\.listingContact\.summary\.hostSince'/
        );
    });

    it.each([
        { ownerJoinedAt: null, locale: 'en', expected: null },
        { ownerJoinedAt: 'not a date', locale: 'en', expected: null },
        { ownerJoinedAt: '2021-03-01T00:00:00Z', locale: 'en', expected: 'March 2021' },
        { ownerJoinedAt: new Date('2021-03-01T00:00:00Z'), locale: 'es', expected: 'marzo de 2021' }
    ] satisfies ReadonlyArray<{
        ownerJoinedAt: string | Date | null;
        locale: SupportedLocale;
        expected: string | null;
    }>)('formats the public join date $ownerJoinedAt in $locale', ({
        ownerJoinedAt,
        locale,
        expected
    }) => {
        expect(formatHostSince({ ownerJoinedAt, locale })).toEqual({ since: expected });
    });

    it('swaps just the two price blocks at the one-column breakpoint', () => {
        const summary = source('components/accommodation/MobileBookingSummary.astro');
        const sidebar = source('components/accommodation/PricingSidebar.astro');

        expect(summary).toMatch(/\.booking-summary\s*\{\s*display: none;\s*\}/);
        expect(summary).toMatch(
            /@media \(max-width: 1024px\)\s*\{\s*\.booking-summary\s*\{\s*display: flex;/
        );
        expect(sidebar).toMatch(
            /@media \(max-width: 1024px\)\s*\{\s*\.pricing-sidebar\s*\{\s*display: none;/
        );
    });

    it('mounts the summary immediately after QuickFacts and preserves the host and reviews in the sidebar', () => {
        const page = source('pages/[lang]/alojamientos/[slug].astro');
        const sidebar = page.match(/<Fragment slot="sidebar">([\s\S]*?)<\/Fragment>/)?.[1];

        expect(page).toMatch(/<QuickFacts[^>]*\/>\s*<MobileBookingSummary\b/);
        expect(page.indexOf('<MobileBookingSummary')).toBeLessThan(
            page.indexOf('<RelatedCarousel')
        );
        for (const element of ['PricingSidebar', 'OwnerCard', 'ContactHost', 'ReviewSidebarCard']) {
            expect(sidebar).toContain(`<${element}`);
        }
    });
});
