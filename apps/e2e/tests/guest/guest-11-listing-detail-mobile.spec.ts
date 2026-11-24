/**
 * GUEST-11 — Phase 1 accommodation detail at 390×844 (HOS-2526).
 * Preconditions: the E2E suite seed includes Paraíso Cálido (nightly ARS price,
 * multiple approved photos, public phone/email/website) and similar listings in
 * Colón. Uses HOSPEDA_E2E_WEB_URL or the default E2E web port.
 * Actor: anonymous guest. No cleanup: only the conversation POST is stubbed.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { CreateConversationAnonSchema } from '@repo/schemas';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { execSQL } from '../../fixtures/db-helpers.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const SLUG = 'paraiso-calido-country-house-colon';
const LISTING_URL = `${WEB_URL}/es/alojamientos/${SLUG}/`;
const INITIATE_PATH = '/api/v1/public/conversations/initiate';
const CONTACT_BAR = '[data-mobile-dock] [data-mobile-dock-slot="contact"] [data-dock-item]';
const RELATED_CAROUSEL = '.related-carousel';

async function openContactSheet({ page }: { readonly page: Page }) {
    const trigger = page.locator(CONTACT_BAR).getByRole('link', { name: 'Consultar', exact: true });
    const sheet = page.getByRole('dialog', { name: /^Consultá a \S/ });
    // The link jumps to #contact until the client-side panel is ready.
    await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await trigger.tap();
    await expect(sheet).toBeVisible();
    return { trigger, sheet };
}

test.describe('GUEST-11: mobile listing detail @p0 @guest @discovery @messaging', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    let listingId: string;

    test.beforeAll(async () => {
        const [row] = await execSQL<{ id: string }>(
            `SELECT id FROM accommodations
             WHERE slug = $1 AND publication_status = 'PUBLISHED' AND deleted_at IS NULL`,
            [SLUG]
        );
        if (!row) throw new Error(`E2E seed must include the published listing ${SLUG}`);
        listingId = row.id;
    });

    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
        await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded' });
    });

    test('T-030: dock shows the nightly price; Escape closes the named sheet and restores focus', async ({
        page
    }) => {
        const bar = page.locator(CONTACT_BAR);
        await expect(bar).toBeInViewport();
        await expect(bar.getByText(/^\$\s*150\.500$/)).toBeVisible();
        await expect(bar.getByText('/noche', { exact: true })).toBeVisible();
        // The seed has public contact information but no contactInfo.whatsapp.
        await expect(bar.getByRole('link', { name: /WhatsApp/ })).toHaveCount(0);

        const { trigger, sheet } = await openContactSheet({ page });
        await expect(sheet).toHaveAttribute('data-variant', 'sheet');
        await expect(sheet.getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
        await page.keyboard.press('Escape');

        await expect(sheet).toBeHidden();
        await expect(trigger).toBeFocused();
    });

    test('T-030: backdrop and browser back dismiss the sheet and restore the trigger', async ({
        page
    }) => {
        await test.step('Dismiss by tapping the backdrop above the bottom sheet', async () => {
            const { trigger, sheet } = await openContactSheet({ page });
            await expect(sheet.getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
            await page.touchscreen.tap(195, 1);
            await expect(sheet).toBeHidden();
            await expect(trigger).toBeFocused();
            await expect(page).toHaveURL(LISTING_URL);
        });

        await test.step('Dismiss with browser back without leaving the listing', async () => {
            const { trigger, sheet } = await openContactSheet({ page });
            await expect(sheet.getByRole('button', { name: 'Cerrar', exact: true })).toBeFocused();
            // The history entry can be claimed after the sheet first renders.
            await expect(page).toHaveURL(/#hospeda-dialog-\d+$/);
            await page.goBack({ timeout: 10_000 });
            await expect(page).toHaveURL(LISTING_URL);
            await expect(sheet).toBeHidden();
            await expect(trigger).toBeFocused();
        });
    });

    test('T-031: dates and guests prefill the message sent in an anonymous inquiry', async ({
        page
    }) => {
        const expectedMessage = 'Hola, ¿está disponible del 15/1 al 18/1 para 2 personas?';
        const guest = { name: 'Mobile E2E Guest', email: 'listing-detail@example.test' };
        const matchesInitiate = (url: URL) => url.pathname === INITIATE_PATH;
        await page.route(matchesInitiate, async (route) => {
            if (route.request().method() !== 'POST') {
                await route.fallback();
                return;
            }
            await route.fulfill({
                status: 200,
                headers: { 'access-control-allow-origin': new URL(WEB_URL).origin },
                json: {
                    success: true,
                    data: {
                        status: 'pending_verification',
                        conversationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                    },
                    metadata: {
                        timestamp: new Date().toISOString(),
                        requestId: 'e2e-listing-detail'
                    }
                }
            });
        });

        const { sheet } = await openContactSheet({ page });
        await sheet.getByLabel('Llegada', { exact: true }).fill('2030-01-15');
        await sheet.getByLabel('Salida', { exact: true }).fill('2030-01-18');
        await sheet.getByRole('spinbutton', { name: 'Huéspedes' }).fill('2');
        await expect(sheet.getByRole('textbox', { name: /^Mensaje/ })).toHaveValue(expectedMessage);
        await sheet.getByRole('textbox', { name: /^Nombre/ }).fill(guest.name);
        await sheet.getByRole('textbox', { name: /^Email/ }).fill(guest.email);

        const [request] = await Promise.all([
            page.waitForRequest(
                (request) => request.method() === 'POST' && matchesInitiate(new URL(request.url())),
                { timeout: 15_000 }
            ),
            sheet.getByRole('button', { name: 'Enviar mensaje', exact: true }).tap()
        ]);

        expect(CreateConversationAnonSchema.parse(request.postDataJSON())).toMatchObject({
            accommodationId: listingId,
            guestName: guest.name,
            guestEmail: guest.email,
            message: expectedMessage
        });
        await expect(sheet.getByText(/Te enviamos un email de verificación/)).toBeVisible();
    });

    test('T-032: booking summary precedes the first related carousel; desktop pricing is hidden', async ({
        page
    }) => {
        const summary = page.getByRole('region', { name: 'Precio y contacto', exact: true });
        const firstCarousel = page.locator(RELATED_CAROUSEL).first();
        const sidebar = page.locator('.pricing-sidebar');
        await expect(summary).toBeVisible();
        await expect(firstCarousel).toBeVisible();

        const [summaryBox, carouselBox] = await Promise.all([
            summary.boundingBox(),
            firstCarousel.boundingBox()
        ]);
        if (!summaryBox || !carouselBox) {
            throw new Error('Expected both sections to have layout boxes');
        }
        expect(summaryBox.y + summaryBox.height).toBeLessThanOrEqual(carouselBox.y);
        const { documentTop, precedesCarousel } = await summary.evaluate((element, selector) => {
            const carousel = document.querySelector(selector);
            return {
                documentTop: element.getBoundingClientRect().top + window.scrollY,
                precedesCarousel:
                    carousel !== null &&
                    Boolean(
                        element.compareDocumentPosition(carousel) & Node.DOCUMENT_POSITION_FOLLOWING
                    )
            };
        }, RELATED_CAROUSEL);
        expect(documentTop).toBeLessThan(1400);
        expect(precedesCarousel).toBe(true);
        await expect(sidebar).toBeAttached();
        await expect(sidebar).toBeHidden();
    });

    test('T-033: ArrowRight scrolls the mobile gallery and tapping opens slide two in the lightbox', async ({
        page
    }) => {
        const track = page.getByRole('region', { name: 'Galería de imágenes', exact: true });
        const slides = track.getByRole('button', { name: /^Ver imagen en pantalla completa:/ });
        await expect(track).toBeVisible();
        // The focusable SSR track is visible before its React keyboard handler is attached.
        await expect(page.locator('astro-island[ssr]').filter({ has: track })).toHaveCount(0);
        const total = await slides.count();
        expect(total).toBeGreaterThan(1);
        await expect(page.getByText(`1/${total}`, { exact: true })).toBeVisible();

        await track.focus();
        await expect(track).toBeFocused();
        await track.press('ArrowRight');

        await expect(page.getByText(`2/${total}`, { exact: true })).toBeVisible();
        const secondSlide = slides.nth(1);
        await expect(secondSlide).toBeInViewport({ ratio: 0.8 });
        await secondSlide.tap();
        const lightbox = page.getByRole('dialog', {
            name: 'Abrir imagen en pantalla completa',
            exact: true
        });
        await expect(lightbox).toBeVisible();
        await expect(lightbox.getByText(`2/${total}`, { exact: true })).toBeVisible();
    });

    test('public contact block links carry the accommodation tracking attributes', async ({
        page
    }) => {
        const contact = page.getByRole('region', { name: 'Contacto', exact: true });
        // Select by href so losing any tracking attribute fails the assertion, not the lookup.
        for (const [hrefPrefix, channel] of [
            ['tel:', 'phone'],
            ['mailto:', 'email'],
            ['https://', 'website']
        ] as const) {
            const link = contact.locator(`a[href^="${hrefPrefix}"]`);
            await expect(link).toBeVisible();
            await expect(link).toHaveAttribute('data-contact-channel', channel);
            await expect(link).toHaveAttribute('data-listing-id', listingId);
            await expect(link).toHaveAttribute('data-vertical', 'accommodation');
            await expect(link).toHaveAttribute('data-contact-origin', 'contact_block');
        }
    });
});
