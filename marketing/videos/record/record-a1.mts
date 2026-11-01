/**
 * Records the "create a new accommodation" flow on the reference phone's viewport (config/device.ts:
 * the visible page area of a Galaxy S24 Ultra, 412 × 750 CSS px) at DPR 3.
 *
 * Output (in <recordings dir>/<take>/, outside the repo — see config/asset-paths.ts):
 * - frames/NNNNN.jpg + frames.json  raw CDP screencast frames with their timestamps
 * - events.json                     timeline of actions (taps, typing, holds) with target boxes
 *                                   in device pixels, used by the Remotion composition to zoom.
 *
 * Usage: pnpm record:a1 [take-name]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { resolveAssetPaths } from '../config/asset-paths';
import { REFERENCE_DEVICE } from '../config/device';

const WEB = process.env.WEB_URL ?? 'http://localhost:4422';
/** Seeded local test user (packages/seed, `pnpm db:fresh-dev`); not a real credential. */
const DEMO_USER = { email: 'host-basico@local.test', password: 'Password123!' } as const;
const DB_NAME = process.env.DB_NAME ?? 'worktree_hospeda2';
const DEMO_NAME = 'Cabañas Costa del Río';
const DPR = REFERENCE_DEVICE.recordDpr;
/** Name shown for the host's already-published listing on the properties page. */
const EXISTING_LISTING = {
    id: '5f3f3516-95b9-4237-a656-b24b3c8ada3b',
    name: 'Casa Quinta Las Palmeras'
} as const;

const DEMO_HIDE_CSS = [
    '.props-page__needs-plan', // "Sos anfitrión en preparación" plan banner
    '.prop-card__qr', // printable QR block on the property card
    '[class*="trial-callout"]', // "Probá Hospeda gratis por 30 días" callouts on /publicar/
    'form div[class*="_locked_"]', // "Función premium" box in the editor
    'div[class*="_formatUpsell_"]' // "Texto con formato… Mejorar plan" notice
]
    .map((s) => `${s}{display:none!important}`)
    .join('\n');
const VIEWPORT = REFERENCE_DEVICE.viewport;

const take = process.argv[2] ?? 'a1-test';
const outDir = join(resolveAssetPaths().recordingsDir, take);
const framesDir = join(outDir, 'frames');
mkdirSync(framesDir, { recursive: true });

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type TimelineEvent = {
    readonly t: number;
    readonly end?: number;
    readonly kind: 'mark' | 'tap' | 'type' | 'hold';
    readonly label: string;
    readonly box?: Box;
};

const events: TimelineEvent[] = [];
const frames: { file: string; ts: number }[] = [];
let t0 = 0;
const now = (): number => Date.now() / 1000 - t0;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const boxOf = async (loc: Locator): Promise<Box | undefined> => {
    const b = await loc.boundingBox();
    return b ? { x: b.x * DPR, y: b.y * DPR, w: b.width * DPR, h: b.height * DPR } : undefined;
};

const mark = (label: string): void => {
    events.push({ t: now(), kind: 'mark', label });
};

const hold = async (label: string, ms: number): Promise<void> => {
    const t = now();
    await sleep(ms);
    events.push({ t, end: now(), kind: 'hold', label });
};

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
    await sleep(350);
    const box = await boxOf(loc);
    events.push({ t: now(), kind: 'tap', label, box });
    await sleep(250);
    await loc.tap();
};

const typeInto = async (label: string, loc: Locator, text: string, delay = 55): Promise<void> => {
    await smoothIntoView(loc);
    await sleep(300);
    const box = await boxOf(loc);
    // Islands hydrate after the init script, so disable spellcheck on the field itself too.
    await loc.evaluate((el) => el.setAttribute('spellcheck', 'false'));
    await loc.tap();
    // Some fields come prefilled (the draft's description stub); start from empty.
    await loc.fill('');
    const t = now();
    await loc.pressSequentially(text, { delay });
    events.push({ t, end: now(), kind: 'type', label, box });
};

const login = async (page: Page): Promise<void> => {
    // Wait for hydration: submitting before React attaches posts the native form as a GET.
    await page.goto(`${WEB}/es/auth/signin/`, { waitUntil: 'networkidle' });
    await sleep(1000);
    await page.locator('#signin-email').fill(DEMO_USER.email);
    await page.locator('#signin-password').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL((u) => !u.pathname.includes('/auth/'), { timeout: 30_000 });
};

/** Removes drafts left by previous takes so /publicar/ shows the form, not the "draft in progress" panel. */
const resetDrafts = (): void => {
    const sql = [
        `delete from accommodations where name='${DEMO_NAME}' and publication_status='DRAFT'`,
        `update accommodations set name='${EXISTING_LISTING.name}' where id='${EXISTING_LISTING.id}'`
    ].join('; ');
    const out = execFileSync('docker', [
        'exec',
        'hospeda-postgres',
        'sh',
        '-c',
        `psql -U "$POSTGRES_USER" -d ${DB_NAME} -c "${sql}"`
    ]);
    console.info(`reset: ${out.toString().trim()}`);
};

