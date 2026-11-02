/**
 * Shared machinery of the screencast recorders (record-vc*.mts): a reference-device browser, the
 * event log the compositions edit from, eased scrolling, and the final frames → screen.mp4 step.
 *
 * Events are logged in device pixels of the recording (viewport × recordDpr), the same contract
 * as record-a1.mts, so src/a1/timeline.ts reads every take alike.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Browser, type BrowserContext, chromium, type Locator, type Page } from 'playwright';
import { resolveAssetPaths } from '../../config/asset-paths';
import { REFERENCE_DEVICE } from '../../config/device';

/** Device pixel ratio every take is recorded at. */
export const DPR = REFERENCE_DEVICE.recordDpr;
/** CSS viewport every take is recorded at (the reference phone's visible page area). */
export const VIEWPORT = REFERENCE_DEVICE.viewport;
/** Height of Hospeda's sticky site header, CSS px: scroll targets land just below it. */
export const HEADER_OFFSET = 88;

/** Rectangle in device pixels of the recording. */
export type Box = {
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
};

/** One logged action. Times are seconds since the screencast started. */
export type TimelineEvent = {
    readonly t: number;
    readonly end?: number;
    readonly kind: 'mark' | 'tap' | 'type' | 'hold';
    readonly label: string;
    readonly box?: Box;
};

/** Consent cookie value that dismisses the banner (necessary cookies only). */
const CONSENT = encodeURIComponent(
    JSON.stringify({
        necessary: true,
        crashReporting: false,
        analytics: false,
        marketing: false,
        version: 2,
        decidedAt: '2026-01-01T00:00:00.000Z'
    })
);

/** Pauses for `ms` milliseconds. */
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Launches the reference-device browser: new-headless Chromium with a forced scale factor (the
 * default headless shell ignores deviceScaleFactor), consent preloaded for the whole host, and
 * an optional owner-approved `hideCss` re-added on every page (client navigations swap <head>).
 * Page scripts go in as strings: tsx injects a `__name` helper that does not exist in the page.
 *
 * @param input.origin - Site origin the consent cookie is set for.
 * @param input.hideCss - Demo-staging CSS (selectors hidden with `display:none`), or empty.
 * @returns `{ browser, context, page }`.
 */
export const launchDevice = async ({
    origin,
    hideCss = ''
}: {
    readonly origin: string;
    readonly hideCss?: string;
}): Promise<{ browser: Browser; context: BrowserContext; page: Page }> => {
    const browser = await chromium.launch({
        channel: 'chromium',
        args: [`--force-device-scale-factor=${DPR}`]
    });
    const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DPR,
        isMobile: true,
        hasTouch: true,
        locale: 'es-AR',
        // The site's CSP blocks inline <style>: without this the demo-staging CSS is silently ignored.
        bypassCSP: true
    });
    // Domain + root path: a `url` cookie is scoped to that page's path and other pages ask again.
    await context.addCookies([
        { name: 'cookie-consent', value: CONSENT, domain: new URL(origin).hostname, path: '/' }
    ]);
    if (hideCss.length > 0) {
        await context.addInitScript(`
            (() => {
                const tick = () => {
                    if (!document.documentElement || document.getElementById('demo-hide')) return;
                    const style = document.createElement('style');
                    style.id = 'demo-hide';
                    style.textContent = ${JSON.stringify(hideCss)};
                    document.documentElement.append(style);
                };
                setInterval(tick, 100);
                tick();
            })();
        `);
    }
    return { browser, context, page: await context.newPage() };
};

/** Turns a list of selectors into demo-staging CSS that hides them. */
export const hideCssOf = (selectors: readonly string[]): string =>
    selectors.map((s) => `${s}{display:none!important}`).join('\n');

/**
 * Scrolls the document to `to` (CSS px) with a sine ease over `ms` (Chrome's native smooth
 * scroll whips through long distances). `ms = 0` jumps.
 */
export const scrollToY = async (page: Page, to: number, ms: number): Promise<void> => {
    await page.evaluate(`
        new Promise((done) => {
            const from = window.scrollY;
            const target = Math.max(0, ${to});
            const ms = ${ms};
            if (ms <= 0) { window.scrollTo(0, target); done(true); return; }
            const start = performance.now();
            const step = (now) => {
                const x = Math.min(1, (now - start) / ms);
                window.scrollTo(0, from + (target - from) * (1 - Math.cos(Math.PI * x)) / 2);
                if (x < 1) requestAnimationFrame(step); else done(true);
            };
            requestAnimationFrame(step);
        })
    `);
    await sleep(120);
};

