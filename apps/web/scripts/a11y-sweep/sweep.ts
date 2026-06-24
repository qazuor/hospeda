#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
const ONLY_URL = process.env.ONLY_URL;
const DRY_RUN = process.env.DRY_RUN === '1';
const REPORT_DIR = resolve(import.meta.dirname, '_fixtures');

const DESKTOP = { width: 1280, height: 800 };
const PAGE_TIMEOUT = 25_000;
const NAV_WAIT = 'networkidle' as const;

const INVENTORY: ReadonlyArray<{ url: string; name: string }> = [
    { url: '/es/', name: 'Home' },
    { url: '/es/alojamientos/', name: 'Accommodations List' },
    { url: '/es/destinos/', name: 'Destinations List' },
    { url: '/es/eventos/', name: 'Events List' },
    { url: '/es/gastronomia/', name: 'Gastronomy List' },
    { url: '/es/experiencias/', name: 'Experiences List' },
    { url: '/es/publicaciones/', name: 'Posts List' },
    { url: '/es/nosotros/', name: 'About' },
    { url: '/es/preguntas-frecuentes/', name: 'FAQ' },
    { url: '/es/contacto/', name: 'Contact' },
    { url: '/es/suscriptores/precios/', name: 'Pricing' },
    { url: '/en/', name: 'Home EN' },
    { url: '/pt/', name: 'Home PT' }
];

type PageResult = {
    url: string;
    name: string;
    status: 'ok' | 'error';
    error?: string;
    axe?: {
        violations: number;
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
    };
    durationMs: number;
};

function filterEntries(): ReadonlyArray<{ url: string; name: string }> {
    let entries = INVENTORY;
    if (ONLY_URL) {
        entries = entries.filter((e) => e.url === ONLY_URL || e.url.endsWith(ONLY_URL));
    }
    return entries;
}

async function sweepEntry(
    page: import('@playwright/test').Page,
    entry: { url: string; name: string }
): Promise<PageResult> {
    const t0 = Date.now();
    const result: PageResult = {
        url: entry.url,
        name: entry.name,
        status: 'ok',
        durationMs: 0
    };

    const fullUrl = `${BASE_URL.replace(/\/$/, '')}${entry.url}`;

    try {
        await page.setViewportSize(DESKTOP);
        const resp = await page.goto(fullUrl, { waitUntil: NAV_WAIT, timeout: PAGE_TIMEOUT });

        const httpStatus = resp?.status() ?? 0;
        if (httpStatus >= 400) {
            result.status = 'error';
            result.error = `HTTP ${httpStatus}`;
            result.durationMs = Date.now() - t0;
            return result;
        }

        // Wait for h1 or content to render
        try {
            await page.waitForFunction(
                () => {
                    const h1 = document.querySelector('h1');
                    if (h1 && (h1.textContent?.trim().length ?? 0) > 2) return true;
                    return document.querySelector('main') !== null;
                },
                { timeout: 8_000 }
            );
        } catch {
            // content may still load — continue with axe anyway
        }

        await page.waitForTimeout(1_000);

        const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
            .analyze();

        const violations = axeResults.violations;
        result.axe = {
            violations: violations.length,
            critical: violations.filter((v) => v.impact === 'critical').length,
            serious: violations.filter((v) => v.impact === 'serious').length,
            moderate: violations.filter((v) => v.impact === 'moderate').length,
            minor: violations.filter((v) => v.impact === 'minor').length
        };
    } catch (e) {
        result.status = 'error';
        result.error = (e as Error).message;
    }

    result.durationMs = Date.now() - t0;
    return result;
}

async function main() {
    const entries = filterEntries();

    if (entries.length === 0) {
        console.error(`No entries match ONLY_URL=${ONLY_URL}`);
        process.exit(1);
    }

    console.log(`\nA11y sweep — ${entries.length} pages (DRY_RUN=${DRY_RUN})`);
    console.log(`Base URL: ${BASE_URL}\n`);

    if (DRY_RUN) {
        for (const entry of entries) {
            console.log(`  ${entry.name}: ${entry.url}`);
        }
        return;
    }

    mkdirSync(REPORT_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: DESKTOP,
        locale: 'es-AR'
    });
    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);

    const results: PageResult[] = [];

    for (const entry of entries) {
        process.stdout.write(`  ${entry.url} ... `);
        const r = await sweepEntry(page, entry);
        results.push(r);

        const tag =
            r.status === 'ok' && r.axe
                ? `OK (${r.durationMs}ms, axe=${r.axe.violations}v c${r.axe.critical}/s${r.axe.serious})`
                : `ERR (${r.error})`;
        console.log(tag);
    }

    const summary = {
        completed: results.length,
        ok: results.filter((r) => r.status === 'ok').length,
        error: results.filter((r) => r.status === 'error').length,
        totalViolations: results.reduce((sum, r) => sum + (r.axe?.violations ?? 0), 0),
        totalCritical: results.reduce((sum, r) => sum + (r.axe?.critical ?? 0), 0),
        totalSerious: results.reduce((sum, r) => sum + (r.axe?.serious ?? 0), 0)
    };

    const reportPath = resolve(REPORT_DIR, 'sweep-report.json');
    writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));
    console.log(`\nReport saved to ${reportPath}`);

    console.log('\nSummary:');
    console.log(`  Pages:    ${summary.ok} OK, ${summary.error} error`);
    console.log(
        `  Violations: ${summary.totalViolations} total (critical=${summary.totalCritical}, serious=${summary.totalSerious})`
    );

    await browser.close();

    if (summary.totalCritical > 0 || summary.totalSerious > 0) {
        console.error('\nFAIL: Critical or serious axe violations found.');
        process.exit(1);
    }

    console.log('\nPASS: No critical/serious violations.');
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
