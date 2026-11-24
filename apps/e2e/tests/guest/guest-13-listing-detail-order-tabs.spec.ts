/**
 * GUEST-13 (order and tabs): the three listing detail pages follow the 13-slot
 * section order and carry the sticky section tabs (HOS-2579 §6.1, §6.2:
 * AC-2b, AC-4, AC-6, AC-7, AC-25).
 *
 * Preconditions: the E2E suite seed includes the published accommodation
 * `paraiso-calido-country-house-colon`, the published venue
 * `la-parrilla-del-puerto` (opening hours, menuUrl, socials, FAQs) and the
 * E2E-only experience `e2e-experiencia-con-canales` of
 * `fixtures/listing-contact-fixtures.ts` (phone, email and web, so slot 10
 * renders), plus the E2E-only venue `e2e-venue-con-horarios-y-carta` (spec §11
 * `venueWithHoursAndMenu`: opening hours, a carta and a weekly agenda event),
 * which the AC-2b and «Lo que ofrece» / «Horarios» cases assert against
 * unconditionally. Uses HOSPEDA_E2E_WEB_URL or the default E2E web port.
 * Actor: anonymous guest. Read-only: nothing is created, so there is nothing to
 * clean up.
 *
 * What it cannot see: the slot of a venue block the fixtures do not carry
 * (daily specials, night info). Those are pinned by the unit tests of
 * `venue-detail-sections.ts` (AC-2, AC-2b).
 *
 * The width and tap-target cases of the mobile action bar (AC-33, AC-34) are
 * HOS-2579 PR 4's and live with that work.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { LISTING_CONTACT_FIXTURE_SLUGS as FIXTURES } from '../../fixtures/listing-contact-fixtures.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';

/** Canonical slot order (`LISTING_DETAIL_SLOTS`, apps/web). Kept literal: E2E does not import app code. */
const SLOT_ORDER = [
    'galleryHeader',
    'summary',
    'description',
    'offers',
    'hours',
    'promotions',
    'location',
    'reviews',
    'host',
    'contact',
    'policies',
    'faq',
    'related'
] as const;

/** The venue agenda (`VenueEvents`) and its CTA (`VenueEventsCta`). */
const AGENDA = '#venue-venue-events, .venue-events-cta';

/** The venue with hours, carta and agenda (`venueWithHoursAndMenu`). */
const VENUE_WITH_HOURS_AND_MENU = {
    url: `${WEB_URL}/es/comer-y-salir/${FIXTURES.venueWithHoursAndMenu}/`,
    navName: 'Secciones del comercio'
} as const;

const PAGES = [
    {
        vertical: 'accommodation',
        url: `${WEB_URL}/es/alojamientos/paraiso-calido-country-house-colon/`,
        navName: 'Secciones del alojamiento',
        required: ['location', 'reviews']
    },
    {
        vertical: 'venue',
        url: `${WEB_URL}/es/comer-y-salir/la-parrilla-del-puerto/`,
        navName: 'Secciones del comercio',
        required: ['location', 'reviews', 'contact', 'faq']
    },
    {
        vertical: 'experience',
        url: `${WEB_URL}/es/experiencias/${FIXTURES.experienceWithChannels}/`,
        navName: 'Secciones de la experiencia',
        required: ['reviews', 'contact']
    }
] as const;

/** The `data-listing-slot` names of the displayed slot wrappers, in DOM order. */
async function displayedSlots({ page }: { readonly page: Page }): Promise<readonly string[]> {
    return page
        .locator('[data-listing-slot]')
        .evaluateAll((nodes) =>
            nodes
                .filter((node) => node.getClientRects().length > 0)
                .map((node) => node.getAttribute('data-listing-slot') ?? '')
        );
}

/** True when `a` precedes `b` in document order. */
async function precedes({
    page,
    a,
    b
}: {
    readonly page: Page;
    readonly a: string;
    readonly b: string;
}): Promise<boolean> {
    return page.evaluate(
        ([first, second]) => {
            const left = document.querySelector(first as string);
            const right = document.querySelector(second as string);
            if (!left || !right) return false;
            return Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING);
        },
        [a, b]
    );
}

