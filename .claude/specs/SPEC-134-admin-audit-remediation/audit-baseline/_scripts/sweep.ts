#!/usr/bin/env bun
/**
 * SPEC-131 Phase 1+3-axe fused sweep.
 *
 * For every page in inventory.json:
 *   1. Substitute dynamic params ($id, $campaignId) from real DB rows (queried once at startup).
 *   2. Navigate to the page (single shared authed context).
 *   3. Resize to desktop (1280x800) — full-page screenshot + axe-core run + save JSON.
 *   4. Resize to mobile (375x667) — full-page screenshot.
 *
 * Output:
 *   - audits/spec-131/<entity>/<slug>-desktop.png
 *   - audits/spec-131/<entity>/<slug>-mobile.png
 *   - audits/spec-131/<entity>/<slug>-axe.json
 *   - audits/spec-131/_fixtures/sweep-report.json (per-page status + error log)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { $ } from 'bun';
import { type Page, chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = join(__dirname, '..');
const ADMIN_URL = process.env.AUDIT_ADMIN_URL || 'http://localhost:3000';
const EMAIL = process.env.AUDIT_EMAIL || 'superadmin@hospeda.com';
const PASSWORD = process.env.AUDIT_PASSWORD;
if (!PASSWORD) {
    throw new Error(
        'AUDIT_PASSWORD env var is required. Set the local-DB superadmin password before running. See SPEC-134 spec.md §5 for the full re-audit workflow.'
    );
}
const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 667 };
const PAGE_TIMEOUT = 25_000;
const NAV_WAIT = 'networkidle' as const;
const READY_SPINNER_TIMEOUT = 8_000;
const READY_H1_TIMEOUT = 5_000;
const READY_SETTLE_MS = 1_800;

const DRY_RUN = process.env.DRY_RUN === '1';
const ONLY_ENTITY = process.env.ONLY_ENTITY; // e.g. "dashboard"
const ONLY_PRIORITY = process.env.ONLY_PRIORITY; // "critical" | "standard"
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;

type Entry = {
    n: number;
    url: string;
    file: string;
    purpose: string;
    entity: string;
    priority: 'critical' | 'standard';
    slug: string;
    artifactDir: string;
};

type PageResult = {
    n: number;
    url: string;
    resolvedUrl: string;
    entity: string;
    status: 'ok' | 'skipped' | 'error';
    skipReason?: string;
    error?: string;
    axe?: {
        violations: number;
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
    };
    desktop?: string;
    mobile?: string;
    httpStatusOnLoad?: number;
    finalUrl?: string;
    durationMs?: number;
};

async function queryOneId(table: string, whereClause = ''): Promise<string | null> {
    try {
        const where = whereClause ? `WHERE ${whereClause}` : '';
        const sql = `SELECT id FROM ${table} ${where} ORDER BY created_at NULLS LAST LIMIT 1`;
        const result =
            await $`env PGPASSWORD=hospeda_pass psql -h localhost -p 5436 -U hospeda_user -d hospeda_dev -A -t -c ${sql}`.quiet();
        const id = result.stdout.toString().trim().split('\n')[0];
        return id && id.length > 0 ? id : null;
    } catch (e) {
        console.warn(`  [warn] queryOneId(${table}) failed: ${(e as Error).message}`);
        return null;
    }
}

async function buildIdMap(): Promise<Record<string, string | null>> {
    console.log('Querying DB for dynamic-route IDs...');
    const map = {
        // Tables that map directly to a URL segment.
        userId: await queryOneId('users', "role != 'SUPER_ADMIN'"),
        accommodationId: await queryOneId('accommodations'),
        amenityId: await queryOneId('amenities'),
        featureId: await queryOneId('features'),
        attractionId: await queryOneId('attractions'),
        conversationId: await queryOneId('conversations'),
        destinationId: await queryOneId('destinations'),
        eventId: await queryOneId('events'),
        eventLocationId: await queryOneId('event_locations'),
        eventOrganizerId: await queryOneId('event_organizers'),
        campaignId: await queryOneId('newsletter_campaigns'),
        postId: await queryOneId('posts'),
        sponsorId: await queryOneId('sponsorships'), // /sponsors uses sponsorship records
        tagId: await queryOneId('tags'),
        postTagId: await queryOneId('post_tags')
    };
    for (const [k, v] of Object.entries(map)) {
        console.log(`  ${k} = ${v ?? '(none — page will be skipped)'}`);
    }
    return map;
}

/**
 * Resolves a route URL with dynamic params. Returns null if the page must be skipped
 * (e.g. unresolvable $type/$id combination or required ID not found in DB).
 */
