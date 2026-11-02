/**
 * Records the screencast of video VC3 («Sumá tu local») on staging, logged in as the seeded
 * venue owner, as the reference phone (record/lib/take.ts).
 *
 * - Creates a parrilla from /es/publicar/comer-y-salir/ (staying inside the form, away from the
 *   «Ver planes / Ver precios» block), fills hours, price tier and a contact email off camera,
 *   uploads the Pexels photos (marketing/fotos/vc3, outside the repo) and publishes from
 *   «Mi comercio».
 * - BORROWED SHOT (owner-approved exception, scoped to this one shot): venues have no map yet,
 *   so the stage-2 map pin is filmed on an accommodation's map editor (host-premium's
 *   «Casa Quinta Las Palmeras», `editar/ubicacion/`), logged in as that host by swapping the
 *   session cookies mid-take. Nothing is saved there. The account bar («Mis alojamientos») is
 *   hidden and the take fails if any accommodation wording is visible. Re-record stage 2 on the
 *   venue editor once the venue map ships.
 * - Venue listings cannot be deleted from the UI. When a draft with the take's name already
 *   exists, stage 1 still types into the create form but the take continues on that draft.
 * - The browser spellcheck is off (no red squiggles under the typed text).
 * - The password comes from `VIDEO_LOGIN_PASSWORD` and is never logged.
 *
 * Usage: VIDEO_LOGIN_PASSWORD=… pnpm record:vc3 [take-name] [--dry]
 * `--dry` records stage 1 and the borrowed map shot, and writes nothing.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Cookie, Locator, Page } from 'playwright';
import { assertCleanView, login, saveSection } from './lib/staging';
import { createTake, hideCssOf, launchDevice, scrollToLocator, scrollToY, sleep } from './lib/take';

const WEB = process.env.WEB_URL ?? 'https://staging.hospeda.com.ar';
/** Seeded venue owner on staging (never a super admin). */
const EMAIL = process.env.VIDEO_LOGIN_EMAIL ?? 'venue-owner@local.test';
/** Seeded host whose accommodation map editor lends the borrowed map shot. */
const MAP_HOST_EMAIL = process.env.VC3_MAP_HOST_EMAIL ?? 'host-premium@local.test';
const MAP_HOST_LISTING = 'Casa Quinta Las Palmeras';
/** Resized copies (≤ 2000 px) of the Pexels photos; they live outside the repo. */
const PHOTOS_DIR =
    process.env.VC3_PHOTOS_DIR ?? '/home/qazuor/projects/WEBS/marketing/fotos/vc3/upload';
const FEATURED = '03-parrilla.jpg';
const GALLERY = ['01-exterior.jpg', '02-salon.jpg', '04-asado.jpg', '05-achuras.jpg'];

/** Invented name; no business with it was found in Concepción del Uruguay (2026-11-02). */
const NAME = 'Parrilla Los Talas del Río';
const TYPE = 'Parrilla';
const CITY = 'Concepción del Uruguay';
const SUMMARY = 'Parrilla de barrio con asado a la leña, achuras y mesas bajo los talas.';
const DESCRIPTION =
    'Prendemos el fuego temprano y el asado sale despacio, a la leña. Tenemos achuras, provoleta y ensaladas, y en verano ponemos mesas afuera, bajo los talas. Un lugar tranquilo para comer en familia o con amigos.';
const CONTACT_EMAIL = 'hola.lostalas@example.com';
/** Opening shift copied to every day (off camera). */
const SHIFT = { open: '20:00', close: '23:30' } as const;
/** Visible text that would give the borrowed shot away as an accommodation screen. */
const BORROWED_GIVEAWAY = /alojamiento|propiedad|casa quinta|hu[eé]sped/i;

/** Owner-approved demo staging (REGLAS.md): the trial callouts, which the closing covers. */
const DEMO_HIDE_CSS = hideCssOf(['[class*="trial-callout"]']);

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const rec = createTake({ video: 'vc3', take: args.find((a) => !a.startsWith('--')) ?? 'vc3-test' });

