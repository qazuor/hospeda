import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectCardPhotoBadge } from '@/components/shared/cards/utils/card-photo-badge';
import { formatEventDate } from '@/components/shared/cards/utils/formatEventDate';
import { formatEventLocation } from '@/components/shared/cards/utils/formatEventLocation';
import { toEventCardProps } from '@/lib/api/transforms';
import { resolvePaidBenefit } from '@/lib/billing/plan-badge';

const source = (path: string) => readFileSync(`src/components/${path}`, 'utf8');

describe('HOS-2649 shared contracts', () => {
    it.each([
        'src/components/shared/favorite/FavoriteButton.client.tsx',
        'src/pages/[lang]/funcionalidades/index.astro',
        'src/pages/[lang]/presentacion/comer-y-salir/index.astro',
        'src/lib/features-content.ts',
        'src/lib/features-plan-tables.ts',
        'src/components/shared/favorite/use-favorite-toggle.ts',
        'src/pages/[lang]/funcionalidades/features-shell.css',
        'src/pages/[lang]/funcionalidades/features-sections.css'
    ])('keeps %s within the 500-line cap', (path) => {
        const file = readFileSync(path, 'utf8');

        expect(file.replace(/\r?\n$/, '').split('\n').length).toBeLessThanOrEqual(500);
    });
    it('prioritizes featured over new and expires the new badge at 30 days', () => {
        const createdAt = '2026-11-01T00:00:00Z';
        const now = Date.parse('2026-11-15T00:00:00Z');

        expect(selectCardPhotoBadge({ isFeatured: true, createdAt, now })).toBe('featured');
        expect(selectCardPhotoBadge({ createdAt, now })).toBe('new');
        expect(
            selectCardPhotoBadge({ createdAt, now: Date.parse('2026-12-01T00:00:00Z') })
        ).toBeNull();
    });
    it('uses a renamed catalog plan only for benefits above the floor', () => {
        const plans = [{ name: 'Renamed tier', entitlements: ['compare', 'basic'] }];
        const floor = { name: 'Floor', entitlements: ['basic'] };

        expect(resolvePaidBenefit({ floor, plans, entitlement: 'compare' })).toBe('Renamed tier');
        expect(resolvePaidBenefit({ floor, plans, entitlement: 'basic' })).toBeNull();
        expect(resolvePaidBenefit({ plans, entitlement: 'compare' })).toBeNull();
    });

    it('guards components and pages against hardcoded or locale-driven plan badges', () => {
        for (const root of ['src/components', 'src/pages']) {
            const paths = readdirSync(root, { recursive: true, encoding: 'utf8' });
            for (const path of paths.filter((path) => /\.(astro|tsx)$/.test(path))) {
                const markup = readFileSync(`${root}/${path}`, 'utf8');
                expect(markup, path).not.toMatch(
                    /common\.promotions\.(vipBadge|badges\.vip|lockedVipName)|features\.viajeros\.table\.plans\.(vip|plus)|>\s*VIP\s*<|["']VIP["']/
                );
                expect(markup, path).not.toMatch(/<(?:h\d|p)>[^\n]*\bturista VIP\b/i);
            }
        }
    });

    it('routes inherited pricing and the public features table through catalog labels', () => {
        const features = readFileSync('src/pages/[lang]/funcionalidades/index.astro', 'utf8');
        expect(features).toContain('paidTouristLabel');
        expect(source('billing/PlanComparisonTable.astro')).toContain('getPlanName({ plan, t })');
        expect(source('billing/pricing-card-view.ts')).toContain('touristVipBenefits.badgeName');
        expect(features).not.toMatch(/features\.viajeros\.table\.plans\.plus/);
    });

    it('uses any paid entitlement delta to name generic tourist plan surfaces', () => {
        const features = readFileSync('src/pages/[lang]/funcionalidades/index.astro', 'utf8');
        const offer = source('presentacion/InheritedTravelerOffer.astro');

        expect(features).toMatch(
            /paidTouristLabel\s*=\s*resolveTouristVipBenefitKeys\([^;]+\?\.badgeName/
        );
        expect(offer).toMatch(/plan\s*=\s*\(await fetchTouristVipBenefitKeys\(\)\)\?\.badgeName/);
    });

    it.each([
        'listing/header/ListingHeaderActions.astro',
        'listing/contact/ListingActionBarButtons.tsx'
    ])('shows favorite usage at the detail mount in %s', (path) => {
        expect(source(path)).toMatch(/<FavoriteButton\b(?:(?!\/>)[\s\S])*\bshowUsage\s/);
    });

    it('gives metadata disclosures a 44px touch target on both axes', () => {
        const trigger = source('shared/cards/CardTooltip.astro').match(
            /\.card-tooltip-trigger\s*\{[^}]*\}/
        )?.[0];

        expect(trigger).toContain('min-inline-size: var(--control-h-lg)');
        expect(trigger).toContain('min-block-size: var(--control-h-lg)');
    });

    it.each([
        'shared/cards/AccommodationCard',
        'venue/VenueCard',
        'shared/cards/EventCardHorizontal',
        'shared/cards/EventCardFeatured'
    ])('keeps %s and its scoped stylesheet within the 500-line limit', (path) => {
        const template = source(`${path}.astro`);
        expect(template.trimEnd().split('\n').length).toBeLessThanOrEqual(500);
        expect(template).toMatch(/<style>\s*@import /);
        expect(source(`${path}.css`).trimEnd().split('\n').length).toBeLessThanOrEqual(500);
    });

    it('uses metadata tooltip triggers outside the card links', () => {
        for (const path of ['shared/cards/AccommodationCard.astro', 'venue/VenueCard.astro']) {
            const card = source(path);
            expect(card).not.toMatch(
                /<a\b[^>]*>[\s\S]*?<(CardPromotionPills|CardTooltip)\b[\s\S]*?<\/a>/
            );
        }
        const tooltip = source('shared/cards/CardTooltip.astro');
        expect(tooltip).toContain('aria-describedby');
        expect(tooltip).toContain('popovertarget');
        expect(source('shared/cards/AccommodationCard.astro')).toMatch(/<CardTooltip[^>]*photos/);
    });

    it('reserves a separate narrow row for locality and wraps long catalog pill labels', () => {
        const venue = source('venue/VenueCard.css');
        expect(venue).toMatch(
            /@media \(max-width: 390px\)[\s\S]*?category-row\s*\{[^}]*flex-wrap: wrap/
        );
        expect(venue).toMatch(
            /@media \(max-width: 390px\)[\s\S]*?location-bar\s*\{[^}]*flex-basis: 100%/
        );
        expect(source('shared/cards/CardPromotionPills.astro')).toContain(
            'overflow-wrap: anywhere'
        );
    });

    it('removes the superseded card CSS and keeps the desktop menu within 500 lines', () => {
        expect(source('shared/cards/AccommodationCard.css')).not.toMatch(
            /\.acc-card__(photo-count|price-row|cta-btn)\b/
        );
        expect(
            source('shared/navigation/UserMenu.client.tsx').trimEnd().split('\n').length
        ).toBeLessThanOrEqual(500);
    });

    it.each([
        [{ name: 'Predio', city: ' ' }, 'Predio'],
        [{ city: 'Concordia' }, 'Concordia'],
        [{ name: 'Federación', city: ' federacion ' }, 'Federación'],
        [{ name: 'Basílica', city: 'Concordia' }, 'Basílica, Concordia'],
        [{}, '']
    ])('formats %j without empty or redundant locality', (input, label) => {
        expect(formatEventLocation(input)).toBe(label);
    });

    it('hides the stored time of the audited all-day event, not the time of a scheduled event', () => {
        const start = '2026-12-08T00:00:00-03:00';
        const { date } = toEventCardProps({
            item: { id: 'event', date: { start, isAllDay: true } }
        });

        const allDay = formatEventDate({ ...date, locale: 'es', mode: 'compact' });
        const timed = formatEventDate({
            start: '2026-12-08T18:00:00-03:00',
            locale: 'es',
            mode: 'compact'
        });

        expect(date.isAllDay).toBe(true);
        expect(allDay).toMatchObject({ timeLine: null });
        expect(timed).not.toMatchObject({ timeLine: null });
    });

    it('keeps account-specific plan data in the two menu islands', () => {
        const desktop = source('shared/navigation/UserMenu.client.tsx');
        const mobile = source('shared/navigation/MobileMenuAccountSection.client.tsx');

        for (const menu of [desktop, mobile]) {
            expect(menu).toContain('useTouristMenuPlan({ account: user?');
            expect(menu).toContain('<PlanBadge name={plan?.paid ? plan.name : null}');
        }
    });

    it('keeps the horizontal event link without an overlapping CTA', () => {
        const card = source('shared/cards/EventCardHorizontal.astro');

        expect(card).toContain('href={detailUrl}');
        expect(card).not.toContain('class="event-card-h__cta"');
        expect(card).toContain('style={dateBlockStyle}');
    });

    it('constrains the event location pill so its label can ellipsize', () => {
        const card = source('shared/cards/EventCardHorizontal.css');
        const pill = card.match(/\.event-card-h__location\s*\{[^}]*\}/)?.[0];
        const label = card.match(/\.event-card-h__location-label\s*\{[^}]*\}/)?.[0];

        expect(pill).toContain('max-width: 100%');
        expect(pill).toContain('min-width: 0');
        expect(label).toContain('text-overflow: ellipsis');
        expect(label).toContain('white-space: nowrap');
        expect(label).toContain('overflow: hidden');
    });
});
