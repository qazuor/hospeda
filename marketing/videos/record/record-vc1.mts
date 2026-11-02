/**
 * Records the screencast of video VC1 («Publicá tu alojamiento en tres pasos») on staging, logged
 * in as a seeded host, as the reference phone (record/lib/take.ts).
 *
 * - Creates «Casa Quinta Las Palmeras» from scratch, fills the required blocks, uploads the
 *   owner's photos, marks the map and publishes (which starts the 30-day trial, no card).
 * - The kept spans are bracketed by `keep:<name>` / `keep:<name>:end` marks; everything outside
 *   them (page loads, saves, the long description, the price block) never reaches the edit.
 * - The capacity form shares its page with «Precio por noche»: the price is never typed and the
 *   composition frames the capacity block only.
 * - The password comes from `VIDEO_LOGIN_PASSWORD` and is never logged.
 * - A leftover draft with the same name is deleted through the UI before the take starts.
 *
 * Usage: VIDEO_LOGIN_PASSWORD=… pnpm record:vc1 [take-name] [--dry]
 * `--dry` runs the whole flow but answers «Seguir editando» instead of publishing.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { assertCleanView, login, photosDirOf, saveSection } from './lib/staging';
import { createTake, hideCssOf, launchDevice, scrollToLocator, scrollToY, sleep } from './lib/take';

const WEB = process.env.WEB_URL ?? 'https://staging.hospeda.com.ar';
/** Seeded host account on staging (never a super admin). */
const EMAIL = process.env.VIDEO_LOGIN_EMAIL ?? 'host-premium@local.test';
/** Resized copies (≤ 2000 px) of the owner's photos; they live outside the repo. */
const PHOTOS_DIR = photosDirOf({ video: 'vc1' });
const FEATURED = '01-exterior.jpg';
const GALLERY = ['02-pileta.jpg', '03-living.jpg', '04-dormitorio.jpg', '05-cocina.jpg'];

const NAME = 'Casa Quinta Las Palmeras';
const TYPE = 'Casa de campo';
const CITY = 'Concepción del Uruguay';
const SUMMARY =
    'Casa quinta con pileta y parque arbolado, ideal para descansar en familia cerca del río.';
const DESCRIPTION =
    'Casa quinta rodeada de verde, con pileta, galería y un parque amplio para disfrutar al aire libre. Tiene living comedor luminoso, cocina equipada y dormitorios cómodos. Ideal para descansar en familia o con amigos, a pocos minutos del río y del centro.';
const CAPACITY = { guests: '8', bedrooms: '3', baths: '2' } as const;

/** Owner-approved demo staging (REGLAS.md): the trial callouts, which the closing covers. */
const DEMO_HIDE_CSS = hideCssOf(['[class*="trial-callout"]']);

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const rec = createTake({ video: 'vc1', take: args.find((a) => !a.startsWith('--')) ?? 'vc1-test' });

const photo = (file: string): string => {
    const path = join(PHOTOS_DIR, file);
    if (!existsSync(path)) throw new Error(`Missing photo ${path} (set VC1_PHOTOS_DIR).`);
    return path;
};

/**
 * Deletes a leftover listing with the take's name through «Mis propiedades» → Eliminar →
 * «Sí, eliminar». Deleted listings stay listed as «Ficha borrada» and are skipped.
 */