const photo = (file: string): string => {
    const path = join(PHOTOS_DIR, file);
    if (!existsSync(path)) throw new Error(`Missing photo ${path} (set VC3_PHOTOS_DIR).`);
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

/**
 * Logs the map host in on a throwaway context and returns its session cookies plus the map
 * editor URL of its accommodation.
 */
const mapHostSession = async (
    context: BrowserContext
): Promise<{ cookies: Cookie[]; mapUrl: string }> => {
    const browser = context.browser();
    if (!browser) throw new Error('No browser for the map host session.');
    const hostContext = await browser.newContext();
    const page = await hostContext.newPage();
    page.setDefaultNavigationTimeout(90_000);
    await login({ page, web: WEB, email: MAP_HOST_EMAIL, video: 'VC3 map host' });
    await page.goto(`${WEB}/es/mi-cuenta/propiedades/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const href = await page
        .locator('article.prop-card', { hasText: MAP_HOST_LISTING })
        .filter({ hasNotText: 'Ficha borrada' })
        .first()
        .locator('a[href*="/editar/"]')
        .first()
        .getAttribute('href');
    if (!href) throw new Error(`${MAP_HOST_EMAIL} has no "${MAP_HOST_LISTING}" to edit.`);
    const cookies = await hostContext.cookies();
    await hostContext.close();
    return { cookies, mapUrl: `${new URL(href, WEB).toString().replace(/\/?$/, '/')}ubicacion/` };
};

/** Session cookies (Better Auth); everything else, like the cookie consent, is kept on a swap. */
const isAuthCookie = (cookie: Cookie): boolean => /auth|session/i.test(cookie.name);

const switchSession = async (context: BrowserContext, cookies: Cookie[]): Promise<void> => {
    const kept = (await context.cookies()).filter((c) => !isAuthCookie(c));
    await context.clearCookies();
    await context.addCookies([...kept, ...cookies.filter(isAuthCookie)]);
};

/** Turns the browser spellcheck off on every text field of the page (no red squiggles). */
const noSpellcheck = async (page: Page): Promise<void> => {
    await page.evaluate(() => {
        for (const el of document.querySelectorAll('input, textarea')) {
            el.setAttribute('spellcheck', 'false');
        }
    });
};

/** Throws if any visible text in the viewport names an accommodation (borrowed shot guard). */
const assertNoGiveaway = async (page: Page): Promise<void> => {
    const hits = await page.evaluate((source) => {
        const re = new RegExp(source, 'i');
        const out: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const text = walker.currentNode.textContent?.trim();
            const el = walker.currentNode.parentElement;
            if (!text || !el || !re.test(text)) continue;
            const r = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            const shown =
                r.width > 0 &&
                r.bottom > 0 &&
                r.top < innerHeight &&
                style.visibility !== 'hidden' &&
                el.closest('[hidden], [aria-hidden="true"]') === null &&
                el.checkVisibility();
            if (shown) out.push(text.slice(0, 60));
        }
        return out;
    }, BORROWED_GIVEAWAY.source);
    if (hits.length) throw new Error(`Borrowed map shot shows: ${hits.join(' | ')}`);
};

/**
 * BORROWED SHOT — the map pin on an accommodation's map editor, standing in for the venue map
 * that has not shipped yet. Leaves the page without saving.
 */
const recordBorrowedMap = async (input: {
    readonly page: Page;
    readonly context: BrowserContext;
    readonly host: { cookies: Cookie[]; mapUrl: string };
}): Promise<void> => {
    const { page, context, host } = input;
    await switchSession(context, host.cookies);
    await page.goto(host.mapUrl, { waitUntil: 'networkidle' });
    await sleep(2000);
    await page.addStyleTag({ content: '.account-page__nav { display: none !important; }' });
    const map = page.locator('.leaflet-container').first();
    // The map sits at the bottom of the viewport so the reverse-geocoded address under it (which
    // can name nearby businesses) stays off screen.
    await scrollToLocator(map, 10, 415);
    await sleep(1500);
    await assertNoGiveaway(page);
    const mapBox = await map.boundingBox();
    if (!mapBox) throw new Error('Map not visible.');
    const marker = await page.locator('.leaflet-marker-icon').first().boundingBox();
    if (!marker) throw new Error('The map has no pin to move.');
    const from = { x: marker.x + marker.width / 2, y: marker.y + marker.height * 0.4 };
    const to = { x: mapBox.x + mapBox.width * 0.36, y: mapBox.y + mapBox.height * 0.6 };
    rec.mark('keep:mapa');
    await rec.hold('mapa', 900, map);
    // The pin already exists here, so it is dragged (a tap on the map does not move it).
    await rec.tapAt('pin', from.x, from.y);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 24 });
    await page.mouse.up();
    await sleep(300);
    await rec.hold('pin-marcado', 1300, map);
    rec.mark('keep:mapa:end');
    await assertNoGiveaway(page);
};

const main = async (): Promise<void> => {
    const { browser, context, page } = await launchDevice({ origin: WEB, hideCss: DEMO_HIDE_CSS });
    page.on('dialog', (dialog) => void dialog.accept());
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(45_000);
    const host = await mapHostSession(context);
    await login({ page, web: WEB, email: EMAIL, video: 'VC3' });
    const venueCookies = await context.cookies();
    const draft = await existingDraft(page);
    if (draft) console.info(`reusing the existing draft "${NAME}"`);

    await page.goto(`${WEB}/es/publicar/comer-y-salir/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    // With a draft in progress the page first offers «Retomar» or «Crear una nueva» (a link).
    const createNew = page.getByRole('link', { name: 'Crear una nueva' });
    if (await createNew.count()) {
        await createNew.click();
        await page.waitForLoadState('networkidle');
        await sleep(1500);
    }
    await noSpellcheck(page);
    const nameField = page.locator('#cc-name');
    await scrollToLocator(page.locator('label[for="cc-name"]'), 10, 140);
    await sleep(800);

    await rec.start(context, page);
    await sleep(500);

    // Stage 1 — what the place is: name and category, then (jump) the summary.
    rec.mark('stage:local');
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
    if (DRY) {
        rec.mark('stage:fotos');
        await recordBorrowedMap({ page, context, host });
        await switchSession(context, venueCookies);
        await rec.finish({ dry: true });
        await browser.close();
        return;
    }
    if (draft) {
        await page.goto(draft, { waitUntil: 'networkidle' });
    } else {
        await page.getByRole('button', { name: 'Crear comercio' }).click();
        await page.waitForURL(/\/editar\/?$/, { timeout: 60_000 });
        await page.waitForLoadState('networkidle');
    }
    const editBase = page.url().replace(/\/?$/, '/');

    // Off camera: what publishing needs besides the photos (contact, hours, price tier).
    await page.goto(`${editBase}contacto/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const email = page.getByLabel('Email', { exact: true }).first();
    if ((await email.inputValue()) !== CONTACT_EMAIL) {
        await email.fill(CONTACT_EMAIL);
        await saveSection({ page, where: 'contacto' });
    }
    await page.goto(`${editBase}horarios/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const friClosed = page.getByLabel('Vie cerrado');
    if (await friClosed.isChecked()) {
        await friClosed.uncheck();
        await page.getByRole('button', { name: 'Agregar turno Vie' }).click();
        await page.getByLabel('Vie apertura 1').fill(SHIFT.open);
        await page.getByLabel('Vie cierre 1').fill(SHIFT.close);
        await page.getByRole('button', { name: /: Vie$/ }).click();
        await saveSection({ page, where: 'horarios' });
    }
    await page.goto(`${editBase}precio/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const tier = page.locator('#editor-price select').first();
    if (!(await tier.inputValue())) {
        await tier.selectOption({ index: 2 });
        await saveSection({ page, where: 'precio' });
    }

    // Stage 2 — the gallery, the (borrowed) map pin, then the main photo.
    const openPhotos = async (): Promise<Locator> => {
        await page.goto(`${editBase}fotos/`, { waitUntil: 'networkidle' });
        await sleep(2000);
        const media = page.locator('#editor-media');
        await scrollToLocator(media, 10, 110);
        await sleep(1000);
        return media;
    };
    let media = await openPhotos();
    // A reused draft keeps the photos of the take that created it: clear them off camera.
    const remove = media.locator('button[aria-label="Eliminar"]');
    if (await remove.count()) {
        while (await remove.count()) {
            await remove.first().click();
            await sleep(600);
        }
        await saveSection({ page, where: 'fotos (limpieza)' });
        media = await openPhotos();
    }
    rec.mark('stage:fotos');
    rec.mark('keep:galeria');
    await sleep(400);
    const galleryChooser = page.waitForEvent('filechooser');
    await rec.tap('subir-galeria', page.locator('button[aria-label="Agregar foto"]'));
    await (await galleryChooser).setFiles(GALLERY.map(photo));
    await sleep(700);
    await media
        .locator('img')
        .nth(GALLERY.length - 1)
        .waitFor({ timeout: 120_000 });
    await sleep(1500);
    rec.mark('keep:galeria:end');
    const save = page.getByRole('button', { name: 'Guardar', exact: true });
    if ((await save.count()) && (await save.last().isEnabled())) {
        await saveSection({ page, where: 'fotos (galería)' });
    }

    await recordBorrowedMap({ page, context, host });
    await switchSession(context, venueCookies);

    media = await openPhotos();
    rec.mark('keep:principal');
    await rec.hold('galeria-lista', 900);
    const featuredChooser = page.waitForEvent('filechooser');
    // The main photo's button reads «Agregar foto» too, but carries no aria-label.
    await rec.tap(
        'subir-principal',
        page.locator('button:not([aria-label])', { hasText: 'Agregar foto' }).first()
    );
    await (await featuredChooser).setFiles(photo(FEATURED));
    await sleep(700);
    rec.mark('keep:principal:end');
    await media.locator('img').nth(GALLERY.length).waitFor({ timeout: 120_000 });
    await sleep(2000);
    await scrollToLocator(media, 600, 110);
    rec.mark('keep:fotos-listas');
    await rec.hold('fotos-listas', 2200, media);
    rec.mark('keep:fotos-listas:end');
    if ((await save.count()) && (await save.last().isEnabled())) {
        await saveSection({ page, where: 'fotos' });
    }

    // Publish from «Mi comercio» (off camera), then stage 3 on the public page.
    await page.goto(`${WEB}/es/mi-cuenta/comercio/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    const row = listingRow(page);
    // The publish island hydrates when it scrolls into view; a click before that is lost.
    await row.scrollIntoViewIfNeeded();
    await sleep(2500);
    const confirm = row.getByRole('button', { name: 'Sí, publicar' });
    for (let i = 0; i < 4 && !(await confirm.isVisible()); i++) {
        await row.getByRole('button', { name: 'Publicar', exact: true }).click();
        await confirm.waitFor({ timeout: 5000 }).catch(() => undefined);
    }
    await confirm.click();
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
    rec.mark('stage:publicado');
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
