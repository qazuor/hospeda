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
 * Output:
 * - <recordings dir>/<take>/frames/NNNNN.jpg + frames.json + concat.txt + events.json + screen.mp4
 * - <public dir>/vc5/screen.mp4 + events.json (edit-ready copy read by src/vc5/)
 *
 * Usage: pnpm record:vc5 [take-name]   (LISTING_URL overrides the page)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import { resolveAssetPaths } from '../config/asset-paths';
import { REFERENCE_DEVICE } from '../config/device';

/** Public listing recorded by default (owner permission granted). */
const DEFAULT_LISTING_URL = 'https://hospeda.com.ar/es/alojamientos/cabin-ruca-lihuen-cabanas/';
const LISTING_URL = process.env.LISTING_URL ?? DEFAULT_LISTING_URL;
const DPR = REFERENCE_DEVICE.recordDpr;
const VIEWPORT = REFERENCE_DEVICE.viewport;
/** Height of the sticky site header, CSS px: scroll targets land just below it. */
const HEADER_OFFSET = 88;

/** Demo staging: nothing to hide on this page today; kept so a future upsell can be listed here. */
const DEMO_HIDE_CSS: string = [].join('\n');

const take = process.argv[2] ?? 'vc5-test';
const { recordingsDir, publicDir } = resolveAssetPaths();
const outDir = join(recordingsDir, 'vc5', take);
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
    if (!b) return undefined;
    // Clip to the viewport: a tall block only counts for the part the camera can see.
    const top = Math.max(0, b.y);
    const bottom = Math.min(VIEWPORT.height, b.y + b.height);
    return { x: b.x * DPR, y: top * DPR, w: b.width * DPR, h: Math.max(0, bottom - top) * DPR };
};

const mark = (label: string): void => {
    events.push({ t: now(), kind: 'mark', label });
};

/** Holds still; with a target, the composition focuses the camera and spotlight on it. */
const hold = async (label: string, ms: number, target?: Locator): Promise<void> => {
    const box = target ? await boxOf(target) : undefined;
    const t = now();
    await sleep(ms);
    events.push({ t, end: now(), kind: 'hold', label, ...(box ? { box } : {}) });
};

/**
 * Scrolls the document so `selector` sits just below the sticky header, with a sine ease over
 * `ms` (Chrome's native smooth scroll whips through long distances). `ms = 0` jumps.
 * Page scripts go in as strings: tsx injects a `__name` helper that does not exist in the page.
 */
const scrollToSelector = async (page: Page, selector: string, ms: number): Promise<void> => {
    await page.evaluate(`
        new Promise((done) => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) { done(false); return; }
            const from = window.scrollY;
            const to = Math.max(0, from + el.getBoundingClientRect().top - ${HEADER_OFFSET});
            const ms = ${ms};
            if (ms <= 0) { window.scrollTo(0, to); done(true); return; }
            const start = performance.now();
            const step = (now) => {
                const x = Math.min(1, (now - start) / ms);
                window.scrollTo(0, from + (to - from) * (1 - Math.cos(Math.PI * x)) / 2);
                if (x < 1) requestAnimationFrame(step); else done(true);
            };
            requestAnimationFrame(step);
        })
    `);
    await sleep(120);
};

const tap = async (label: string, loc: Locator): Promise<void> => {
    await sleep(200);
    const box = await boxOf(loc);
    events.push({ t: now(), kind: 'tap', label, box });
    await sleep(220);
    await loc.tap();
};

/** Opens the navigation menu and taps one language. Navigates to the /<lang>/ page. */
const switchLanguage = async (page: Page, name: 'English' | 'Português'): Promise<void> => {
    await tap('menu', page.locator('button.header__hamburger'));
    await sleep(650);
    const option = page
        .locator(
            'div[aria-label="Cambiar idioma"]:visible, div[aria-label="Change language"]:visible, div[aria-label="Mudar idioma"]:visible'
        )
        .locator(`a[aria-label="${name}"]`)
        .first();
    await tap(`lang-${name === 'English' ? 'en' : 'pt'}`, option);
};

/** Waits for a freshly loaded page, parks it on the description, and ends the hidden stretch. */
const landOnDescription = async (page: Page, lang: string): Promise<void> => {
    await page.waitForURL(new RegExp(`/${lang}/`), { timeout: 30_000 });
    await page.waitForLoadState('networkidle');
    await scrollToSelector(page, '.quick-facts', 0);
    await sleep(900);
    mark('cut:in');
    mark(`page:${lang}`);
};

