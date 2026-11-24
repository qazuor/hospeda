/**
 * GUEST-12: mobile contact bar on experience and venue detail pages at 390x844
 * (HOS-2532, spec HOS-2520 section 10: AC-2.8, AC-2.9, AC-2.10), as the
 * icon-only action bar of HOS-2579 §6.10 (AC-28, AC-29, AC-31, AC-32). The bar
 * now renders on every listing page (Favorito and Compartir always exist), its
 * controls are icons named by `aria-label`, so they are selected by role + name,
 * and a venue's WhatsApp reaches the bar itself (PUBLIC: a wa.me link;
 * LOGGED_IN_ONLY: the panel on its WhatsApp row).
 * Preconditions: the E2E suite seed includes the published venues
 * `la-parrilla-del-puerto` (menuUrl + Instagram/Facebook) and
 * `cafe-del-palacio-colon` (no menuUrl, Instagram/Facebook), the published
 * experience `excursion-rio-uruguay-concepcion` (priceFrom, no contactInfo), and
 * the E2E-only listings of `fixtures/listing-contact-fixtures.ts`, inserted by
 * `seeds/e2e-seed.ts` after the base seed (experiences with public channels, and
 * venues without contact, with a public WhatsApp, with a signed-in-only WhatsApp
 * and with an undecided one). Uses HOSPEDA_E2E_WEB_URL or the default E2E web
 * port. Actor: anonymous guest. Read-only: nothing is created, so there is
 * nothing to clean up.
 *
 * The venue WhatsApp is gated by the OWNER's visibility choice (HOS-2256), not
 * by a plan entitlement, so the cases need no subscription fixtures.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import {
    FIXTURE_EXPERIENCE_CONTACT,
    LISTING_CONTACT_FIXTURE_SLUGS as FIXTURES
} from '../../fixtures/listing-contact-fixtures.ts';

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
/** The fixture WhatsApp number as digits only, as it appears in a wa.me link. */
const WA_DIGITS = '5493442555000';
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

