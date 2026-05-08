#!/usr/bin/env node
/**
 * Capture 24 baseline full-page screenshots for SPEC-099 Home Audit Remediation.
 * Combinations: 4 viewports × 2 themes × 3 locales = 24.
 * Naming: home-{locale}-{viewport}-{theme}.png
 */
import { chromium } from '@playwright/test';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = '/home/qazuor/projects/WEBS/hospeda-home-audit/.claude/baseline/screenshots';
const BASE = 'http://localhost:4321';
const VIEWPORTS = [
    { name: '375', width: 375, height: 812 },
    { name: '768', width: 768, height: 1024 },
    { name: '1280', width: 1280, height: 800 },
    { name: '1920', width: 1920, height: 1080 }
];
const THEMES = ['light', 'dark'];
const LOCALES = ['es', 'en', 'pt'];

const failures = [];
let captured = 0;

const browser = await chromium.launch({ headless: true });
try {
    for (const locale of LOCALES) {
        for (const vp of VIEWPORTS) {
            for (const theme of THEMES) {
                const filename = `home-${locale}-${vp.name}-${theme}.png`;
                const filepath = join(OUT_DIR, filename);
                const url = `${BASE}/${locale}/`;
                const ctx = await browser.newContext({
                    viewport: { width: vp.width, height: vp.height },
                    deviceScaleFactor: 1
                });
                const page = await ctx.newPage();
                try {
                    // Pre-set theme via init script BEFORE navigation so the
                    // SSR/CSR theme detection picks it up on first paint.
                    await ctx.addInitScript((t) => {
                        try {
                            window.localStorage.setItem('theme', t);
                            document.documentElement.setAttribute('data-theme', t);
                            document.documentElement.classList.toggle('dark', t === 'dark');
                        } catch {}
                    }, theme);
                    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
                    // small extra wait for hydration
                    await page.waitForTimeout(800);
                    await page.evaluate(() => window.scrollTo(0, 0));
                    await page.screenshot({ path: filepath, fullPage: true });
                    captured++;
                    console.log(`OK  ${filename}`);
                } catch (err) {
                    failures.push({ filename, error: String(err?.message || err) });
                    console.error(`FAIL ${filename}: ${err?.message || err}`);
                } finally {
                    await page.close();
                    await ctx.close();
                }
            }
        }
    }
} finally {
    await browser.close();
}

const summary = {
    captured,
    failures,
    total: VIEWPORTS.length * THEMES.length * LOCALES.length,
    timestamp: new Date().toISOString()
};
writeFileSync(join(OUT_DIR, 'SUMMARY.json'), JSON.stringify(summary, null, 2));
console.log(`\nDone: ${captured}/${summary.total} captured, ${failures.length} failures`);
if (failures.length > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f.filename}: ${f.error}`);
}
