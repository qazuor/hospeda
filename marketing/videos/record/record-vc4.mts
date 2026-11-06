/**
 * Records the screencast of video VC4 («Publicá tu experiencia») on staging, logged in as a
 * seeded experience owner, as the reference phone (record/lib/take.ts).
 *
 * - Creates a river kayak outing from /es/publicar/experiencias/, adds a contact email, uploads
 *   the Pexels photos (marketing/fotos/vc4, outside the repo) and publishes from «Mi comercio».
 * - The price is «a consultar»: no amount is ever typed or shown.
 * - Kept spans are bracketed by `keep:<name>` / `keep:<name>:end` marks, as in VC1.
 * - Venue and experience listings cannot be deleted from the UI. When a draft with the take's
 *   name already exists (a take that failed after creating it), stage 1 still types into the
 *   create form but the take continues on that draft instead of creating a second one.
 * - The password comes from `VIDEO_LOGIN_PASSWORD` and is never logged.
 *
 * Usage: VIDEO_LOGIN_PASSWORD=… pnpm record:vc4 [take-name] [--dry]
 * `--dry` records stage 1 and stops before «Crear experiencia» (nothing is written).
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';
import { assertCleanView, login, photosDirOf, saveSection } from './lib/staging';
import { createTake, hideCssOf, launchDevice, scrollToLocator, scrollToY, sleep } from './lib/take';

const WEB = process.env.WEB_URL ?? 'https://staging.hospeda.com.ar';
/** Seeded experience owner on staging (never a super admin). */
const EMAIL = process.env.VIDEO_LOGIN_EMAIL ?? 'experience-owner@local.test';
/** Resized copies (≤ 2000 px) of the Pexels photos; they live outside the repo. */
const PHOTOS_DIR = photosDirOf({ video: 'vc4' });
const FEATURED = '01-kayak-rio.jpg';
const GALLERY = ['02-grupo.jpg', '03-atardecer.jpg', '04-desde-arriba.jpg', '05-muelle.jpg'];

const NAME = 'Kayak al atardecer en el río Uruguay';
const TYPE = 'Aventura al aire libre';
const CITY = 'Concepción del Uruguay';
const SUMMARY = 'Remada tranquila entre islas y monte nativo, con guía y equipo incluido.';
const DESCRIPTION =
    'Salimos desde la costa cuando baja el sol y remamos entre islas, riachos y monte nativo. Es una salida tranquila, pensada para quienes nunca remaron: te damos el kayak, el chaleco y una charla antes de salir. Volvemos con las últimas luces.';
const CONTACT_EMAIL = 'salidas.kayak@example.com';

/** Owner-approved demo staging (REGLAS.md): the trial callouts, which the closing covers. */
const DEMO_HIDE_CSS = hideCssOf(['[class*="trial-callout"]']);

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const rec = createTake({ video: 'vc4', take: args.find((a) => !a.startsWith('--')) ?? 'vc4-test' });

const photo = (file: string): string => {
    const path = join(PHOTOS_DIR, file);
    if (!existsSync(path)) throw new Error(`Missing photo ${path} (set VC4_PHOTOS_DIR).`);
    return path;
};

/** Row of «Mi comercio» for the take's listing, if any. */
const listingRow = (page: Page): Locator =>
    page.locator('li.mc-list__item', { hasText: NAME }).first();

