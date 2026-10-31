/**
 * Debug helper: logs in and screenshots a page on the reference phone's viewport
 * (config/device.ts). Usage: pnpm probe /es/publicar/
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { resolveAssetPaths } from '../config/asset-paths';
import { REFERENCE_DEVICE } from '../config/device';

const WEB = process.env.WEB_URL ?? 'http://localhost:4422';
const path = process.argv[2] ?? '/es/publicar/';
const browser = await chromium.launch();
const context = await browser.newContext({
    viewport: REFERENCE_DEVICE.viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true
});
const page = await context.newPage();
await page.goto(`${WEB}/es/auth/signin/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.locator('#signin-email').fill('host-basico@local.test');
await page.locator('#signin-password').fill('Password123!');
await page.getByRole('button', { name: 'Iniciar sesión' }).click();
await page.waitForURL((u) => !u.pathname.includes('/auth/'), { timeout: 30_000 });
await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const { recordingsDir } = resolveAssetPaths();
mkdirSync(recordingsDir, { recursive: true });
await page.screenshot({ path: join(recordingsDir, 'probe.png'), fullPage: true });
console.info(page.url());
await browser.close();
