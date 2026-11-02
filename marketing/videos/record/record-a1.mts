/**
 * Records the "create a new accommodation" flow (video A1) on staging, logged in as a seeded
 * host, on the reference phone (config/device.ts: the visible page area of a Galaxy S24 Ultra,
 * 412 × 750 CSS px, at DPR 3) through record/lib/take.ts.
 *
 * - The story is unchanged: «Mis propiedades» → «Publicar otra» → the creation form (name, type,
 *   city, summary) → the editor hub → basic info, where the long description is typed and saved.
 *   Nothing is published: the take leaves a DRAFT behind.
 * - Staging differs from the old local seed: the account's existing listing is a seed test card
 *   (test name, a price, a plan badge, a stock photo), so the properties list hides the cards
 *   (owner-approved demo staging, listed in DEMO_HIDE_CSS), and the site footer with them,
 *   which the then-short page would bring into view.
 * - A draft with the take's name left by an earlier take is deleted first through the UI
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
import { assertCleanView, login } from './lib/staging';
import { createTake, hideCssOf, launchDevice, sleep } from './lib/take';

const WEB = process.env.WEB_URL ?? 'https://staging.hospeda.com.ar';
/**
 * Seeded host on staging (never a super admin). `host-basico` and `host-premium` are at their
 * plan's listing limit there, so /publicar/ shows «Llegaste al límite de tu plan» instead of the form.
 */
const EMAIL = process.env.VIDEO_LOGIN_EMAIL ?? 'host-pro@local.test';
const DEMO_NAME = 'Cabañas Costa del Río';

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
    await tap('tipo-cabana', page.getByRole('option', { name: 'Cabaña', exact: true }));
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
        'Cabañas para 4 personas a 300 metros del río, con parrilla y pileta.',
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
        'Tres cabañas de madera rodeadas de verde, a pasos de la playa. Cada una tiene dos dormitorios, cocina equipada, aire acondicionado y galería con vista al parque.',
        28
    );
    await rec.hold('pausa', 700);

    await assertCleanView({ page, where: 'basic info' });
    await tap('guardar', page.getByRole('button', { name: 'Guardar', exact: true }).last(), {
        alignBottom: true
    });
    await page.getByText('Cambios guardados').first().waitFor({ timeout: 30_000 });
    rec.mark('toast:guardado');
    await rec.hold('final', 2500);

    await page.screenshot({ path: join(rec.outDir, 'last.png') });
    await rec.finish({ account: EMAIL });
    await browser.close();
    writeStills();
};

await main();