test.describe('GUEST-13: listing detail order and tabs @p1 @guest @discovery', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    for (const listing of PAGES) {
        test(`AC-4: the ${listing.vertical} page renders its slots in the canonical order`, async ({
            page
        }) => {
            await page.goto(listing.url, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('[data-listing-slot="reviews"]')).toBeAttached({
                timeout: 15_000
            });

            const slots = await displayedSlots({ page });
            const indexes = slots.map((slot) =>
                SLOT_ORDER.indexOf(slot as (typeof SLOT_ORDER)[number])
            );
            expect(
                indexes.every((index) => index >= 0),
                `unknown slot in ${slots.join(', ')}`
            ).toBe(true);
            expect(indexes, `slot order: ${slots.join(' → ')}`).toEqual(
                [...indexes].sort((x, y) => x - y)
            );
            expect(new Set(slots).size).toBe(slots.length);
            for (const slot of listing.required) expect(slots).toContain(slot);

            // location → reviews → contact → faq, for the ones the page renders.
            const chain = [
                '#listing-location',
                '#listing-reviews',
                '#listing-contact',
                '#listing-faq'
            ];
            const present: string[] = [];
            for (const id of chain) {
                if ((await page.locator(id).count()) > 0) present.push(id);
            }
            for (let i = 1; i < present.length; i += 1) {
                expect(
                    await precedes({ page, a: present[i - 1] as string, b: present[i] as string }),
                    `${present[i - 1]} must precede ${present[i]}`
                ).toBe(true);
            }
        });

        test(`AC-25: the ${listing.vertical} page has one <h1> and every slot opens with an <h2>`, async ({
            page
        }) => {
            await page.goto(listing.url, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('[data-listing-slot="reviews"]')).toBeAttached({
                timeout: 15_000
            });

            await expect(page.locator('h1')).toHaveCount(1);
            const firstHeadings = await page.locator('[data-listing-slot]').evaluateAll((slots) =>
                slots.map((slot) => {
                    // Owner-authored markdown inside the description clamp is content,
                    // not page structure: its headings are not the slot's.
                    const heading = [...slot.querySelectorAll('h1, h2, h3, h4, h5, h6')].find(
                        (element) => !element.closest('[data-clamped-body]')
                    );
                    return {
                        slot: slot.getAttribute('data-listing-slot'),
                        tag: heading?.tagName ?? null
                    };
                })
            );
            for (const { slot, tag } of firstHeadings) {
                if (tag !== null) expect(tag, `first heading of slot ${slot}`).toBe('H2');
            }
        });

        test(`AC-6/AC-7: the ${listing.vertical} page mounts the sticky tabs, one per present slot`, async ({
            page
        }) => {
            await page.goto(listing.url, { waitUntil: 'domcontentloaded' });

            const nav = page.getByRole('navigation', { name: listing.navName });
            await expect(nav).toBeAttached({ timeout: 15_000 });
            const hrefs = await nav
                .locator('a[data-tab-id]')
                .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
            expect(hrefs.length).toBeGreaterThan(0);
            // A tab never leads nowhere.
            for (const href of hrefs) {
                await expect(page.locator(href)).toBeAttached();
            }
            // There is never an events tab: the agenda lives in «Lo que ofrece» (D-3).
            await expect(nav.getByRole('link', { name: /eventos|agenda/i })).toHaveCount(0);
        });
    }

    test('AC-25: a venue with no reviews still opens its reviews slot with an <h2> (HOS-2604)', async ({
        page
    }) => {
        // The E2E-only venue is created by the fixtures and has no reviews. Before
        // HOS-2604 the preview returned nothing at 0 reviews and the slot opened
        // with the review form's <h3>.
        await page.goto(VENUE_WITH_HOURS_AND_MENU.url, { waitUntil: 'domcontentloaded' });
        const slot = page.locator('[data-listing-slot="reviews"]');
        await expect(slot).toBeAttached({ timeout: 15_000 });
        const firstHeading = await slot.evaluate(
            (element) => element.querySelector('h1, h2, h3, h4, h5, h6')?.tagName ?? null
        );
        expect(firstHeading).toBe('H2');
    });

    test('AC-6: the venue tabs label slot 4 «Lo que ofrece» and «Horarios» scrolls below the sticky band', async ({
        page
    }) => {
        await page.goto(VENUE_WITH_HOURS_AND_MENU.url, { waitUntil: 'domcontentloaded' });

        const nav = page.getByRole('navigation', { name: VENUE_WITH_HOURS_AND_MENU.navName });
        await expect(nav).toBeVisible({ timeout: 15_000 });
        await expect(nav.getByRole('link', { name: 'Comodidades', exact: true })).toHaveCount(0);
        const offersTab = nav.getByRole('link', { name: 'Lo que ofrece', exact: true });
        await expect(offersTab).toHaveAttribute('href', '#listing-amenities');
        await expect(page.locator('#listing-offers #listing-amenities')).toBeAttached();

        const hoursTab = nav.getByRole('link', { name: 'Horarios', exact: true });
        await expect(hoursTab).toHaveAttribute('href', '#listing-hours');
        // Wait for hydration (Astro drops `ssr` from the island): before it the tab
        // is a plain anchor, which also lands below the band through scroll-margin.
        await expect(
            page.locator('astro-island:has([data-listing-section-tabs])')
        ).not.toHaveAttribute('ssr', /.*/, { timeout: 15_000 });
        await hoursTab.tap();

        await expect
            .poll(
                async () => {
                    const band = await nav.boundingBox();
                    const target = await page.locator('#listing-hours').boundingBox();
                    if (!band || !target) return Number.NaN;
                    return Math.round(target.y - (band.y + band.height));
                },
                { timeout: 10_000 }
            )
            .toBeGreaterThanOrEqual(-1);
        const band = await nav.boundingBox();
        const target = await page.locator('#listing-hours').boundingBox();
        // Right below the band, not somewhere further down the page.
        expect((target?.y ?? 0) - ((band?.y ?? 0) + (band?.height ?? 0))).toBeLessThan(64);

        // The scroll-spy settles once the smooth scroll ends. Park the section
        // under the band explicitly (scroll-margin keeps it below the tabs), so a
        // short hours block cannot hand the band to the next section mid-scroll.
        await page
            .locator('#listing-hours')
            .evaluate((element) => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await expect(hoursTab).toHaveAttribute('aria-current', 'location', { timeout: 10_000 });
    });

    test('AC-2b: the venue agenda renders inside «Lo que ofrece» and nothing of it in slot 6', async ({
        page
    }) => {
        await page.goto(VENUE_WITH_HOURS_AND_MENU.url, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('[data-listing-slot="reviews"]')).toBeAttached({
            timeout: 15_000
        });

        const agenda = page.locator('#venue-venue-events');
        await expect(agenda).toHaveCount(1);
        await expect(agenda).toContainText('Noche de jazz');
        await expect(page.locator('#listing-offers #venue-venue-events')).toHaveCount(1);
        await expect(page.locator('#listing-promotions').locator(AGENDA)).toHaveCount(0);
        // The carta is in the same slot, before the agenda (catalog order 8 < 10).
        await expect(page.locator('#listing-offers #venue-menu')).toHaveCount(1);
        expect(await precedes({ page, a: '#venue-menu', b: '#venue-venue-events' })).toBe(true);
    });
});