const deleteLeftover = async (page: Page): Promise<void> => {
    await page.goto(`${WEB}/es/mi-cuenta/propiedades/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    for (let i = 0; i < 3; i++) {
        const card = page
            .locator('article.prop-card', { hasText: NAME })
            .filter({ hasNotText: 'Ficha borrada' })
            .first();
        if ((await card.count()) === 0) return;
        console.info(`deleting leftover "${NAME}"`);
        await card.getByRole('button', { name: 'Eliminar' }).click();
        await card.getByRole('button', { name: 'Sí, eliminar' }).click();
        await page.waitForLoadState('load');
        await sleep(3000);
        await page.goto(`${WEB}/es/mi-cuenta/propiedades/`, { waitUntil: 'networkidle' });
        await sleep(1500);
    }
    throw new Error(`Could not delete the leftover "${NAME}".`);
};

const main = async (): Promise<void> => {
    const { browser, context, page } = await launchDevice({ origin: WEB, hideCss: DEMO_HIDE_CSS });
    await login({ page, web: WEB, email: EMAIL, video: 'VC1' });
    await deleteLeftover(page);

    await page.goto(`${WEB}/es/publicar/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    if (await page.getByText('Ya tenés un borrador en curso').count()) {
        throw new Error(`${EMAIL} still has a draft in progress: delete it and retry.`);
    }
    const nameField = page.getByLabel('Nombre del alojamiento');
    await scrollToLocator(page.getByTestId('step-indicator'), 10);
    await sleep(800);

    await rec.start(context, page);
    await sleep(500);

    // Stage 1 — the basics: name and type, then (jump) the capacity.
    rec.mark('stage:datos');
    rec.mark('keep:mini');
    await sleep(400);
    await rec.tap('campo-nombre', nameField);
    await rec.type('nombre', nameField, NAME);
    await sleep(300);
    await rec.tap('campo-tipo', page.getByTestId('property-type-input'));
    await sleep(700);
    await rec.tap('opcion-tipo', page.getByRole('option', { name: TYPE }).first());
    await sleep(300);
    await rec.hold('tipo', 1300, page.getByTestId('property-type-input'));
    rec.mark('keep:mini:end');

    await page.getByTestId('property-city-input').fill(CITY);
    const city = page.locator('[data-testid^=property-city-option-]').first();
    await city.waitFor({ timeout: 15_000 });
    await city.tap();
    await page.getByLabel('Descripción corta').fill(SUMMARY);
    await page.getByRole('button', { name: 'Crear borrador y seguir al paso 2' }).click();
    await page.waitForURL(/\/editar\/$/, { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    const editBase = page.url();

    await page.goto(`${editBase}datos/`, { waitUntil: 'networkidle' });
    await sleep(1200);
    await page.locator('#acc-description').fill(DESCRIPTION);
    await saveSection({ page, where: 'datos' });

    await page.goto(`${editBase}capacidad-precio/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await scrollToY(page, 0, 10);
    await sleep(600);
    const guests = page.getByLabel('Huéspedes máx.');
    const capacityGrid = guests.locator('xpath=ancestor::*[.//label[contains(., "Baños")]][1]');
    rec.mark('keep:capacidad');
    await sleep(400);
    await rec.tap('campo-huespedes', guests);
    await rec.type('huespedes', guests, CAPACITY.guests, 120);
    await rec.tap('campo-dormitorios', page.getByLabel('Dormitorios'));
    await rec.type('dormitorios', page.getByLabel('Dormitorios'), CAPACITY.bedrooms, 120);
    await rec.tap('campo-banos', page.getByLabel('Baños'));
    await rec.type('banos', page.getByLabel('Baños'), CAPACITY.baths, 120);
    await assertCleanView({ page, where: 'capacity' });
    await rec.hold('capacidad', 1600, capacityGrid);
    rec.mark('keep:capacidad:end');
    await saveSection({ page, where: 'capacidad' });

    // Stage 2 — the map pin, then the photos; the main photo opens the publish prompt.
    await page.goto(`${editBase}ubicacion/`, { waitUntil: 'networkidle' });
    await sleep(2000);
    const map = page.locator('.leaflet-container').first();
    await scrollToLocator(map, 10, 300);
    await sleep(1500);
    const mapBox = await map.boundingBox();
    if (!mapBox) throw new Error('Map not visible.');
    rec.mark('stage:fotos');
    rec.mark('keep:mapa');
    await rec.hold('mapa', 900, map);
    await rec.tapAt('pin', mapBox.x + mapBox.width * 0.68, mapBox.y + mapBox.height * 0.3);
    await sleep(300);
    await rec.hold('pin-marcado', 1300, map);
    rec.mark('keep:mapa:end');
    const lat = await page.getByLabel('Latitud').inputValue();
    if (!lat) throw new Error('The map tap did not set the coordinates.');
    await saveSection({ page, where: 'ubicacion' });

    await page.goto(`${editBase}fotos/`, { waitUntil: 'networkidle' });
    await sleep(2000);
    const featuredButton = page
        .locator('#featured-image-input')
        .locator('xpath=..')
        .locator('button')
        .first();
    await scrollToLocator(featuredButton, 10, 150);
    await sleep(1000);
    const galleryAdd = page.getByRole('button', { name: 'Agregar fotos a la galería' });
    const galleryImages = galleryAdd.locator('xpath=..').locator('img');

    rec.mark('keep:galeria');
    await sleep(300);
    const galleryChooser = page.waitForEvent('filechooser');
    await rec.tap('subir-galeria', galleryAdd);
    await (await galleryChooser).setFiles(GALLERY.map(photo));
    await sleep(700);
    rec.mark('keep:galeria:end');
    await galleryImages.nth(GALLERY.length - 1).waitFor({ timeout: 90_000 });
    await sleep(1500);
    rec.mark('keep:galeria-lista');
    await rec.hold('galeria-lista', 1300);
    rec.mark('keep:galeria-lista:end');

    rec.mark('keep:principal');
    await sleep(300);
    const featuredChooser = page.waitForEvent('filechooser');
    await rec.tap('subir-principal', featuredButton);
    await (await featuredChooser).setFiles(photo(FEATURED));
    await sleep(700);
    rec.mark('keep:principal:end');

    const dialog = page.getByRole('dialog', { name: 'Tu ficha ya está lista' });
    await dialog.waitFor({ timeout: 90_000 });
    await sleep(900);
    rec.mark('keep:lista');
    await rec.hold('dialogo', 1500, dialog);
    if (DRY) {
        await rec.tap('seguir', dialog.getByRole('button', { name: 'Seguir editando' }));
        rec.mark('keep:lista:end');
        await sleep(1000);
        await rec.finish({ dry: true });
        await browser.close();
        return;
    }
    await rec.tap('publicar', dialog.getByRole('button', { name: 'Publicar ahora' }));
    await sleep(500);
    rec.mark('keep:lista:end');

    // Stage 3 — the published listing, as a tourist sees it.
    await page.waitForURL(/\/mi-cuenta\/propiedades\/?$/, { timeout: 60_000 });
    await page.waitForLoadState('networkidle');
    const card = page
        .locator('article.prop-card', { hasText: NAME })
        .filter({ hasNotText: 'Ficha borrada' })
        .first();
    const href = await card.locator('a[href*="/alojamientos/"]').first().getAttribute('href');
    if (!href) throw new Error('The published card has no public link.');
    const publicUrl = new URL(href, WEB).toString();
    console.info(`public listing: ${publicUrl}`);
    await page.goto(publicUrl, { waitUntil: 'networkidle' });
    await sleep(2500);
    if (!(await page.getByText(NAME).first().isVisible())) {
        throw new Error(`The public page does not show "${NAME}".`);
    }
    await assertCleanView({ page, where: 'public top' });
    rec.mark('stage:listo');
    rec.mark('keep:ficha');
    await rec.hold('ficha', 2000);
    await scrollToY(page, 520, 3200);
    await assertCleanView({ page, where: 'public scrolled' });
    await rec.hold('ficha-abajo', 5500);
    rec.mark('keep:ficha:end');

    await rec.finish({ publicUrl });
    await browser.close();
};

await main();
