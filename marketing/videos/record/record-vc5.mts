/**
 * Records video VC5 («Lo que ve el turista»): a real, public accommodation page on the reference
 * phone's viewport (config/device.ts: 412 × 750 CSS px) at DPR 3. No login.
 *
 * STRICTLY READ-ONLY: the take only scrolls, opens the navigation menu and switches language.
 * It never touches contact, WhatsApp, phone, favourites, reviews, forms or share.
 *
 * One continuous screencast. Page loads (language switches) are bracketed by `cut:out` / `cut:in`
 * marks; the composition drops them and covers each with a brand wipe.
 *
 * Output (see record/lib/take.ts):
 * - <recordings dir>/vc5/<take>/frames/ + frames.json + concat.txt + events.json + screen.mp4
 * - <public dir>/vc5/screen.mp4 + events.json (edit-ready copy read by src/vc5/)
 *
 * Usage: pnpm record:vc5 [take-name]   (LISTING_URL overrides the page)
 */
import type { Page } from 'playwright';
import { createTake, launchDevice, scrollToLocator, scrollToY, sleep } from './lib/take';

/** Public listing recorded by default (owner permission granted). */
const DEFAULT_LISTING_URL = 'https://hospeda.com.ar/es/alojamientos/cabin-ruca-lihuen-cabanas/';
const LISTING_URL = process.env.LISTING_URL ?? DEFAULT_LISTING_URL;

const rec = createTake({ video: 'vc5', take: process.argv[2] ?? 'vc5-test' });

/** Opens the navigation menu and taps one language. Navigates to the /<lang>/ page. */
const switchLanguage = async (page: Page, name: 'English' | 'Português'): Promise<void> => {
    await rec.tap('menu', page.locator('button.header__hamburger'));
    await sleep(650);
    const option = page
        .locator(
            'div[aria-label="Cambiar idioma"]:visible, div[aria-label="Change language"]:visible, div[aria-label="Mudar idioma"]:visible'
        )
        .locator(`a[aria-label="${name}"]`)
        .first();
    await rec.tap(`lang-${name === 'English' ? 'en' : 'pt'}`, option);
};

/** Waits for a freshly loaded page, parks it on the description, and ends the hidden stretch. */
const landOnDescription = async (page: Page, lang: string): Promise<void> => {
    await page.waitForURL(new RegExp(`/${lang}/`), { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    await scrollToLocator(page.locator('.quick-facts'), 0);
    await sleep(900);
    rec.mark('cut:in');
    rec.mark(`page:${lang}`);
};

const main = async (): Promise<void> => {
    const url = new URL(LISTING_URL);
    const { browser, context, page } = await launchDevice({ origin: url.origin });
    await page.goto(url.href, { waitUntil: 'networkidle' });
    // Warm the lazy map tiles and images, then come back to the top.
    for (const sel of ['.location-section', '.nearby-poi-section']) {
        await scrollToLocator(page.locator(sel), 0);
        await sleep(1200);
    }
    await scrollToY(page, 0, 0);
    await sleep(1500);
    await rec.start(context, page);

    // Stage 1 — photos and description, then the same listing in English and Portuguese.
    rec.mark('stage:idioma');
    await rec.hold('fotos', 1800);
    await scrollToLocator(page.locator('.quick-facts'), 1100);
    await rec.hold('desc-es', 1600, page.locator('.description__summary'));
    await switchLanguage(page, 'English');
    rec.mark('cut:out');
    await landOnDescription(page, 'en');
    await rec.hold('desc-en', 2200, page.locator('.description__summary'));
    await switchLanguage(page, 'Português');
    rec.mark('cut:out');
    await landOnDescription(page, 'pt');
    await rec.hold('desc-pt', 2600, page.locator('.description__summary'));

    // Back to Spanish: the load is hidden by a wipe, no tap shown.
    rec.mark('cut:out');
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await sleep(1200);
    rec.mark('cut:in');

    // Stage 2 — the map and what is nearby, with distances.
    rec.mark('stage:cerca');
    await rec.hold('top-es', 500);
    await scrollToLocator(page.locator('.location-section'), 2000);
    await sleep(500);
    await rec.hold('mapa', 2400, page.locator('.location-section__map'));
    await scrollToLocator(page.locator('.nearby-poi-section'), 1400);
    await sleep(300);
    const cards = page.locator('.nearby-poi-section__card');
    await rec.hold('cerca-1', 1800, cards.nth(0));
    await rec.hold('cerca-2', 1600, cards.nth(1));
    await rec.hold('cerca-3', 1600, cards.nth(2));
    await rec.hold('final', 2500);

    await rec.finish({ source: url.href });
    await browser.close();
};

await main();
