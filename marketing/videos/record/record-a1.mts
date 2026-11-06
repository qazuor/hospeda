/**
 * Records the "create a new accommodation" flow (video A1) on staging, logged in as a seeded
 * host, on the reference phone (config/device.ts: the visible page area of a Galaxy S24 Ultra,
 * 412 × 750 CSS px, at DPR 3) through record/lib/take.ts.
 *
 * - The story: «Mis propiedades» → «Publicar otra» → the creation form (name, type, city,
 *   summary) → the editor hub → basic info, where the long description is typed and saved →
 *   (off camera: capacity and the map pin) → the photos (gallery, then the main photo, which
 *   opens the publish prompt) → «Publicar ahora» → the public listing.
 * - Publishing starts the account's 30-day trial with no card. The take stops if the prompt
 *   does not offer «Publicar ahora» or anything lands on the payment provider: nothing is paid.
 * - Off-camera work is bracketed by `off` / `off:end` marks (cut with a wipe) and waits on
 *   screen by `skip` / `skip:end` (cut with a jump); see src/a1/timeline.ts.
 * - Staging differs from the old local seed: the account's existing listing is a seed test card
 *   (test name, a price, a plan badge, a stock photo), so the properties list hides the cards
 *   (owner-approved demo staging, listed in DEMO_HIDE_CSS), and the site footer with them,
 *   which the then-short page would bring into view.
 * - A listing with the take's name left by an earlier take is deleted first through the UI
 *   («Eliminar» → «Sí, eliminar»), so /publicar/ shows the form and not the «draft in progress»
 *   panel.
 * - The password comes from `VIDEO_LOGIN_PASSWORD` and is never logged.
 *
 * Output: <recordings>/a1/<take>/ (frames, events.json, screen.mp4, first.png, last.png), with
 * the edit-ready files copied to <public>/a1/.
 *
 * Usage: VIDEO_LOGIN_PASSWORD=… pnpm record:a1 [take-name]
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from 'playwright';
import { resolveAssetPaths } from '../config/asset-paths';
import { assertCleanView, login, photosDirOf, saveSection } from './lib/staging';
import { createTake, hideCssOf, launchDevice, scrollToLocator, scrollToY, sleep } from './lib/take';

const WEB = process.env.WEB_URL ?? 'https://staging.hospeda.com.ar';
/**
 * Seeded host on staging (never a super admin) whose accommodation trial is still unused, so
 * publishing starts it instead of asking for a payment. `host-basico` and `host-premium` are at
 * their plan's listing limit (/publicar/ shows «Llegaste al límite de tu plan»), and `host-pro`
 * spent its trial on an earlier take.
 */
const EMAIL = process.env.VIDEO_LOGIN_EMAIL ?? 'host-venue@local.test';
/** Matches the photos: one country house with a fenced pool and a large park. */
const DEMO_NAME = 'Casa de Campo El Ceibo';
/** The owner's photos (VC1's set, outside the repo). */
const PHOTOS_DIR = photosDirOf({ video: 'vc1' });
const FEATURED = '01-exterior.jpg';
const GALLERY = ['02-pileta.jpg', '03-living.jpg'];
/** Off camera: what publishing needs besides the description and the photos. No price. */
const CAPACITY = { guests: '4', bedrooms: '2', baths: '1' } as const;

/** Owner-approved demo staging (REGLAS.md): every hidden element is listed here. */
const DEMO_HIDE_CSS = hideCssOf([
    '.props-page__needs-plan', // "Sos anfitrión en preparación" plan banner
    'article.prop-card', // the account's seed test cards (test name, price, plan badge)
    'footer.footer', // site footer (social-network icons); with the cards hidden the list page is short
    '[class*="trial-callout"]', // "Probá Hospeda gratis por 30 días" callouts on /publicar/
    'form div[class*="_locked_"]', // "Función premium" box in the editor
    'div[class*="_formatUpsell_"]' // "Texto con formato… Mejorar plan" notice
]);

/**
 * Turns spellcheck off on every field, also those islands render later: squiggles under typed
 * Spanish look like errors on camera. A string, because tsx rewrites function literals with a
 * `__name` helper that does not exist inside the page.
 */