const main = async (): Promise<void> => {
    const url = new URL(LISTING_URL);
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
    // Domain + root path: a `url` cookie is scoped to the listing's path and the /en/ page would ask again.
    await context.addCookies([
        { name: 'cookie-consent', value: consent, domain: url.hostname, path: '/' }
    ]);
    if (DEMO_HIDE_CSS.length > 0) {
        await context.addInitScript(`
            (() => {
                const tick = () => {
                    if (!document.documentElement || document.getElementById('demo-hide')) return;
                    const style = document.createElement('style');
                    style.id = 'demo-hide';
                    style.textContent = ${JSON.stringify(DEMO_HIDE_CSS)};
                    document.documentElement.append(style);
                };
                setInterval(tick, 100);
                tick();
            })();
        `);
    }
    const page = await context.newPage();
    await page.goto(url.href, { waitUntil: 'networkidle' });
    // Warm the lazy map tiles and images, then come back to the top.
    for (const sel of ['.location-section', '.nearby-poi-section']) {
        await scrollToSelector(page, sel, 0);
        await sleep(1200);
    }
    await page.evaluate('window.scrollTo(0, 0)');
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
    await sleep(600);

    // Stage 1 — photos and description, then the same listing in English and Portuguese.
    mark('stage:idioma');
    await hold('fotos', 1800);
    await scrollToSelector(page, '.quick-facts', 1100);
    await hold('desc-es', 1600, page.locator('.description__summary'));
    await switchLanguage(page, 'English');
    mark('cut:out');
    await landOnDescription(page, 'en');
    await hold('desc-en', 2200, page.locator('.description__summary'));
    await switchLanguage(page, 'Português');
    mark('cut:out');
    await landOnDescription(page, 'pt');
    await hold('desc-pt', 2600, page.locator('.description__summary'));

    // Back to Spanish: the load is hidden by a wipe, no tap shown.
    mark('cut:out');
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await sleep(1200);
    mark('cut:in');

    // Stage 2 — the map and what is nearby, with distances.
    mark('stage:cerca');
    await hold('top-es', 500);
    await scrollToSelector(page, '.location-section', 2000);
    await sleep(500);
    await hold('mapa', 2400, page.locator('.location-section__map'));
    await scrollToSelector(page, '.nearby-poi-section', 1400);
    await sleep(300);
    const cards = page.locator('.nearby-poi-section__card');
    await hold('cerca-1', 1800, cards.nth(0));
    await hold('cerca-2', 1600, cards.nth(1));
    await hold('cerca-3', 1600, cards.nth(2));
    await hold('final', 2500);

    await cdp.send('Page.stopScreencast');
    mark('end');
    await sleep(300);
    await browser.close();

    const duration = now();
    writeFileSync(join(outDir, 'frames.json'), JSON.stringify(frames, null, 2));
    const eventsFile = join(outDir, 'events.json');
    writeFileSync(
        eventsFile,
        JSON.stringify(
            { dpr: DPR, viewport: VIEWPORT, duration, source: url.href, events },
            null,
            2
        )
    );

    // Constant-frame-rate video from the variable-rate screencast (concat demuxer with durations).
    const lines: string[] = [];
    frames.forEach((f, i) => {
        const next = frames[i + 1]?.ts ?? duration;
        lines.push(
            `file 'frames/${f.file}'`,
            `duration ${Math.max(0.001, next - f.ts).toFixed(4)}`
        );
    });
    const last = frames.at(-1);
    if (last) lines.push(`file 'frames/${last.file}'`);
    writeFileSync(join(outDir, 'concat.txt'), `${lines.join('\n')}\n`);
    const screen = join(outDir, 'screen.mp4');
    execFileSync(
        'ffmpeg',
        [
            '-y',
            '-loglevel',
            'error',
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            'concat.txt',
            '-vf',
            'fps=30,scale=1080:-2:flags=lanczos',
            '-c:v',
            'libx264',
            '-crf',
            '16',
            '-pix_fmt',
            'yuv420p',
            'screen.mp4'
        ],
        { cwd: outDir, stdio: 'inherit' }
    );

    const editDir = join(publicDir, 'vc5');
    mkdirSync(editDir, { recursive: true });
    copyFileSync(screen, join(editDir, 'screen.mp4'));
    copyFileSync(eventsFile, join(editDir, 'events.json'));
    console.info(
        `frames=${frames.length} duration=${duration.toFixed(1)}s → ${outDir} (+ ${editDir})`
    );
};

await main();