function resolveUrl(url: string, ids: Record<string, string | null>): string | null {
    // Hard-skip: tags/entity-attribution needs $type + $id, no canonical default.
    if (url.includes('/tags/entity-attribution/')) return null;

    let resolved = url;
    // Resolve named param $campaignId first (more specific).
    if (resolved.includes('$campaignId')) {
        if (!ids.campaignId) return null;
        resolved = resolved.replace('$campaignId', ids.campaignId);
    }
    // Resolve $id by entity context.
    if (resolved.includes('$id')) {
        const entityIdMap: Array<[RegExp, string]> = [
            [/^\/access\/users\//, 'userId'],
            [/^\/accommodations\//, 'accommodationId'],
            [/^\/content\/accommodation-amenities\//, 'amenityId'],
            [/^\/content\/accommodation-features\//, 'featureId'],
            [/^\/content\/destination-attractions\//, 'attractionId'],
            [/^\/conversations\//, 'conversationId'],
            [/^\/destinations\//, 'destinationId'],
            [/^\/events\/locations\//, 'eventLocationId'],
            [/^\/events\/organizers\//, 'eventOrganizerId'],
            [/^\/events\//, 'eventId'],
            [/^\/posts\//, 'postId'],
            [/^\/sponsors\//, 'sponsorId'],
            [/^\/tags\/internal\//, 'tagId'],
            [/^\/tags\/post-tags\//, 'postTagId'],
            [/^\/tags\/system\//, 'tagId']
        ];

        const match = entityIdMap.find(([re]) => re.test(resolved));
        if (!match) return null;
        const id = ids[match[1]];
        if (!id) return null;
        resolved = resolved.replace('$id', id);
    }

    return resolved;
}

async function login(page: Page): Promise<void> {
    console.log('Logging in via /auth/signin...');
    await page.goto(`${ADMIN_URL}/auth/signin?redirect=%2Fdashboard`, { waitUntil: NAV_WAIT });
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL);
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    console.log(`  Logged in. URL: ${page.url()}`);

    // Sanity check: FAB must be OFF (set VITE_FEEDBACK_ENABLED=false in admin .env.local).
    const fabPresent = await page.evaluate(
        () => !!document.querySelector('[data-testid="feedback-fab"]')
    );
    if (fabPresent) {
        throw new Error(
            'FAB ("Reportar problema") is still rendered. Set VITE_FEEDBACK_ENABLED=false in apps/admin/.env.local and restart the admin dev server before running the sweep.'
        );
    }
    console.log('  Sanity check: FAB hidden (VITE_FEEDBACK_ENABLED=false honored).');
}

/**
 * Wait for the current page to be "settled" before screenshot/axe runs.
 *
 * Three-stage gate:
 *   1. Wait for known loading indicators (spinners, aria-busy) to disappear.
 *   2. Wait for the h1 to have non-empty text (most admin pages render entity name in h1).
 *   3. Hard settle: a fixed timeout for chart/skeleton animations + late async renders.
 *
 * Each gate has its own short timeout and silently times out if the signal is absent
 * (e.g., the page may have no spinner, or may use a heading other than h1).
 */
async function waitForReady(page: Page): Promise<void> {
    // 1. Spinners / skeletons / aria-busy gone.
    try {
        await page.waitForFunction(
            () =>
                !document.querySelector(
                    '.animate-spin, [aria-busy="true"], [data-loading="true"], [data-state="loading"]'
                ),
            { timeout: READY_SPINNER_TIMEOUT }
        );
    } catch {
        // Page may have a persistent spinner (genuine loading bug) — record what we can.
    }

    // 2. h1 has non-empty text (signal that the main entity/page heading has resolved).
    try {
        await page.waitForFunction(
            () => {
                const h1 = document.querySelector('h1');
                if (!h1) return true; // not all pages use h1 — pass through
                return (h1.textContent?.trim().length ?? 0) > 0;
            },
            { timeout: READY_H1_TIMEOUT }
        );
    } catch {
        // h1 may legitimately stay empty (a finding we'd want to capture).
    }

    // 3. Hard settle for animations, late async renders, KPI counters incrementing in, etc.
    await page.waitForTimeout(READY_SETTLE_MS);
}

async function sweepPage(
    page: Page,
    entry: Entry,
    ids: Record<string, string | null>
): Promise<PageResult> {
    const t0 = Date.now();
    const result: PageResult = {
        n: entry.n,
        url: entry.url,
        resolvedUrl: entry.url,
        entity: entry.entity,
        status: 'ok'
    };

    const resolved = resolveUrl(entry.url, ids);
    if (resolved === null) {
        result.status = 'skipped';
        result.skipReason = entry.url.includes('/entity-attribution/')
            ? 'requires $type+$id with no canonical default'
            : 'no DB row available to substitute $id';
        result.durationMs = Date.now() - t0;
        return result;
    }
    result.resolvedUrl = resolved;

    const entityDir = join(AUDIT_ROOT, entry.artifactDir);
    mkdirSync(entityDir, { recursive: true });
    const desktopPath = join(entityDir, `${entry.slug}-desktop.png`);
    const mobilePath = join(entityDir, `${entry.slug}-mobile.png`);
    const axePath = join(entityDir, `${entry.slug}-axe.json`);

    try {
        // Desktop pass: navigate, wait for content, screenshot, axe.
        await page.setViewportSize(DESKTOP);
        const resp = await page.goto(`${ADMIN_URL}${resolved}`, {
            waitUntil: NAV_WAIT,
            timeout: PAGE_TIMEOUT
        });
        result.httpStatusOnLoad = resp?.status();
        result.finalUrl = page.url();

        await waitForReady(page);

        await page.screenshot({ path: desktopPath, fullPage: true });
        result.desktop = desktopPath.replace(AUDIT_ROOT + '/', '');

        // axe-core run (after content settled so dynamic content is included).
        const axeResults = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
            .analyze();
        writeFileSync(axePath, JSON.stringify(axeResults, null, 2));

        const violations = axeResults.violations;
        result.axe = {
            violations: violations.length,
            critical: violations.filter((v) => v.impact === 'critical').length,
            serious: violations.filter((v) => v.impact === 'serious').length,
            moderate: violations.filter((v) => v.impact === 'moderate').length,
            minor: violations.filter((v) => v.impact === 'minor').length
        };

        // Mobile pass: resize, navigate fresh (full reload so server picks the new viewport),
        // wait for content, screenshot.
        await page.setViewportSize(MOBILE);
        await page.goto(`${ADMIN_URL}${resolved}`, { waitUntil: NAV_WAIT, timeout: PAGE_TIMEOUT });
        await waitForReady(page);
        await page.screenshot({ path: mobilePath, fullPage: true });
        result.mobile = mobilePath.replace(AUDIT_ROOT + '/', '');
    } catch (e) {
        result.status = 'error';
        result.error = (e as Error).message;
    }

    result.durationMs = Date.now() - t0;
    return result;
}

async function main() {
    const inventoryPath = join(AUDIT_ROOT, '_fixtures', 'inventory.json');
    let entries: Entry[] = JSON.parse(readFileSync(inventoryPath, 'utf8'));

    if (ONLY_ENTITY) entries = entries.filter((e) => e.entity === ONLY_ENTITY);
    if (ONLY_PRIORITY) entries = entries.filter((e) => e.priority === ONLY_PRIORITY);
    if (LIMIT) entries = entries.slice(0, LIMIT);

    console.log(`Sweep starting: ${entries.length} pages (DRY_RUN=${DRY_RUN})`);

    if (DRY_RUN) {
        for (const e of entries) {
            console.log(`  [dry] ${e.n.toString().padStart(3)} ${e.url}`);
        }
        return;
    }

    const ids = await buildIdMap();

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: DESKTOP,
        // Match the locale the seed/UI defaults to.
        locale: 'es-AR'
    });
    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_TIMEOUT);

    await login(page);

    // Save storage state for re-runs.
    await context.storageState({ path: join(AUDIT_ROOT, '_fixtures', 'auth-storage.json') });
    console.log('  Saved auth storage to _fixtures/auth-storage.json');

    const results: PageResult[] = [];
    for (const entry of entries) {
        process.stdout.write(
            `[${entry.n.toString().padStart(3)}/${entries.length}] ${entry.url} ... `
        );
        const r = await sweepPage(page, entry, ids);
        results.push(r);

        const tag =
            r.status === 'ok'
                ? `OK (${r.durationMs}ms, axe=${r.axe?.violations}v c${r.axe?.critical}/s${r.axe?.serious})`
                : r.status === 'skipped'
                  ? `SKIP (${r.skipReason})`
                  : `ERR (${r.error?.split('\n')[0].slice(0, 80)})`;
        console.log(tag);

        // Periodic flush of partial report so we never lose work on crash.
        if (results.length % 10 === 0) {
            writeFileSync(
                join(AUDIT_ROOT, '_fixtures', 'sweep-report.json'),
                JSON.stringify(
                    { inProgress: true, completed: results.length, total: entries.length, results },
                    null,
                    2
                )
            );
        }
    }

    writeFileSync(
        join(AUDIT_ROOT, '_fixtures', 'sweep-report.json'),
        JSON.stringify(
            {
                inProgress: false,
                completed: results.length,
                total: entries.length,
                summary: {
                    ok: results.filter((r) => r.status === 'ok').length,
                    skipped: results.filter((r) => r.status === 'skipped').length,
                    error: results.filter((r) => r.status === 'error').length,
                    totalAxeViolations: results.reduce(
                        (sum, r) => sum + (r.axe?.violations ?? 0),
                        0
                    ),
                    totalAxeCritical: results.reduce((sum, r) => sum + (r.axe?.critical ?? 0), 0),
                    totalAxeSerious: results.reduce((sum, r) => sum + (r.axe?.serious ?? 0), 0)
                },
                results
            },
            null,
            2
        )
    );
    console.log('\nDone. Report at _fixtures/sweep-report.json');

    await browser.close();
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
