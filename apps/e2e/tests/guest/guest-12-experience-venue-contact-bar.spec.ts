/**
 * GUEST-12: mobile contact bar on experience and venue detail pages at 390x844
 * (HOS-2532, spec HOS-2520 section 10: AC-2.8, AC-2.9, AC-2.10).
 * Preconditions: the E2E suite seed includes the published venues
 * `la-parrilla-del-puerto` (menuUrl + Instagram/Facebook) and
 * `cafe-del-palacio-colon` (no menuUrl, Instagram/Facebook), and the published
 * experience `excursion-rio-uruguay-concepcion` (priceFrom, no contactInfo).
 * No seeded venue carries a WhatsApp number, and no seeded experience
 * carries public contact channels. Uses HOSPEDA_E2E_WEB_URL or the default E2E
 * web port. Actor: anonymous guest. Read-only: nothing is created, so there is
 * nothing to clean up.
 *
 * Not covered for lack of a seeded fixture (no data is invented in the DB):
 * an experience WITH public channels (price on the bar, Call/Email/Web panel),
 * and a venue with neither menuUrl nor socials (no bar). Those stay covered by
 * the unit tests of `listing-channels.ts` and `ListingChannelsPanel`.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const VENUE_WITH_MENU = {
    slug: 'la-parrilla-del-puerto',
    menuUrl: 'https://laparrilladelpu.com.ar/menu'
};
const VENUE_WITHOUT_MENU = {
    slug: 'cafe-del-palacio-colon',
    instagram: 'https://instagram.com/cafedelpalacio_colon',
    facebook: 'https://facebook.com/cafedelpalaciocolon'
};
const EXPERIENCE_WITHOUT_CHANNELS = 'excursion-rio-uruguay-concepcion';
const DOCK_SLOT = '[data-mobile-dock] [data-mobile-dock-slot="contact"]';
const CONTACT_BAR = `${DOCK_SLOT} [data-dock-item]`;
const WHATSAPP_LINK =
    'a[href*="wa.me"], a[href*="whatsapp.com"], a[data-interaction-kind="WHATSAPP_CLICK"]';

const venueUrl = ({ slug }: { readonly slug: string }) => `${WEB_URL}/es/comer-y-salir/${slug}/`;
const experienceUrl = ({ slug }: { readonly slug: string }) =>
    `${WEB_URL}/es/experiencias/${slug}/`;

/**
 * Asserts that no WhatsApp contact is reachable from the listing: its content,
 * the dock bar or an open panel. The site footer is out of scope on purpose: it
 * carries Hospeda's own WhatsApp link on every page, which is not a contact
 * channel of the listing.
 */
async function expectNoWhatsApp({ page }: { readonly page: Page }) {
    for (const scope of ['main', '[data-mobile-dock]', '[role="dialog"]']) {
        await expect(page.locator(scope).locator(WHATSAPP_LINK)).toHaveCount(0);
    }
    await expect(page.locator(CONTACT_BAR).getByRole('link', { name: /whatsapp/i })).toHaveCount(0);
}

test.describe('GUEST-12: experience and venue contact bar @p1 @guest @discovery @messaging', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('AC-2.9: a venue with menuUrl shows "Ver carta" as an outbound link, no price, no WhatsApp', async ({
        page
    }) => {
        await page.goto(venueUrl(VENUE_WITH_MENU), { waitUntil: 'domcontentloaded' });

        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport({ timeout: 15_000 });
        const menu = bar.getByRole('link', { name: 'Ver carta', exact: true });
        await expect(menu).toBeVisible();
        await expect(menu).toHaveAttribute('href', VENUE_WITH_MENU.menuUrl);
        await expect(menu).toHaveAttribute('target', '_blank');
        await expect(menu).toHaveAttribute('data-contact-channel', 'menu');
        await expect(menu).toHaveAttribute('data-vertical', 'venue');
        await expect(menu).toHaveAttribute('data-contact-origin', 'bar');
        // Venues have no price: the bar holds the menu link and nothing else.
        await expect(bar.locator('p')).toHaveCount(0);
        await expect(bar.getByRole('link', { name: 'Contactar', exact: true })).toHaveCount(0);
        await expectNoWhatsApp({ page });
    });

    test('AC-2.9: a venue without menuUrl shows "Contactar", which opens a panel with its social links', async ({
        page
    }) => {
        await page.goto(venueUrl(VENUE_WITHOUT_MENU), { waitUntil: 'domcontentloaded' });

        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport({ timeout: 15_000 });
        await expect(bar.getByRole('link', { name: 'Ver carta', exact: true })).toHaveCount(0);
        await expect(bar.locator('p')).toHaveCount(0);
        const trigger = bar.getByRole('link', { name: 'Contactar', exact: true });
        const panel = page.getByRole('dialog', { name: 'Contactar', exact: true });
        // The link jumps to the in-page contact block until the island is ready.
        await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog', { timeout: 15_000 });
        await trigger.tap();

        await expect(panel).toBeVisible();
        for (const [name, href] of [
            ['Instagram', VENUE_WITHOUT_MENU.instagram],
            ['Facebook', VENUE_WITHOUT_MENU.facebook]
        ] as const) {
            const link = panel.getByRole('link', { name });
            await expect(link).toHaveAttribute('href', href);
            await expect(link).toHaveAttribute('data-contact-channel', 'social');
            await expect(link).toHaveAttribute('data-vertical', 'venue');
            await expect(link).toHaveAttribute('data-contact-origin', 'panel');
        }
        await expect(panel.locator(WHATSAPP_LINK)).toHaveCount(0);
        await expectNoWhatsApp({ page });

        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
    });

    test('AC-2.8: an experience with no public channel renders no contact bar and no panel', async ({
        page
    }) => {
        await page.goto(experienceUrl({ slug: EXPERIENCE_WITHOUT_CHANNELS }), {
            waitUntil: 'domcontentloaded'
        });

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
        // Let the idle islands hydrate before asserting an absence.
        await page.waitForLoadState('load');
        await expect(page.locator(CONTACT_BAR)).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Contactar', exact: true })).toHaveCount(0);
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('AC-2.10: neither an experience nor a venue page carries a WhatsApp element', async ({
        page
    }) => {
        for (const url of [
            experienceUrl({ slug: EXPERIENCE_WITHOUT_CHANNELS }),
            venueUrl(VENUE_WITH_MENU),
            venueUrl(VENUE_WITHOUT_MENU)
        ]) {
            await test.step(`No WhatsApp on ${new URL(url).pathname}`, async () => {
                await page.goto(url, { waitUntil: 'load' });
                await expect(page.getByRole('heading', { level: 1 })).toBeVisible({
                    timeout: 15_000
                });
                await expectNoWhatsApp({ page });
                await expect(page.getByRole('button', { name: /whatsapp/i })).toHaveCount(0);
            });
        }
    });
});
