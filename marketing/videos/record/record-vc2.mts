/**
 * Records video VC2 («Ya lo tenés publicado: importalo») on STAGING, logged in as a host: the
 * listing-import flow of /publicar/ (paste a link, import, the form fills itself) on the
 * reference phone's viewport at DPR 3.
 *
 * - The password comes from `VIDEO_LOGIN_PASSWORD` and is never logged.
 * - The import only pre-fills the form; nothing is submitted, no draft is created.
 * - The import source must never be legible: the composition blurs the URL field (its box is the
 *   `paste` event), and every settled position is checked for prices and third-party brand names.
 *
 * Usage: VIDEO_LOGIN_PASSWORD=… IMPORT_SOURCE_URL=… pnpm record:vc2 [take-name]
 *   (IMPORT_SOURCE_URL is required; WEB_URL and VIDEO_LOGIN_EMAIL override the defaults)
 */
import type { Locator, Page } from 'playwright';
import { assertCleanView, login } from './lib/staging';
import {
    createTake,
    docTopOf,
    HEADER_OFFSET,
    hideCssOf,
    launchDevice,
    scrollToLocator,
    scrollToY,
    sleep,
    VIEWPORT
} from './lib/take';

const WEB = process.env.WEB_URL ?? 'https://staging.hospeda.com.ar';
/** Seeded host account on staging (never a super admin). */
const EMAIL = process.env.VIDEO_LOGIN_EMAIL ?? 'host-pro@local.test';
/** Public listing to import. Supplied per take so no third-party listing URL lives in the repo. */
const SOURCE = process.env.IMPORT_SOURCE_URL;
if (!SOURCE) throw new Error('IMPORT_SOURCE_URL is required: the public listing to import.');

/** Owner-approved demo staging (REGLAS.md): the trial callouts, which the closing covers. */
const DEMO_HIDE_CSS = hideCssOf(['[class*="trial-callout"]']);

const rec = createTake({ video: 'vc2', take: process.argv[2] ?? 'vc2-test' });

/** Label of a form field, by its exact text. */
const label = (page: Page, text: string): Locator =>
    page.locator('label', { hasText: text }).first();

const main = async (): Promise<void> => {
    const { browser, context, page } = await launchDevice({
        origin: WEB,
        hideCss: DEMO_HIDE_CSS
    });
    await login({ page, web: WEB, email: EMAIL, video: 'VC2' });
    await page.goto(`${WEB}/es/publicar/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    if (await page.getByText('Ya tenés un borrador en curso').count()) {
        throw new Error(
            `${EMAIL} has a draft in progress on staging: delete it from Mis propiedades and retry.`
        );
    }
    await scrollToLocator(page.getByTestId('step-indicator'), 0, HEADER_OFFSET + 16);
    await sleep(1200);
    await rec.start(context, page);

    // Stage 1 — open the import, paste the link, import.
    rec.mark('stage:link');
    await rec.hold('form', 1300);
    await rec.tap('importar-desde-url', page.getByTestId('import-toggle'));
    await sleep(700);
    const field = page.locator('input[type="url"]').first();
    await rec.tap('campo-url', field);
    await sleep(450);
    await rec.paste('link', field, SOURCE);
    await rec.hold('link-pegado', 1500, field);
    await rec.tap('permiso', page.locator('input[type="checkbox"]').first());
    await sleep(500);
    await rec.tap('importar', page.getByRole('button', { name: 'Importar', exact: true }));
    rec.mark('cut:out');
    await page.getByTestId('import-review-notice').waitFor({ timeout: 90_000 });
    rec.mark('imported');
    // The city picker opens itself after the import; close it before the reveal.
    // It closes on a document mousedown, which a touch tap does not fire.
    const indicator = await page.getByTestId('step-indicator').boundingBox();
    if (indicator) await page.mouse.click(indicator.x + 10, indicator.y + 10);
    await scrollToLocator(label(page, 'Nombre del alojamiento'), 0, HEADER_OFFSET + 70);
    await sleep(1200);
    await assertCleanView({ page, where: 'name' });
    rec.mark('cut:in');

    // Stage 2 — the filled listing.
    rec.mark('stage:ficha');
    await rec.hold('nombre', 1500, page.getByLabel('Nombre del alojamiento'));
    // Scroll down to the description and counts, stopping with the price label just below the fold.
    const priceTop = await docTopOf(label(page, 'Precio base por noche'));
    await scrollToY(page, priceTop - VIEWPORT.height - 12, 2200);
    await assertCleanView({ page, where: 'description' });
    await rec.hold('descripcion', 1800, page.getByLabel('Descripción completa'));
    await rec.hold('conteos', 1200);

    // Jump over the price block to the imported amenities.
    rec.mark('cut:out');
    const amenities = page.getByTestId('extras-amenities');
    await scrollToLocator(amenities, 0, HEADER_OFFSET + 40);
    await sleep(600);
    await assertCleanView({ page, where: 'amenities' });
    rec.mark('cut:in');
    rec.mark('jump:comodidades');
    await rec.hold('comodidades', 2000, amenities);
    await rec.hold('final', 1500);

    await rec.finish({ source: `${WEB}/es/publicar/` });
    await browser.close();
};

await main();