/** The bar of a listing with nothing to contact: Favorito and Compartir only (HOS-2579 AC-31). */
async function expectBareBar({ page }: { readonly page: Page }) {
    const bar = page.locator(CONTACT_BAR);
    await expect(bar).toBeInViewport({ timeout: 15_000 });
    await expect(bar.locator('[data-action]')).toHaveCount(2);
    await expect(bar.locator('[data-action="favorite"]')).toHaveCount(1);
    await expect(bar.getByRole('button', { name: 'Compartir', exact: true })).toBeVisible();
    await expect(bar.getByRole('link', { name: 'Consultar', exact: true })).toHaveCount(0);
    await expect(bar.getByRole('link', { name: 'Llamar', exact: true })).toHaveCount(0);
    await expect(bar.locator('[disabled], [aria-disabled="true"]')).toHaveCount(0);
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
        await expect(bar.getByRole('link', { name: 'Consultar', exact: true })).toHaveCount(0);
        // AC-32: «Ver carta» is position 1 and primary.
        await expect(bar.locator('[data-action]').first()).toHaveAttribute(
            'data-action',
            'primary'
        );
        await expect(menu).toHaveClass(/btn-gradient--accent/);
        await expectNoWhatsApp({ page });
    });

    test('AC-2.9: a venue without menuUrl shows "Consultar", which opens a panel with its social links', async ({
        page
    }) => {
        await page.goto(venueUrl(VENUE_WITHOUT_MENU), { waitUntil: 'domcontentloaded' });

        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport({ timeout: 15_000 });
        await expect(bar.getByRole('link', { name: 'Ver carta', exact: true })).toHaveCount(0);
        await expect(bar.locator('p')).toHaveCount(0);
        const trigger = bar.getByRole('link', { name: 'Consultar', exact: true });
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

    test('AC-2.8 / AC-31: an experience with no public channel renders a bar with Favorito and Compartir only, and no panel', async ({
        page
    }) => {
        await page.goto(experienceUrl({ slug: EXPERIENCE_WITHOUT_CHANNELS }), {
            waitUntil: 'domcontentloaded'
        });

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
        // Let the idle islands hydrate before asserting an absence.
        await page.waitForLoadState('load');
        await expectBareBar({ page });
        await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('AC-2.8 / AC-28: an experience with public channels shows its price, Llamar and «Consultar», which opens Call / Email / Web', async ({
        page
    }) => {
        await page.goto(experienceUrl({ slug: FIXTURES.experienceWithChannels }), {
            waitUntil: 'domcontentloaded'
        });

        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport({ timeout: 15_000 });
        // 850000 centavos per person: 8.500 pesos, never the raw centavos.
        await expect(bar.locator('p')).toContainText(/8\.500/);
        await expect(bar.locator('p')).toContainText('/persona');
        await expect(bar.locator('p')).not.toContainText('Consultar precio');
        // AC-28: Consultar, Llamar, Favorito, Compartir; never WhatsApp or Comparar.
        await expect(bar.locator('[data-action]')).toHaveCount(4);
        const call = bar.getByRole('link', { name: 'Llamar', exact: true });
        await expect(call).toHaveAttribute('href', 'tel:+5493442555111');
        await expect(call).toHaveAttribute('data-contact-channel', 'phone');
        await expect(call).toHaveAttribute('data-contact-origin', 'bar');
        await expect(bar.locator('[data-action="compare"]')).toHaveCount(0);
        const trigger = bar.getByRole('link', { name: 'Consultar', exact: true });
        const panel = page.getByRole('dialog', { name: 'Contactar', exact: true });
        await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog', { timeout: 15_000 });
        await trigger.tap();

        await expect(panel).toBeVisible();
        const phone = panel.getByRole('link', { name: /Llamar/ });
        await expect(phone).toHaveAttribute('href', 'tel:+5493442555111');
        await expect(phone).toHaveAttribute('data-contact-channel', 'phone');
        const email = panel.getByRole('link', { name: /Email/ });
        await expect(email).toHaveAttribute(
            'href',
            `mailto:${FIXTURE_EXPERIENCE_CONTACT.workEmail}`
        );
        await expect(email).toHaveAttribute('data-contact-channel', 'email');
        const web = panel.getByRole('link', { name: /Web/ });
        await expect(web).toHaveAttribute('href', FIXTURE_EXPERIENCE_CONTACT.website);
        await expect(web).toHaveAttribute('target', '_blank');
        await expect(web).toHaveAttribute('data-contact-channel', 'website');
        for (const link of [phone, email, web]) {
            await expect(link).toHaveAttribute('data-vertical', 'experience');
            await expect(link).toHaveAttribute('data-contact-origin', 'panel');
        }
        await expectNoWhatsApp({ page });

        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(trigger).toBeFocused();
    });

    test('AC-2.8: an experience flagged «a consultar» shows «Consultar precio», never an amount', async ({
        page
    }) => {
        await page.goto(experienceUrl({ slug: FIXTURES.experiencePriceOnRequest }), {
            waitUntil: 'domcontentloaded'
        });

        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport({ timeout: 15_000 });
        await expect(bar.locator('p')).toHaveText(/Consultar precio/);
        await expect(bar.locator('p')).not.toContainText('$');
        await expect(bar.getByRole('link', { name: 'Consultar', exact: true })).toBeVisible();
    });

    test('AC-2.9 / AC-31: a venue with neither menuUrl, socials nor WhatsApp renders a bar with Favorito and Compartir only, and no panel', async ({
        page
    }) => {
        await page.goto(venueUrl({ slug: FIXTURES.venueWithoutContact }), {
            waitUntil: 'domcontentloaded'
        });

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
        await page.waitForLoadState('load');
        await expectBareBar({ page });
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expectNoWhatsApp({ page });
    });

    test('AC-2.10 (HOS-2256) / AC-29: a venue whose owner shares WhatsApp publicly shows it in the bar, the page and the panel', async ({
        page
    }) => {
        await page.goto(venueUrl({ slug: FIXTURES.venueWhatsappPublic }), {
            waitUntil: 'domcontentloaded'
        });

        // WhatsApp alone is enough to make the bar a «Consultar» panel opener.
        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport({ timeout: 15_000 });
        await expect(bar.locator('p')).toHaveCount(0);
        // AC-29: PUBLIC is a direct wa.me anchor in the bar, reported by the delegated listener.
        const barLink = bar.getByRole('link', { name: 'Escribir por WhatsApp', exact: true });
        await expect(barLink).toHaveAttribute('href', new RegExp(`wa\\.me/\\+?${WA_DIGITS}`));
        await expect(barLink).toHaveAttribute('target', '_blank');
        await expect(barLink).toHaveAttribute('data-contact-channel', 'whatsapp');
        await expect(barLink).toHaveAttribute('data-contact-origin', 'bar');
        const trigger = bar.getByRole('link', { name: 'Consultar', exact: true });
        const panel = page.getByRole('dialog', { name: 'Contactar', exact: true });
        await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog', { timeout: 15_000 });

        const pageLink = page.locator('main a[data-interaction-kind="WHATSAPP_CLICK"]');
        await expect(pageLink).toHaveAttribute('href', new RegExp(`wa\\.me/\\+?${WA_DIGITS}`));
        await expect(pageLink).toHaveAttribute('target', '_blank');

        await trigger.tap();
        await expect(panel).toBeVisible();
        const panelLink = panel.locator('a[data-interaction-kind="WHATSAPP_CLICK"]');
        await expect(panelLink).toHaveAttribute('href', new RegExp(`wa\\.me/\\+?${WA_DIGITS}`));
        await expect(panelLink).toHaveAttribute('target', '_blank');
    });

    test('AC-2.10 (HOS-2256) / AC-29: a venue whose owner shares WhatsApp with signed-in visitors only sends a guest to sign in, with no number in the HTML', async ({
        page
    }) => {
        const response = await page.goto(venueUrl({ slug: FIXTURES.venueWhatsappLoggedIn }), {
            waitUntil: 'domcontentloaded'
        });
        const html = (await response?.text()) ?? '';
        // The page is edge-cached and session-blind: the number must never be in it.
        expect(html).not.toContain(WA_DIGITS);

        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport({ timeout: 15_000 });
        const trigger = bar.getByRole('link', { name: 'Consultar', exact: true });
        const panel = page.getByRole('dialog', { name: 'Contactar', exact: true });
        await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog', { timeout: 15_000 });
        // AC-29: the bar's own WhatsApp opens the panel focused on the WhatsApp row.
        const barWhatsapp = bar.getByRole('link', { name: 'Escribir por WhatsApp', exact: true });
        await expect(barWhatsapp).not.toHaveAttribute('href', /wa\.me/);
        await barWhatsapp.tap();

        await expect(panel).toBeVisible();
        const signIn = panel.getByRole('link', {
            name: /Iniciá sesión para escribir por WhatsApp/
        });
        await expect(signIn).toBeVisible();
        await expect(signIn).toBeFocused();
        await expect(signIn).not.toHaveAttribute('data-interaction-kind', 'WHATSAPP_CLICK');
        // The footer carries Hospeda's own WhatsApp link, so scope to the listing.
        await expect(page.locator('main').locator(WHATSAPP_LINK)).toHaveCount(0);
        await expect(panel.locator(WHATSAPP_LINK)).toHaveCount(0);
    });

    test('AC-2.10 (HOS-2256): a venue that stores a number but whose owner never chose a visibility shows no WhatsApp and a bare bar', async ({
        page
    }) => {
        const response = await page.goto(venueUrl({ slug: FIXTURES.venueWhatsappUndecided }), {
            waitUntil: 'domcontentloaded'
        });
        expect((await response?.text()) ?? '').not.toContain(WA_DIGITS);

        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 });
        await page.waitForLoadState('load');
        await expectBareBar({ page });
        await expectNoWhatsApp({ page });
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