/** Document Y (CSS px) of the top of an element. */
export const docTopOf = async (loc: Locator): Promise<number> => {
    const b = await loc.boundingBox();
    const scrollY = (await loc.page().evaluate('window.scrollY')) as number;
    if (!b) throw new Error('Element to scroll to has no box');
    return b.y + scrollY;
};

/** Scrolls so the element's top sits `offset` CSS px below the viewport top (default: under the header). */
export const scrollToLocator = async (
    loc: Locator,
    ms: number,
    offset = HEADER_OFFSET
): Promise<void> => {
    await scrollToY(loc.page(), (await docTopOf(loc)) - offset, ms);
};

/**
 * A take: the screencast, the event log and the helpers that write to it.
 *
 * @param input.video - Video id, the folder under recordings/ and public/ (e.g. `vc5`).
 * @param input.take - Take name (a sub-folder of the recordings dir).
 */
export const createTake = ({ video, take }: { readonly video: string; readonly take: string }) => {
    const { recordingsDir, publicDir } = resolveAssetPaths();
    const outDir = join(recordingsDir, video, take);
    const framesDir = join(outDir, 'frames');
    mkdirSync(framesDir, { recursive: true });

    const events: TimelineEvent[] = [];
    const frames: { file: string; ts: number }[] = [];
    let t0 = 0;
    const now = (): number => Date.now() / 1000 - t0;

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

    const tap = async (label: string, loc: Locator): Promise<void> => {
        await sleep(200);
        const box = await boxOf(loc);
        events.push({ t: now(), kind: 'tap', label, box });
        await sleep(220);
        await loc.tap();
    };

    /** Pastes `text` into a field at once (a `type` event over the field's box). */
    const paste = async (label: string, loc: Locator, text: string): Promise<void> => {
        const box = await boxOf(loc);
        const t = now();
        await loc.fill(text);
        events.push({ t, end: now(), kind: 'type', label, box });
    };

    /** Types `text` key by key, visibly (a `type` event over the field's box). */
    const type = async (label: string, loc: Locator, text: string, delayMs = 65): Promise<void> => {
        const box = await boxOf(loc);
        const t = now();
        await loc.pressSequentially(text, { delay: delayMs });
        events.push({ t, end: now(), kind: 'type', label, box });
    };

    let activePage: Page | undefined;

    /**
     * Taps a point of the page (CSS px) that no locator names, such as a spot on a map. The
     * event box is a small square around the point.
     */
    const tapAt = async (label: string, x: number, y: number): Promise<void> => {
        if (!activePage) throw new Error('tapAt before start()');
        await sleep(200);
        const half = 12;
        events.push({
            t: now(),
            kind: 'tap',
            label,
            box: { x: (x - half) * DPR, y: (y - half) * DPR, w: half * 2 * DPR, h: half * 2 * DPR }
        });
        await sleep(220);
        await activePage.mouse.click(x, y);
    };

    let cdpStop: (() => Promise<void>) | undefined;

    const start = async (context: BrowserContext, page: Page): Promise<void> => {
        activePage = page;
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
        cdpStop = async () => {
            await cdp.send('Page.stopScreencast');
        };
        await sleep(600);
    };

    /**
     * Stops the screencast, writes frames.json + events.json, builds a constant-rate screen.mp4
     * from the variable-rate frames (concat demuxer with durations), and copies the edit-ready
     * files to <public dir>/<video>/.
     */
    const finish = async (extra: Record<string, unknown> = {}): Promise<void> => {
        await cdpStop?.();
        mark('end');
        await sleep(300);
        const duration = now();
        writeFileSync(join(outDir, 'frames.json'), JSON.stringify(frames, null, 2));
        const eventsFile = join(outDir, 'events.json');
        writeFileSync(
            eventsFile,
            JSON.stringify({ dpr: DPR, viewport: VIEWPORT, duration, ...extra, events }, null, 2)
        );
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
        const editDir = join(publicDir, video);
        mkdirSync(editDir, { recursive: true });
        copyFileSync(join(outDir, 'screen.mp4'), join(editDir, 'screen.mp4'));
        copyFileSync(eventsFile, join(editDir, 'events.json'));
        console.info(
            `frames=${frames.length} duration=${duration.toFixed(1)}s → ${outDir} (+ ${editDir})`
        );
    };

    return { mark, hold, tap, tapAt, paste, type, boxOf, start, finish, outDir };
};
