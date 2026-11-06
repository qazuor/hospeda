import { expect, test } from '@playwright/test';
import { businessLineToUrlSlug, listPublicBusinessLines } from '@repo/schemas';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:4321';

test.describe('AC:6:13 home food-events tile and venue menu collections @p0 @verticals', () => {
    test('links the home tile to its category landing and exposes every collection on desktop and mobile', async ({
        page
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${WEB_URL}/es/`);
        const tileSection = page
            .locator('section')
            .filter({ has: page.locator('a[href*="/eventos/categoria/"]') })
            .first();
        const link = tileSection.locator('a[href*="/eventos/categoria/"]').first();
        await expect(link).toBeVisible();
        const href = await link.getAttribute('href');
        expect(href).toMatch(/^\/es\/eventos\/categoria\/.+\/$/);
        expect((await page.request.get(new URL(href!, WEB_URL).href)).status()).toBe(200);

        const nav = page.locator('header nav').first();
        const venueLink = nav.getByRole('link', { name: 'Comer y salir' });
        await expect(venueLink).toHaveAttribute('href', '/es/comer-y-salir/');
        const regularLink = nav.getByRole('link', { name: 'Alojamientos' });
        const venueTypography = await venueLink.evaluate((element) => {
            const style = getComputedStyle(element);
            return [style.fontWeight, style.fontSize, style.fontFamily];
        });
        const regularTypography = await regularLink.evaluate((element) => {
            const style = getComputedStyle(element);
            return [style.fontWeight, style.fontSize, style.fontFamily];
        });
        expect(venueTypography).toEqual(regularTypography);
        const homeVenueColor = await venueLink.evaluate(
            (element) => getComputedStyle(element).color
        );
        const collectionHrefs = listPublicBusinessLines({ vertical: 'venue' }).map(
            ({ value }) => `/es/comer-y-salir/rubro/${businessLineToUrlSlug({ value }).urlSlug}/`
        );
        for (const href of collectionHrefs) {
            await expect(nav.locator(`a[href="${href}"]`)).toHaveCount(1);
            expect((await page.request.get(new URL(href, WEB_URL).href)).status()).toBe(200);
        }

        const nightSlug = businessLineToUrlSlug({ value: 'nightlife' }).urlSlug;
        await page.goto(`${WEB_URL}/es/comer-y-salir/rubro/${nightSlug}/`);
        await expect(page).toHaveTitle(/^Boliches, bares y pubs en /);
        const activeVenueLink = page
            .locator('header nav')
            .first()
            .getByRole('link', { name: 'Comer y salir' });
        await expect(activeVenueLink).toHaveAttribute('aria-current', 'page');
        const activeVenueColor = await activeVenueLink.evaluate(
            (element) => getComputedStyle(element).color
        );
        expect(activeVenueColor).not.toBe(homeVenueColor);

        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${WEB_URL}/es/`);
        await page.locator('[data-mobile-toggle]').click();
        const mobileMenu = page.locator('nav').last();
        for (const href of collectionHrefs)
            await expect(mobileMenu.locator(`a[href="${href}"]`)).toBeVisible();
    });
});
