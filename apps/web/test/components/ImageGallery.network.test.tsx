import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect as browserExpect, chromium } from '@playwright/test';
import react from '@vitejs/plugin-react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ImageGallery } from '@/components/ImageGallery.client';

/** The in-memory fixture emits a JavaScript chunk and a CSS asset. */
type FixtureOutput =
    | { type: 'chunk'; code: string }
    | { type: 'asset'; fileName: string; source: string };

const heroImage = {
    url: 'https://res.cloudinary.com/test/image/upload/hero.jpg',
    alt: 'Hero'
};

it.each([heroImage.url, '/hero.jpg'])('preserves the desktop SSR preload for %s', (url) => {
    const gallery = (
        <ImageGallery
            variant="detail"
            locale="en"
            images={[{ ...heroImage, url }]}
        />
    );
    const mobile = { backHref: '/en/alojamientos/' };

    const legacyMarkup = renderToString(gallery);
    const optedInMarkup = renderToString(
        <ImageGallery
            {...gallery.props}
            mobile={mobile}
        />
    );
    const legacy = new DOMParser().parseFromString(legacyMarkup, 'text/html');
    const optedIn = new DOMParser().parseFromString(optedInMarkup, 'text/html');
    const selector = 'link[rel="preload"][as="image"]';
    const original = legacy.querySelector(selector);
    const preload = optedIn.querySelector(selector);

    expect(original).not.toBeNull();
    expect(optedIn.querySelectorAll(selector)).toHaveLength(1);
    for (const attr of ['imagesrcset', 'imagesizes', 'href', 'fetchpriority']) {
        expect(preload?.getAttribute(attr)).toBe(original?.getAttribute(attr));
    }
    const source = optedIn.querySelector('[data-count] source');
    expect(source?.getAttribute('media')).toBeTruthy();
    expect(preload?.getAttribute('media')).toBe(source?.getAttribute('media'));
    expect(optedInMarkup.indexOf('<link')).toBeLessThan(optedInMarkup.indexOf('<picture'));
});

// Opt in from a machine with Playwright Chromium installed; no app server is needed.
describe.skipIf(process.env.GALLERY_BROWSER_TEST !== '1')('SSR gallery image requests', () => {
    let browser: Awaited<ReturnType<typeof chromium.launch>>;

    beforeAll(async () => {
        browser = await chromium.launch();
    });

    afterAll(async () => {
        await browser?.close();
    });

    it('dismisses the guest Favorite portal and moves focus when crossing to desktop', async () => {
        // Use Vitest's Vite to bundle just the fixture in memory; no Astro server or API.
        const requireFromVitest = createRequire(import.meta.resolve('vitest'));
        const { build } = await import(pathToFileURL(requireFromVitest.resolve('vite')).href);
        const fixture = resolve('test/fixtures/gallery-favorite-browser.tsx');
        const [{ output }]: [{ output: readonly FixtureOutput[] }] = await build({
            configFile: false,
            envDir: false,
            logLevel: 'error',
            resolve: {
                alias: {
                    '@/hooks/use-account-permissions': resolve('test/fixtures/gallery-guest.ts'),
                    '@/store/favorites-store': resolve('test/fixtures/gallery-guest.ts'),
                    '@': resolve('src'),
                    'astro:transitions/client': resolve('test/stubs/astro-transitions-client.ts'),
                    '@repo/icons': resolve('../../packages/icons/src'),
                    '@repo/i18n': resolve('../../packages/i18n/src')
                }
            },
            plugins: [react()],
            build: {
                write: false,
                lib: { entry: fixture, name: 'GalleryFixture', formats: ['iife'] }
            }
        });
        const script = output.find((entry) => entry.type === 'chunk');
        const css = output.find(
            (entry) => entry.type === 'asset' && entry.fileName.endsWith('.css')
        );
        if (!script || css?.type !== 'asset') throw new Error('Missing browser fixture JS or CSS');
        const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        try {
            await page.route('https://gallery.test/**', (route) =>
                route.fulfill({
                    contentType: 'text/html',
                    body: '<!doctype html><script>globalThis.process = { env: { NODE_ENV: "test" } };</script><div id="gallery"></div>'
                })
            );
            await page.goto('https://gallery.test/');
            await page.addStyleTag({ content: css.source });
            await page.addScriptTag({ content: script.code });
            const heart = page.locator('button[data-entity-type="ACCOMMODATION"]');
            const dialog = page.getByRole('dialog');
            await browserExpect(heart).toBeEnabled();
            await heart.press('Enter', { timeout: 3000 });
            await browserExpect(dialog.getByRole('button')).toBeFocused();

            await page.setViewportSize({ width: 768, height: 800 });

            await browserExpect(heart).toBeHidden();
            await browserExpect(dialog).toHaveCount(0);
            await browserExpect(page.locator('[data-count] button').first()).toBeFocused();
            await page.setViewportSize({ width: 390, height: 800 });
            await browserExpect(heart).toHaveAttribute('aria-expanded', 'false');
        } catch (error) {
            if (pageErrors.length) throw new Error(pageErrors.join('\n'), { cause: error });
            throw error;
        } finally {
            await page.close();
        }
    }, 30000);

    it.each([
        { width: 700, candidateWidth: 1000, mobile: true },
        { width: 767, candidateWidth: 1000, mobile: true },
        { width: 768, candidateWidth: 640, mobile: false },
        { width: 900, candidateWidth: 640, mobile: false }
    ])('requests only the visible hero at $width px', async ({ width, candidateWidth, mobile }) => {
        const page = await browser.newPage({
            viewport: { width, height: 800 },
            deviceScaleFactor: 1
        });
        try {
            const markup = renderToString(
                <ImageGallery
                    variant="detail"
                    locale="en"
                    images={[heroImage]}
                    mobile={{ backHref: '/en/alojamientos/' }}
                />
            );
            const css = readFileSync('src/components/ImageGalleryMobileTrack.module.css', 'utf8');
            const requests: string[] = [];
            await page.route('https://gallery.test/', (route) =>
                route.fulfill({
                    contentType: 'text/html',
                    body: `<!doctype html><style>${css}</style>${markup}`
                })
            );
            await page.route('https://res.cloudinary.com/**', (route) => {
                requests.push(route.request().url());
                return route.fulfill({
                    contentType: 'image/svg+xml',
                    headers: { 'timing-allow-origin': '*' },
                    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
                });
            });

            await page.goto('https://gallery.test/', { waitUntil: 'networkidle' });

            const track = page.locator('.track');
            const mosaic = page.locator('[data-count]');
            expect(await track.isVisible()).toBe(mobile);
            expect(await mosaic.isVisible()).toBe(!mobile);
            const hero = (mobile ? track : mosaic).locator('img');
            expect(await hero.isVisible()).toBe(true);
            const selected = await hero.evaluate((img: HTMLImageElement) => img.currentSrc);
            expect(requests).toEqual([selected]);
            expect(selected).toMatch(new RegExp(`w_${candidateWidth}(?:[,/])`));
            expect(await hero.getAttribute('fetchpriority')).toBe('high');
            const initiators = await page.evaluate(
                (url) =>
                    performance
                        .getEntriesByName(url, 'resource')
                        .map((entry) => (entry as PerformanceResourceTiming).initiatorType),
                selected
            );
            expect(initiators).toEqual([mobile ? 'img' : 'link']);
        } finally {
            await page.close();
        }
    });
});