/** Editor URL of an existing draft with the take's name, if there is one. */
const existingDraft = async (page: Page): Promise<string | undefined> => {
    await page.goto(`${WEB}/es/mi-cuenta/comercio/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const row = listingRow(page);
    if ((await row.count()) === 0) return undefined;
    if (await row.getByText('Publicado', { exact: true }).count()) {
        throw new Error(`"${NAME}" is already published on staging; nothing left to record.`);
    }
    const href = await row.locator('a.mc-list__edit').getAttribute('href');
    return href ? new URL(href, WEB).toString() : undefined;
};

const main = async (): Promise<void> => {
    const { browser, context, page } = await launchDevice({ origin: WEB, hideCss: DEMO_HIDE_CSS });
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(45_000);
    await login({ page, web: WEB, email: EMAIL, video: 'VC4' });
    const draft = await existingDraft(page);
    if (draft) console.info(`reusing the existing draft "${NAME}"`);

    await page.goto(`${WEB}/es/publicar/experiencias/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    // With a draft in progress the page first offers «Retomar» or «Crear una nueva» (a link); the
    // form only shows after the second. The take still continues on the existing draft.
    const createNew = page.getByRole('link', { name: 'Crear una nueva' });
    if (await createNew.count()) {
        await createNew.click();
        await page.waitForLoadState('networkidle');
        await sleep(1500);
    }
    const nameField = page.locator('#cc-name');
    await scrollToLocator(page.locator('label[for="cc-name"]'), 10, 140);
    await sleep(800);

    await rec.start(context, page);
    await sleep(500);

    // Stage 1 — what the outing is: name and category, then (jump) the summary.
    rec.mark('stage:salida');
    rec.mark('keep:nombre');
    await sleep(300);
    await rec.tap('campo-nombre', nameField);
    await rec.type('nombre', nameField, NAME);
    await sleep(300);
    await rec.tap('campo-tipo', page.locator('#cc-type'));
    await page.locator('#cc-type').selectOption({ label: TYPE });
    await sleep(300);
    await rec.hold('tipo', 1200, page.locator('#cc-type'));
    rec.mark('keep:nombre:end');

    const summary = page.locator('#cc-summary');
    await summary.scrollIntoViewIfNeeded();
    await sleep(600);
    rec.mark('keep:resumen');
    await sleep(300);
    await rec.tap('campo-resumen', summary);
    await rec.type('resumen', summary, SUMMARY, 40);
    await rec.hold('resumen-listo', 1200, summary);
    rec.mark('keep:resumen:end');
    await assertCleanView({ page, where: 'create form' });

    await page.locator('#cc-description').fill(DESCRIPTION);
    await page.locator('#cc-destinationId').selectOption({ label: CITY });
    await page.getByLabel('Precio a consultar').check();
    if (DRY) {
        await sleep(500);
        await rec.finish({ dry: true });
        await browser.close();
        return;
    }
    if (draft) {
        await page.goto(draft, { waitUntil: 'networkidle' });
    } else {
        await page.getByRole('button', { name: 'Crear experiencia' }).click();
        await page.waitForURL(/\/editar\/?$/, { timeout: 60_000 });
        await page.waitForLoadState('networkidle');
    }
    const editBase = page.url().replace(/\/?$/, '/');

    await page.goto(`${editBase}contacto/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const email = page.getByLabel('Email', { exact: true }).first();
    // A reused draft may already carry it, and saving an unchanged form confirms nothing.
    if ((await email.inputValue()) !== CONTACT_EMAIL) {
        await email.fill(CONTACT_EMAIL);
        await saveSection({ page, where: 'contacto' });
    }

    // Stage 2 — the photos: the gallery, then the main photo.
    await page.goto(`${editBase}fotos/`, { waitUntil: 'networkidle' });
    await sleep(2000);
    const media = page.locator('#editor-media');
    await scrollToLocator(media, 10, 110);
    await sleep(1000);
    const galleryAdd = page.locator('button[aria-label="Agregar foto"]');
    // The main photo's button reads «Agregar foto» too, but carries no aria-label.
    const featuredButton = page
        .locator('button:not([aria-label])', { hasText: 'Agregar foto' })
        .first();

    rec.mark('stage:fotos');
    rec.mark('keep:galeria');
    await sleep(400);
    const galleryChooser = page.waitForEvent('filechooser');
    await rec.tap('subir-galeria', galleryAdd);
    await (await galleryChooser).setFiles(GALLERY.map(photo));
    await sleep(700);
    rec.mark('keep:galeria:end');
    await media
        .locator('img')
        .nth(GALLERY.length - 1)
        .waitFor({ timeout: 120_000 });
    await sleep(2000);

    rec.mark('keep:galeria-lista');
    await rec.hold('galeria-lista', 1300);
    const featuredChooser = page.waitForEvent('filechooser');
    await rec.tap('subir-principal', featuredButton);
    await (await featuredChooser).setFiles(photo(FEATURED));
    await sleep(700);
    rec.mark('keep:galeria-lista:end');
    await media.locator('img').nth(GALLERY.length).waitFor({ timeout: 120_000 });
    await sleep(2000);
    await scrollToLocator(media, 600, 110);
    rec.mark('keep:fotos-listas');
    await rec.hold('fotos-listas', 2200, media);
    rec.mark('keep:fotos-listas:end');
    const save = page.getByRole('button', { name: 'Guardar', exact: true });
    if ((await save.count()) && (await save.last().isEnabled())) {
        await saveSection({ page, where: 'fotos' });
    }

    // Publish from «Mi comercio» (off camera), then stage 3 on the public page.
    await page.goto(`${WEB}/es/mi-cuenta/comercio/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const row = listingRow(page);
    await row.getByRole('button', { name: 'Publicar', exact: true }).click();
    await row.getByRole('button', { name: 'Sí, publicar' }).click();
    await row.getByText('Publicado', { exact: true }).waitFor({ timeout: 60_000 });
    await page.reload({ waitUntil: 'networkidle' });
    const href = await listingRow(page)
        .getByRole('link', { name: 'Ver ficha pública' })
        .getAttribute('href');
    if (!href) throw new Error('The published listing has no public link.');
    const publicUrl = new URL(href, WEB).toString();
    console.info(`public listing: ${publicUrl}`);
    await page.goto(publicUrl, { waitUntil: 'networkidle' });
    await sleep(2500);
    if (!(await page.getByText(NAME).first().isVisible())) {
        throw new Error(`The public page does not show "${NAME}".`);
    }
    await assertCleanView({ page, where: 'public top' });
    rec.mark('stage:publicada');
    rec.mark('keep:ficha');
    await rec.hold('ficha', 2000);
    await scrollToY(page, 480, 3200);
    await assertCleanView({ page, where: 'public scrolled' });
    await rec.hold('ficha-abajo', 6000);
    rec.mark('keep:ficha:end');

    await rec.finish({ publicUrl });
    await browser.close();
};

await main();
