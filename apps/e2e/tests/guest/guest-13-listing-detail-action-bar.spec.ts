/**
 * GUEST-13 (action bar) — the icon-only mobile action bar of the listing detail
 * pages (HOS-2579 §6.10: AC-30, AC-33, AC-34, and the owner criterion of
 * 24/11/2026: the dock stays pinned on every listing page of the three verticals).
 *
 * Kept apart from `guest-13-listing-detail-standard.spec.ts` (section order and
 * tabs, HOS-2579 PR 3) so the two PRs never edit the same file.
 *
 * Preconditions: the E2E suite seed plus `fixtures/listing-contact-fixtures.ts`
 * (`accommodationAllActions`: price, WhatsApp and a public phone, so all six
 * actions render; `venueWithoutContact`: no menu, socials, phone or WhatsApp), and
 * the seeded experience `excursion-rio-uruguay-concepcion` (no public channel).
 * Uses HOSPEDA_E2E_WEB_URL or the default E2E web port. Actor: anonymous guest.
 * Read-only: nothing is created, so there is nothing to clean up.
 *
 * Widths and boxes are what jsdom cannot compute (HOS-1780), which is why these
 * are E2E: the unit tests prove what renders, these prove that it fits.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { seedCookieConsent } from '../../fixtures/browser-helpers.ts';
import { LISTING_CONTACT_FIXTURE_SLUGS as FIXTURES } from '../../fixtures/listing-contact-fixtures.ts';

const WEB_URL = process.env.HOSPEDA_E2E_WEB_URL ?? 'http://localhost:18321';
const DOCK = '[data-mobile-dock]';
const BAR = `${DOCK} [data-mobile-dock-slot="contact"] [data-dock-item]`;
const ACTION_ROW = `${BAR} [data-action-row]`;
const EXPERIENCE_WITHOUT_CHANNELS = 'excursion-rio-uruguay-concepcion';

const LISTINGS = [
    { vertical: 'accommodation', path: `/es/alojamientos/${FIXTURES.accommodationAllActions}/` },
    { vertical: 'venue', path: `/es/comer-y-salir/${FIXTURES.venueWithoutContact}/` },
    { vertical: 'experience', path: `/es/experiencias/${EXPERIENCE_WITHOUT_CHANNELS}/` }
] as const;

const VIEWPORTS = [
    { width: 360, height: 740 },
    { width: 390, height: 844 }
] as const;

/** Box of each row control (the island wrappers are measured by their button). */
async function measureRow({ page }: { readonly page: Page }) {
    return page.locator(ACTION_ROW).evaluate((row) => {
        const controls = Array.from(row.querySelectorAll<HTMLElement>('[data-action]')).map(
            (node) =>
                node.matches('a, button')
                    ? node
                    : (node.querySelector<HTMLElement>('button') ?? node)
        );
        const box = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return {
                top: rect.top,
                left: rect.left,
                right: rect.right,
                width: rect.width,
                height: rect.height
            };
        };
        const aiChat = document.querySelector('[data-mobile-dock-slot="ai-chat"] [data-dock-item]');
        const scrollToTop = document.querySelector('#scroll-to-top');
        return {
            actions: controls.map((control) => ({
                action: control.closest<HTMLElement>('[data-action]')?.dataset.action ?? '',
                ...box(control)
            })),
            row: box(row),
            aiChat: aiChat && aiChat.getClientRects().length > 0 ? box(aiChat) : null,
            scrollToTop:
                scrollToTop && getComputedStyle(scrollToTop).visibility !== 'hidden'
                    ? box(scrollToTop)
                    : null,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            viewport: window.innerWidth
        };
    });
}

/** Waits until the bar island has hydrated (its panel trigger announces the dialog). */
async function waitForBar({ page }: { readonly page: Page }) {
    const bar = page.locator(BAR);
    await expect(bar).toBeInViewport({ timeout: 15_000 });
    await expect(bar.locator('[data-action="share"] button')).toBeVisible();
    return bar;
}

const overlaps = (
    a: { top: number; left: number; right: number; height: number },
    b: { top: number; left: number; right: number; height: number }
) => a.left < b.right && b.left < a.right && a.top < b.top + b.height && b.top < a.top + a.height;

