/**
 * GUEST-10 — Mobile floating dock on the accommodation listing and map (HOS-1768).
 *
 * Actors: Anonymous guest on a 390x844 viewport.
 * Tags: @p1 @guest @discovery
 *
 * The jsdom/source tests cannot see computed styles, which is how three
 * regressions shipped: the Lista/Mapa toggle was display:none in the dock, on
 * the map it rendered in page content, the map-cards trigger was hidden, and
 * the scroll-to-top progress ring floated detached in the middle of the strip.
 */

import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

test.describe('GUEST-10: mobile dock @p1 @guest @discovery', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    test('listing: the Lista/Mapa toggle is visible inside the dock', async ({ page }) => {
        await page.goto(`${WEB_URL}/es/alojamientos/`);
        const toggle = page.locator('[data-mobile-dock] .view-toggle--dock');
        await expect(toggle).toBeVisible();
        await expect(toggle.getByRole('tab', { name: 'Mapa' })).toBeVisible();
    });

    test('map: the toggle lives in the dock, not in page content, and the cards trigger shows', async ({
        page
    }) => {
        await page.goto(`${WEB_URL}/es/alojamientos/mapa/`);
        await expect(page.locator('[data-mobile-dock] .view-toggle--dock')).toBeVisible();
        await expect(page.locator('[data-listing-swap="content"] .view-toggle--dock')).toHaveCount(
            0
        );
        await expect(
            page.locator('[data-mobile-dock] [data-mobile-dock-slot="map-cards"] button')
        ).toBeVisible();
    });

    test('scroll-to-top: the progress ring sits inside the button box', async ({ page }) => {
        await page.goto(`${WEB_URL}/es/alojamientos/`);
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const button = page.locator('#scroll-to-top.scroll-to-top--visible');
        await expect(button).toBeVisible();
        const buttonBox = await button.boundingBox();
        const ringBox = await button.locator('.scroll-to-top__ring-svg').boundingBox();
        expect(buttonBox).not.toBeNull();
        expect(ringBox).not.toBeNull();
        if (!buttonBox || !ringBox) return;
        expect(Math.abs(ringBox.x - buttonBox.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(ringBox.y - buttonBox.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(ringBox.width - buttonBox.width)).toBeLessThanOrEqual(1);
    });
});