const NO_SPELLCHECK = `
    (() => {
        const tick = () => {
            for (const el of document.querySelectorAll('input:not([spellcheck="false"]), textarea:not([spellcheck="false"]), [contenteditable]:not([spellcheck="false"])')) {
                el.setAttribute('spellcheck', 'false');
            }
        };
        setInterval(tick, 100);
    })();
`;

const rec = createTake({ video: 'a1', take: process.argv[2] ?? 'a1-test' });

/**
 * Smoothly scrolls the target into a comfortable band of the viewport, only if it is outside it.
 * Playwright's own scrollIntoViewIfNeeded jumps instantly, which reads as a jerk on camera.
 */
const smoothIntoView = async (loc: Locator): Promise<void> => {
    const moved = await loc.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = 140;
        const bottom = window.innerHeight - 160;
        if (r.top >= top && r.bottom <= bottom) return false;
        window.scrollBy({ top: r.top + r.height / 2 - window.innerHeight / 2, behavior: 'smooth' });
        return true;
    });
    if (moved) await sleep(900);
};

const tap = async (label: string, loc: Locator, { alignBottom = false } = {}): Promise<void> => {
    if (alignBottom) {
        // Pin the target to the bottom edge so the dark site footer below it stays out of frame.
        await loc.evaluate((el) => el.scrollIntoView({ block: 'end', behavior: 'smooth' }));
        await sleep(900);
    } else {
        await smoothIntoView(loc);
    }
    await sleep(150);
    await rec.tap(label, loc);
};

const typeInto = async (label: string, loc: Locator, text: string, delay = 55): Promise<void> => {
    await smoothIntoView(loc);
    await sleep(300);
    await loc.evaluate((el) => el.setAttribute('spellcheck', 'false'));
    await loc.tap();
    // Some fields come prefilled (the draft's description stub); start from empty.
    await loc.fill('');
    await rec.type(label, loc, text, delay);
};

/** Deletes a draft with the take's name left by an earlier take, through the UI. */
const deleteLeftover = async (page: Page): Promise<void> => {
    for (let i = 0; i < 3; i++) {
        await page.goto(`${WEB}/es/mi-cuenta/propiedades/`, { waitUntil: 'networkidle' });
        await sleep(1500);
        const card = page
            .locator('article.prop-card', { hasText: DEMO_NAME })
            .filter({ hasNotText: 'Ficha borrada' })
            .first();
        if ((await card.count()) === 0) return;
        console.info(`deleting leftover "${DEMO_NAME}"`);
        // The cards are hidden by the demo CSS; this one is shown again to reach its buttons.
        await card.evaluate((el) => el.style.setProperty('display', 'block', 'important'));
        await card.getByRole('button', { name: 'Eliminar' }).click();
        await card.getByRole('button', { name: 'Sí, eliminar' }).click();
        await page.waitForLoadState('load');
        await sleep(3000);
    }
    throw new Error(`Could not delete the leftover "${DEMO_NAME}".`);
};

/**
 * Writes the intro and closing stills next to the take and copies them to <public>/a1/: the
 * first one is the frame the edit opens on (1.5 s before the first tap, as src/a1/timeline.ts
 * trims it), the last one the page after the save.
 */
const writeStills = (): void => {
    const { outDir } = rec;
    const { events } = JSON.parse(readFileSync(join(outDir, 'events.json'), 'utf8')) as {
        events: { label: string; t: number }[];
    };
    const firstTap = events.find((e) => e.label === 'publicar-otra');
    const at = Math.max(0.4, (firstTap?.t ?? 1.6) - 1.5);
    execFileSync(
        'ffmpeg',
        [
            '-y',
            '-loglevel',
            'error',
            '-ss',
            at.toFixed(3),
            '-i',
            'screen.mp4',
            '-frames:v',
            '1',
            'first.png'
        ],
        { cwd: outDir, stdio: 'inherit' }
    );
    const editDir = join(resolveAssetPaths().publicDir, 'a1');
    copyFileSync(join(outDir, 'first.png'), join(editDir, 'first.png'));
    copyFileSync(join(outDir, 'last.png'), join(editDir, 'last.png'));
};