test.describe('GUEST-13: listing action bar @p1 @guest @discovery @messaging', () => {
    test.beforeEach(async ({ page }) => {
        await seedCookieConsent(page);
    });

    for (const viewport of VIEWPORTS) {
        test.describe(`${viewport.width}x${viewport.height}`, () => {
            test.use({ viewport, hasTouch: true });

            test('AC-33: the six accommodation actions sit on one row with the AI chat, without overflow', async ({
                page
            }) => {
                await page.goto(`${WEB_URL}/es/alojamientos/${FIXTURES.accommodationAllActions}/`, {
                    waitUntil: 'domcontentloaded'
                });
                const bar = await waitForBar({ page });
                await expect(
                    bar.getByRole('link', { name: 'Consultar', exact: true })
                ).toHaveAttribute('aria-haspopup', 'dialog', { timeout: 15_000 });
                // The tightest row is six actions plus the AI chat FAB: a guest gets
                // the FAB once the widget resolves the session, so wait for it.
                await expect(
                    page.locator('[data-mobile-dock-slot="ai-chat"] [data-dock-item]')
                ).toBeVisible({ timeout: 15_000 });

                const {
                    actions,
                    row,
                    aiChat,
                    overflow,
                    viewport: width
                } = await measureRow({ page });
                expect(actions.map(({ action }) => action)).toEqual([
                    'primary',
                    'whatsapp',
                    'call',
                    'favorite',
                    'share',
                    'compare'
                ]);
                // One line: every control shares the first one's top, and the row is one control tall.
                const firstTop = actions[0]?.top ?? 0;
                for (const control of actions) {
                    expect(Math.abs(control.top - firstTop), control.action).toBeLessThanOrEqual(1);
                }
                expect(Math.abs(row.height - 44)).toBeLessThanOrEqual(2);
                // Same line as the AI chat button, and never under it.
                expect(aiChat).not.toBeNull();
                if (!aiChat) return;
                expect(Math.abs(aiChat.top + aiChat.height - (firstTop + 44))).toBeLessThanOrEqual(
                    2
                );
                expect(row.right).toBeLessThanOrEqual(aiChat.left);
                expect(aiChat.right).toBeLessThanOrEqual(width);
                expect(row.right).toBeLessThanOrEqual(width);
                expect(overflow).toBeLessThanOrEqual(0);
            });

            test('AC-33: the floating scroll-to-top never covers a bar action', async ({
                page
            }) => {
                await page.goto(`${WEB_URL}/es/alojamientos/${FIXTURES.accommodationAllActions}/`, {
                    waitUntil: 'domcontentloaded'
                });
                await waitForBar({ page });
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await expect(page.locator('#scroll-to-top.scroll-to-top--visible')).toBeVisible();

                const { actions, scrollToTop } = await measureRow({ page });
                expect(scrollToTop).not.toBeNull();
                if (!scrollToTop) return;
                for (const control of actions) {
                    expect(overlaps(scrollToTop, control), control.action).toBe(false);
                }
            });

            test('AC-34: every bar control is at least 44x44', async ({ page }) => {
                await page.goto(`${WEB_URL}/es/alojamientos/${FIXTURES.accommodationAllActions}/`, {
                    waitUntil: 'domcontentloaded'
                });
                await waitForBar({ page });

                const { actions } = await measureRow({ page });
                expect(actions).toHaveLength(6);
                for (const control of actions) {
                    expect(control.width, control.action).toBeGreaterThanOrEqual(44);
                    expect(control.height, control.action).toBeGreaterThanOrEqual(44);
                }
                expect(actions[0]?.width).toBeGreaterThanOrEqual(52);
            });
        });
    }

    test.describe('390x844', () => {
        test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

        for (const listing of LISTINGS) {
            test(`owner criterion: the dock stays pinned after a 2000px scroll on the ${listing.vertical} page`, async ({
                page
            }) => {
                await page.goto(`${WEB_URL}${listing.path}`, { waitUntil: 'domcontentloaded' });
                const bar = await waitForBar({ page });
                // Favorito and Compartir always exist, even with nothing to contact.
                await expect(bar.locator('[data-action="favorite"]')).toHaveCount(1);
                await expect(bar.locator('[data-action="share"]')).toHaveCount(1);

                const scrolled = await page.evaluate(async () => {
                    const target = Math.min(
                        2000,
                        document.documentElement.scrollHeight - window.innerHeight - 200
                    );
                    for (let y = 200; y <= target; y += 200) {
                        window.scrollTo(0, y);
                        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
                    }
                    window.scrollTo(0, target);
                    await new Promise((resolve) =>
                        requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))
                    );
                    return window.scrollY;
                });
                // Past the hide threshold and short of the page end, where an unpinned dock hides.
                expect(scrolled).toBeGreaterThan(400);
                await expect(page.locator(DOCK)).not.toHaveAttribute('data-dock-hidden');
                await expect(bar).toBeInViewport();
            });
        }

        test('AC-30: an anonymous visitor tapping WhatsApp gets the panel upsell and no number request', async ({
            page
        }) => {
            const whatsappRequests: string[] = [];
            page.on('request', (request) => {
                if (/\/protected\/accommodations\/[^/]+\/whatsapp/.test(request.url())) {
                    whatsappRequests.push(request.url());
                }
            });
            await page.goto(`${WEB_URL}/es/alojamientos/${FIXTURES.accommodationAllActions}/`, {
                waitUntil: 'domcontentloaded'
            });
            const bar = await waitForBar({ page });
            const trigger = bar.getByRole('link', { name: 'Escribir por WhatsApp', exact: true });
            await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog', { timeout: 15_000 });
            await trigger.tap();

            const dialog = page.getByRole('dialog', { name: /^Consultá a \S/ });
            await expect(dialog).toBeVisible();
            const region = dialog.getByRole('region', { name: 'WhatsApp' });
            await expect(region).toBeFocused();
            await expect(region.getByRole('link', { name: 'Ver planes' })).toBeVisible();
            expect(whatsappRequests).toEqual([]);
        });
    });
});
