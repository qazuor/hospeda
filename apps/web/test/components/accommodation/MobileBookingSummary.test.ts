import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(__dirname, '../../../src', path), 'utf8');

describe('MobileBookingSummary', () => {
    it('places the mobile alert inside the price summary, after its price and actions', () => {
        const page = source('pages/[lang]/alojamientos/[slug].astro');
        expect(page).toMatch(
            /<MobileBookingSummary\b[\s\S]*?>\s*<ListingPriceAlert\b[^>]*placement="summary"[^>]*\/>\s*<\/MobileBookingSummary>/
        );
        const summary = source('components/accommodation/MobileBookingSummary.astro');
        expect(summary).toMatch(/<MobileBookingSummaryActions\b[^>]*\/>\s*<slot \/>/);
        const alert = source('components/accommodation/ListingPriceAlert.astro');
        expect(alert).toContain(
            "placement === 'summary' ? '(max-width: 1024px)' : '(min-width: 1025px)'"
        );
        expect(alert).toContain('.listing-price-alert--sidebar { display: none; }');
    });

    it('keeps the price CTA in a session-blind Astro card with client-side conversation lookup', () => {
        const sidebar = source('components/accommodation/PricingSidebar.astro');
        expect(sidebar).toContain('consultContext');
        expect(sidebar).toContain('<ConversationCta client:idle accommodationId={accommodationId}');
        expect(sidebar).not.toMatch(/Astro\.locals|\/protected\//);
    });
    it('server renders the price and stay lengths before hydrating the actions', () => {
        const summary = source('components/accommodation/MobileBookingSummary.astro');

        expect(summary).toContain('getListingContactPrice({ price, locale })');
        expect(summary).toContain('minNightsFact');
        expect(summary).toContain('maxNightsFact');
        expect(summary).toContain(
            '<MobileBookingSummaryActions client:media="(max-width: 1024px)"'
        );
        expect(summary).not.toMatch(/Astro\.locals|\/protected\//);
    });

    it('carries no host presentation: HostSection is the only one on the accommodation page', () => {
        const page = source('pages/[lang]/alojamientos/[slug].astro');
        const summary = source('components/accommodation/MobileBookingSummary.astro');
        const summaryTag = page.match(/<MobileBookingSummary\b[^>]*>/)?.[0] ?? '';

        expect(summaryTag).not.toMatch(/\bowner/);
        expect(summary).not.toMatch(/owner|avatar|hostSince|formatHostSince/);
        expect(page).toContain('<HostSection');
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

    it('mounts the summary immediately after QuickFacts and preserves the contact and reviews cards in the sidebar', () => {
        const page = source('pages/[lang]/alojamientos/[slug].astro');
        const sidebar = page.match(/<Fragment slot="sidebar">([\s\S]*?)<\/Fragment>/)?.[1];

        expect(page).toMatch(/<QuickFacts[^>]*\/>\s*<MobileBookingSummary\b/);
        expect(page.indexOf('<MobileBookingSummary')).toBeLessThan(
            page.indexOf('<RelatedCarousel')
        );
        for (const element of [
            'PricingSidebar',
            'ContactCard',
            'ListingContactCard',
            'ReviewSidebarCard'
        ]) {
            expect(sidebar).toContain(`<${element}`);
        }
    });
});