const main = async (): Promise<void> => {
    resetDrafts();
    // Only new-headless Chromium with a forced scale factor screencasts at device pixels;
    // the default headless shell ignores deviceScaleFactor and yields frames at CSS size.
    const browser = await chromium.launch({
        channel: 'chromium',
        args: [`--force-device-scale-factor=${DPR}`]
    });
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DPR,
        isMobile: true,
        hasTouch: true,
        locale: 'es-AR'
    });
    const consent = encodeURIComponent(
        JSON.stringify({
            necessary: true,
            crashReporting: false,
            analytics: false,
            marketing: false,
            version: 2,
            decidedAt: '2026-01-01T00:00:00.000Z'
        })
    );
    await context.addCookies([{ name: 'cookie-consent', value: consent, url: WEB }]);
    // Demo staging: hide upsell / plan banners that read as ads or errors in a tutorial.
    // Owner-approved (see REGLAS.md); every hidden element is listed here and nothing else changes.
    // Client-side navigations swap <head> and <body>, so the style hangs off <html> and is re-added if lost.
    // Init scripts go in as plain strings: tsx rewrites function literals with a `__name` helper
    // that does not exist inside the page, and the script then throws silently.
    // Also turns spellcheck off everywhere: squiggles under typed Spanish look like errors on camera.
    await context.addInitScript(`
        (() => {
            const css = ${JSON.stringify(DEMO_HIDE_CSS)};
            const tick = () => {
                if (!document.documentElement) return;
                if (!document.getElementById('demo-hide')) {
                    const style = document.createElement('style');
                    style.id = 'demo-hide';
                    style.textContent = css;
                    document.documentElement.append(style);
                }
                // Only untouched fields: rewriting the attribute every tick forces restyles and drops frames.
                for (const el of document.querySelectorAll('input:not([spellcheck="false"]), textarea:not([spellcheck="false"]), [contenteditable]:not([spellcheck="false"])')) {
                    el.setAttribute('spellcheck', 'false');
                }
            };
            setInterval(tick, 100);
            tick();
        })();
    `);
    const page = await context.newPage();

    await login(page);
    await page.goto(`${WEB}/es/mi-cuenta/propiedades/`, { waitUntil: 'networkidle' });
    await sleep(1500);

    const cdp = await context.newCDPSession(page);
    cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
        const file = `${String(frames.length).padStart(5, '0')}.jpg`;
        writeFileSync(join(framesDir, file), Buffer.from(data, 'base64'));
        frames.push({ file, ts: (metadata.timestamp ?? Date.now() / 1000) - t0 });
        await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
    });
    t0 = Date.now() / 1000;
    await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 92,
        maxWidth: VIEWPORT.width * DPR,
        maxHeight: VIEWPORT.height * DPR,
        everyNthFrame: 1
    });

    // Stage 1 — properties list, then into the creation form.
    mark('stage:propiedades');
    await hold('lista', 2000);
    await tap('publicar-otra', page.locator('a.props-page__cta-btn').first());
    await page.waitForURL(/\/es\/publicar\//);
    await page.waitForLoadState('networkidle');
    mark('stage:crear');
    await hold('form', 1500);

    await typeInto('nombre', page.getByLabel('Nombre del alojamiento'), DEMO_NAME);
    await hold('pausa', 500);

    await tap('tipo', page.getByTestId('property-type-input'));
    await hold('opciones-tipo', 700);
    await tap('tipo-cabana', page.getByRole('option', { name: 'Cabaña', exact: true }));
    await hold('pausa', 500);

    await typeInto('ciudad', page.getByTestId('property-city-input'), 'Colón', 110);
    const cityOption = page.locator('[data-testid^=property-city-option-]').first();
    await cityOption.waitFor({ timeout: 15_000 });
    await hold('opciones-ciudad', 700);
    await tap('ciudad-colon', cityOption);
    await hold('pausa', 500);

    await typeInto(
        'resumen',
        page.getByLabel('Descripción corta'),
        'Cabañas para 4 personas a 300 metros del río, con parrilla y pileta.',
        40
    );
    await hold('pausa', 700);

    await tap('crear', page.getByRole('button', { name: 'Crear borrador y seguir al paso 2' }));
    await page.waitForURL(/\/editar\/$/, { timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    // Stage 2 — the editor hub, then basic info to add the long description.
    mark('stage:hub');
    await hold('hub', 2200);
    await tap('info-basica', page.locator('a[href$="/editar/datos/"]:visible').first());
    await page.waitForURL(/\/editar\/datos\/$/);
    await page.waitForLoadState('networkidle');
    mark('stage:datos');
    await hold('datos', 1200);

    await typeInto(
        'descripcion',
        page.locator('#acc-description'),
        'Tres cabañas de madera rodeadas de verde, a pasos de la playa. Cada una tiene dos dormitorios, cocina equipada, aire acondicionado y galería con vista al parque.',
        28
    );
    await hold('pausa', 700);

    await tap('guardar', page.getByRole('button', { name: 'Guardar' }), { alignBottom: true });
    await page.getByText('Cambios guardados').first().waitFor({ timeout: 15_000 });
    mark('toast:guardado');
    await hold('final', 2500);

    await cdp.send('Page.stopScreencast');
    mark('end');
    await sleep(300);

    writeFileSync(join(outDir, 'frames.json'), JSON.stringify(frames, null, 2));
    writeFileSync(
        join(outDir, 'events.json'),
        JSON.stringify({ dpr: DPR, viewport: VIEWPORT, duration: now(), events }, null, 2)
    );
    await page.screenshot({ path: join(outDir, 'last.png') });
    await browser.close();
    console.info(`frames=${frames.length} duration=${now().toFixed(1)}s → ${outDir}`);
};

await main();