const main = async (): Promise<void> => {
    const { browser, context, page } = await launchDevice({ origin: WEB, hideCss: DEMO_HIDE_CSS });
    await context.addInitScript(NO_SPELLCHECK);
    page.setDefaultNavigationTimeout(90_000);
    page.setDefaultTimeout(45_000);
    await login({ page, web: WEB, email: EMAIL, video: 'A1' });
    await deleteLeftover(page);
    await page.goto(`${WEB}/es/mi-cuenta/propiedades/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await assertCleanView({ page, where: 'properties list' });

    await rec.start(context, page);

    // Stage 1 — properties list, then into the creation form.
    rec.mark('stage:propiedades');
    await rec.hold('lista', 2000);
    await tap('publicar-otra', page.locator('a.props-page__cta-btn').first());
    await page.waitForURL(/\/es\/publicar\//);
    await page.waitForLoadState('networkidle');
    await assertCleanView({ page, where: 'publish form' });
    rec.mark('stage:crear');
    await rec.hold('form', 1500);

    await typeInto('nombre', page.getByLabel('Nombre del alojamiento'), DEMO_NAME);
    await rec.hold('pausa', 500);

    await tap('tipo', page.getByTestId('property-type-input'));
    await rec.hold('opciones-tipo', 700);
    await tap(
        'tipo-casa-de-campo',
        page.getByRole('option', { name: 'Casa de campo', exact: true })
    );
    await rec.hold('pausa', 500);

    await typeInto('ciudad', page.getByTestId('property-city-input'), 'Colón', 110);
    const cityOption = page.locator('[data-testid^=property-city-option-]').first();
    await cityOption.waitFor({ timeout: 15_000 });
    await rec.hold('opciones-ciudad', 700);
    await tap('ciudad-colon', cityOption);
    await rec.hold('pausa', 500);

    await typeInto(
        'resumen',
        page.getByLabel('Descripción corta'),
        'Casa de campo para 4 personas, con pileta y un parque enorme.',
        40
    );
    await rec.hold('pausa', 700);

    await tap('crear', page.getByRole('button', { name: 'Crear borrador y seguir al paso 2' }));
    await page.waitForURL(/\/editar\/$/, { timeout: 60_000 });
    await page.waitForLoadState('networkidle');
    await assertCleanView({ page, where: 'editor hub' });

    // Stage 2 — the editor hub, then basic info to add the long description.
    rec.mark('stage:hub');
    await rec.hold('hub', 2200);
    await tap('info-basica', page.locator('a[href$="/editar/datos/"]:visible').first());
    await page.waitForURL(/\/editar\/datos\/$/);
    await page.waitForLoadState('networkidle');
    rec.mark('stage:datos');
    await rec.hold('datos', 1200);

    await typeInto(
        'descripcion',
        page.locator('#acc-description'),
        'Casa de una planta rodeada de verde y tranquilidad. Living comedor luminoso, cocina equipada, dormitorio con cama matrimonial y un parque amplio con pileta cercada y hamacas para los chicos.',
        28
    );
    await rec.hold('pausa', 700);

    await assertCleanView({ page, where: 'basic info' });
    await tap('guardar', page.getByRole('button', { name: 'Guardar', exact: true }).last(), {
        alignBottom: true
    });
    await page.getByText('Cambios guardados').first().waitFor({ timeout: 30_000 });
    rec.mark('toast:guardado');
    await rec.hold('guardado', 1800);
    const editBase = page.url().replace(/datos\/?$/, '');

    // Off camera: capacity and the map pin.
    rec.mark('off');
    await page.goto(`${editBase}capacidad-precio/`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await page.getByLabel('Huéspedes máx.').fill(CAPACITY.guests);
    await page.getByLabel('Dormitorios').fill(CAPACITY.bedrooms);
    await page.getByLabel('Baños').fill(CAPACITY.baths);
    await saveSection({ page, where: 'capacidad' });
    await page.goto(`${editBase}ubicacion/`, { waitUntil: 'networkidle' });
    await sleep(2000);
    const map = page.locator('.leaflet-container').first();
    await scrollToLocator(map, 10, 300);
    await sleep(1500);
    const mapBox = await map.boundingBox();
    if (!mapBox) throw new Error('Map not visible.');
    await page.mouse.click(mapBox.x + mapBox.width * 0.62, mapBox.y + mapBox.height * 0.4);
    await sleep(1500);
    if (!(await page.getByLabel('Latitud').inputValue())) {
        throw new Error('The map tap did not set the coordinates.');
    }
    await saveSection({ page, where: 'ubicacion' });

    // Stage 3 — the photos: the gallery, then the main photo, which opens the publish prompt.
    await page.goto(`${editBase}fotos/`, { waitUntil: 'networkidle' });
    await sleep(2000);
    const featuredButton = page
        .locator('#featured-image-input')
        .locator('xpath=..')
        .locator('button')
        .first();
    // Demo staging: the «Videos» block under the gallery names three video platforms.
    await page
        .locator('form', { has: page.getByRole('heading', { name: 'Videos', exact: true }) })
        .evaluateAll((forms) => {
            for (const f of forms)
                (f as HTMLElement).style.setProperty('display', 'none', 'important');
        });
    await scrollToLocator(featuredButton, 10, 150);
    await sleep(1000);
    await assertCleanView({ page, where: 'photos' });
    rec.mark('off:end');
    const galleryAdd = page.getByRole('button', { name: 'Agregar fotos a la galería' });
    const galleryImages = galleryAdd.locator('xpath=..').locator('img');
    rec.mark('stage:fotos');
    await rec.hold('fotos', 900);
    const galleryChooser = page.waitForEvent('filechooser');
    await tap('subir-galeria', galleryAdd);
    await (await galleryChooser).setFiles(GALLERY.map((f) => join(PHOTOS_DIR, f)));
    await sleep(900);
    rec.mark('skip');
    await galleryImages.nth(GALLERY.length - 1).waitFor({ timeout: 90_000 });
    await sleep(1200);
    rec.mark('skip:end');
    await rec.hold('galeria-lista', 1300);
    const featuredChooser = page.waitForEvent('filechooser');
    await tap('subir-principal', featuredButton);
    await (await featuredChooser).setFiles(join(PHOTOS_DIR, FEATURED));
    await sleep(900);
    rec.mark('skip');
    const dialog = page.getByRole('dialog', { name: 'Tu ficha ya está lista' });
    await dialog.waitFor({ timeout: 90_000 }).catch(() => {
        throw new Error('No publish prompt after the main photo (plan limit or missing field).');
    });
    const publishNow = dialog.getByRole('button', { name: 'Publicar ahora' });
    if ((await publishNow.count()) === 0) {
        throw new Error(
            'The publish prompt offers no «Publicar ahora»: stopping before any payment.'
        );
    }
    await sleep(900);
    rec.mark('skip:end');
    rec.mark('stage:publicar');
    await rec.hold('dialogo', 1600, dialog);
    await tap('publicar', publishNow);
    await sleep(600);

    // Off camera: from «Mis propiedades» to the public listing.
    rec.mark('off');
    await page.waitForURL(/\/mi-cuenta\/propiedades\/?$|mercadopago/, { timeout: 60_000 });
    if (/mercadopago/.test(page.url())) {
        throw new Error('Publishing went to the payment provider: stopping, nothing is paid.');
    }
    await page.waitForLoadState('networkidle');
    const card = page
        .locator('article.prop-card', { hasText: DEMO_NAME })
        .filter({ hasNotText: 'Ficha borrada' })
        .first();
    const href = await card.locator('a[href*="/alojamientos/"]').first().getAttribute('href');
    if (!href) throw new Error('The published card has no public link.');
    const publicUrl = new URL(href, WEB).toString();
    console.info(`public listing: ${publicUrl}`);
    await page.goto(publicUrl, { waitUntil: 'networkidle' });
    await sleep(2500);
    if (!(await page.getByText(DEMO_NAME).first().isVisible())) {
        throw new Error(`The public page does not show "${DEMO_NAME}".`);
    }
    await assertCleanView({ page, where: 'public top' });
    rec.mark('off:end');

    // Stage 4 — the published listing, as a tourist sees it.
    rec.mark('stage:ficha');
    await rec.hold('ficha', 2200);
    await scrollToY(page, 520, 3200);
    await assertCleanView({ page, where: 'public scrolled' });
    await rec.hold('ficha-abajo', 4500);
    rec.mark('ficha:end');

    await page.screenshot({ path: join(rec.outDir, 'last.png') });
    await rec.finish({ account: EMAIL, publicUrl });
    await browser.close();
    writeStills();
};

await main();
