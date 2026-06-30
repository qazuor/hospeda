#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const ONLY_URL = process.env.ONLY_URL;
const DRY_RUN = process.env.DRY_RUN === '1';
const REQUIRE_DYNAMIC_ROUTES = process.env.REQUIRE_DYNAMIC_ROUTES === '1';
// When set, the run rewrites the baseline from the current violations and exits
// 0 instead of gating. Used to accept a known set of pre-existing violations
// (tracked separately as a11y debt) so the gate only fails on NEW regressions.
const UPDATE_BASELINE = process.env.A11Y_UPDATE_BASELINE === '1';
const REPORT_DIR = resolve(import.meta.dirname, '_fixtures');
// Committed allowlist of axe rule ids already failing per page+theme. A page is
// keyed as `${url} [${theme}]`; the value is the sorted set of accepted rule ids.
const BASELINE_PATH = resolve(import.meta.dirname, 'a11y-baseline.json');

const DESKTOP = { width: 1280, height: 800 };
const PAGE_TIMEOUT = 25_000;
const NAV_WAIT = 'networkidle' as const;
const THEMES = ['light', 'dark'] as const;

type Theme = (typeof THEMES)[number];

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
    { url: '/es/suscriptores/planes/', name: 'Pricing' },
    { url: '/en/', name: 'Home EN' },
    { url: '/pt/', name: 'Home PT' }
];

type DetailRouteSpec = {
    name: string;
    apiPath: string;
    toUrl: (item: Record<string, unknown>) => string | null;
};

const DETAIL_ROUTE_SPECS: ReadonlyArray<DetailRouteSpec> = [
    {
        name: 'Accommodation Detail',
        apiPath: '/api/v1/public/accommodations?page=1&pageSize=1',
        toUrl: (item) => buildEntityUrl({ basePath: 'alojamientos', slug: item.slug })
    },
    {
        name: 'Destination Detail',
        apiPath: '/api/v1/public/destinations?page=1&pageSize=1',
        toUrl: (item) => buildEntityUrl({ basePath: 'destinos', slug: item.slug })
    },
    {
        name: 'Event Detail',
        apiPath: '/api/v1/public/events?page=1&pageSize=1',
        toUrl: (item) => buildEntityUrl({ basePath: 'eventos', slug: item.slug })
    },
    {
        name: 'Post Detail',
        apiPath: '/api/v1/public/posts?page=1&pageSize=1',
        toUrl: (item) => buildEntityUrl({ basePath: 'publicaciones', slug: item.slug })
    },
    {
        name: 'Gastronomy Detail',
        apiPath: '/api/v1/public/gastronomies?page=1&pageSize=1',
        toUrl: (item) => buildEntityUrl({ basePath: 'gastronomia', slug: item.slug })
    },
    {
        name: 'Experience Detail',
        apiPath: '/api/v1/public/experiences?page=1&pageSize=1',
        toUrl: (item) => buildEntityUrl({ basePath: 'experiencias', slug: item.slug })
    }
];

type PageResult = {
    url: string;
    name: string;
    theme: Theme;
    status: 'ok' | 'error';
    error?: string;
    axe?: {
        violations: number;
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
        rules: ReadonlyArray<{ id: string; impact: string }>;
    };
    durationMs: number;
};

/** Baseline maps `${url} [${theme}]` to the sorted set of accepted axe rule ids. */
type Baseline = Record<string, string[]>;

function baselineKey({ url, theme }: { url: string; theme: Theme }): string {
    return `${url} [${theme}]`;
}

function loadBaseline(): Baseline {
    if (!existsSync(BASELINE_PATH)) {
        return {};
    }
    try {
        return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
    } catch {
        console.warn(`WARN: could not parse ${BASELINE_PATH}; treating baseline as empty.`);
        return {};
    }
}

function filterEntries(
    entriesInput: ReadonlyArray<{ url: string; name: string }>
): ReadonlyArray<{ url: string; name: string }> {
    let entries = entriesInput;
    if (ONLY_URL) {
        entries = entries.filter((e) => e.url === ONLY_URL || e.url.endsWith(ONLY_URL));
    }
    return entries;
}

function buildEntityUrl({
    basePath,
    slug
}: {
    basePath: string;
    slug: unknown;
}): string | null {
    if (typeof slug !== 'string' || slug.trim().length === 0) {
        return null;
    }

    return `/es/${basePath}/${slug}/`;
}

async function fetchFirstListItem({
    apiPath
}: {
    apiPath: string;
}): Promise<Record<string, unknown> | null> {
    const url = `${API_BASE_URL.replace(/\/$/, '')}${apiPath}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${apiPath}`);
    }

    const json = (await response.json()) as {
        ok?: boolean;
        data?: { items?: ReadonlyArray<Record<string, unknown>> };
    };

    if (json.ok === false) {
        throw new Error(`API returned ok=false for ${apiPath}`);
    }

    return json.data?.items?.[0] ?? null;
}

async function discoverDetailEntries(): Promise<ReadonlyArray<{ url: string; name: string }>> {
    const discovered: Array<{ url: string; name: string }> = [];
    const failures: string[] = [];

    for (const spec of DETAIL_ROUTE_SPECS) {
        try {
            const item = await fetchFirstListItem({ apiPath: spec.apiPath });
            const url = item ? spec.toUrl(item) : null;

            if (!url) {
                failures.push(`${spec.name}: no slug discovered`);
                continue;
            }

            discovered.push({ name: spec.name, url });
        } catch (error) {
            failures.push(`${spec.name}: ${(error as Error).message}`);
        }
    }

    if (failures.length > 0) {
        const message = `Dynamic route discovery failed:\n- ${failures.join('\n- ')}`;
        if (REQUIRE_DYNAMIC_ROUTES) {
            throw new Error(message);
        }

        console.warn(`\nWARN: ${message}\n`);
    }

    return discovered;
}

async function sweepEntry(
    page: import('@playwright/test').Page,
    entry: { url: string; name: string },
    theme: Theme
): Promise<PageResult> {
    const t0 = Date.now();
    const result: PageResult = {
        url: entry.url,
        name: entry.name,
        theme,
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

        await page.emulateMedia({ colorScheme: theme });
        await page.evaluate((currentTheme) => {
            window.localStorage.setItem('theme', currentTheme);
            document.documentElement.setAttribute('data-theme', currentTheme);
        }, theme);

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
            minor: violations.filter((v) => v.impact === 'minor').length,
            rules: violations.map((v) => ({ id: v.id, impact: v.impact ?? 'unknown' }))
        };
    } catch (e) {
        result.status = 'error';
        result.error = (e as Error).message;
    }

    result.durationMs = Date.now() - t0;
    return result;
}

async function main() {
    const detailEntries = await discoverDetailEntries();
    const entries = filterEntries([...INVENTORY, ...detailEntries]);

    if (entries.length === 0) {
        console.error(`No entries match ONLY_URL=${ONLY_URL}`);
        process.exit(1);
    }

    console.log(
        `\nA11y sweep — ${entries.length} pages x ${THEMES.length} themes (DRY_RUN=${DRY_RUN})`
    );
    console.log(`Base URL: ${BASE_URL}\n`);

    if (DRY_RUN) {
        for (const entry of entries) {
            for (const theme of THEMES) {
                console.log(`  ${entry.name} [${theme}]: ${entry.url}`);
            }
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
        for (const theme of THEMES) {
            process.stdout.write(`  ${entry.url} [${theme}] ... `);
            const r = await sweepEntry(page, entry, theme);
            results.push(r);

            const tag =
                r.status === 'ok' && r.axe
                    ? `OK (${r.durationMs}ms, axe=${r.axe.violations}v c${r.axe.critical}/s${r.axe.serious})`
                    : `ERR (${r.error})`;
            console.log(tag);
        }
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

    // Build the current per-page rule set from this run's violations.
    const current: Baseline = {};
    for (const r of results) {
        if (r.status === 'ok' && r.axe) {
            const key = baselineKey({ url: r.url, theme: r.theme });
            current[key] = [...new Set(r.axe.rules.map((rule) => rule.id))].sort();
        }
    }

    // Re-baseline mode: accept the current violations and exit without gating.
    if (UPDATE_BASELINE) {
        writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
        console.log(
            `\nBaseline updated → ${BASELINE_PATH} (${Object.keys(current).length} page/theme keys)`
        );
        return;
    }

    // A page that could not be analyzed is always an infra failure (this spec's
    // scope), independent of the a11y baseline.
    if (summary.error > 0) {
        console.error('\nFAIL: One or more pages could not be analyzed.');
        process.exit(1);
    }

    // Gate: fail only on NEW critical/serious violations not present in the
    // baseline. Pre-existing debt is tracked as a SPEC-270 follow-up; the gate
    // protects against regressions.
    const baseline = loadBaseline();
    const newViolations: Array<{ key: string; id: string; impact: string }> = [];
    for (const r of results) {
        if (r.status !== 'ok' || !r.axe) {
            continue;
        }
        const accepted = new Set(baseline[baselineKey({ url: r.url, theme: r.theme })] ?? []);
        for (const rule of r.axe.rules) {
            const blocking = rule.impact === 'critical' || rule.impact === 'serious';
            if (blocking && !accepted.has(rule.id)) {
                newViolations.push({
                    key: baselineKey({ url: r.url, theme: r.theme }),
                    id: rule.id,
                    impact: rule.impact
                });
            }
        }
    }

    if (newViolations.length > 0) {
        console.error(
            `\nFAIL: ${newViolations.length} NEW critical/serious violation(s) not in the baseline:`
        );
        for (const nv of newViolations) {
            console.error(`  - ${nv.key}: ${nv.id} (${nv.impact})`);
        }
        console.error(
            '\nFix the violation, or — if it is intentional and tracked — re-run with A11Y_UPDATE_BASELINE=1 to accept it.'
        );
        process.exit(1);
    }

    console.log(
        `\nPASS: no new critical/serious violations (${summary.totalCritical + summary.totalSerious} baselined as known debt).`
    );
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
