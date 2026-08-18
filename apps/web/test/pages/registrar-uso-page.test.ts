/**
 * @file registrar-uso-page.test.ts
 * @description Source-level guards for the QR landing page (HOS-376 T-045).
 *
 * SCOPE, stated plainly: Vitest cannot render `.astro`, so these assertions
 * prove what the page DECLARES, not what it renders. They are chosen for
 * exactly the failures that are invisible in review and expensive in
 * production — a timezone round-trip, a missing i18n key, a raw `fetch` — and
 * they are deliberately NOT a substitute for the browser check.
 *
 * The i18n assertions are the load-bearing ones. A key absent from the catalog,
 * or a prefix absent from `CLIENT_I18N_KEY_PREFIXES`, renders the raw dotted key
 * in PRODUCTION while dev looks perfect, because dev ships the whole dictionary.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import esHostTrades from '../../../../packages/i18n/src/locales/es/host-trades.json';
import { CLIENT_I18N_KEY_PREFIXES } from '../../src/lib/i18n-client-namespaces';

const PAGE_PATH = resolve(
    __dirname,
    '../../src/pages/[lang]/mi-cuenta/directorio-proveedores/[slug]/registrar-uso/index.astro'
);
const ISLAND_PATH = resolve(
    __dirname,
    '../../src/components/host/host-trades/RegisterUsageForm.client.tsx'
);

const pageSrc = readFileSync(PAGE_PATH, 'utf8');
const islandSrc = readFileSync(ISLAND_PATH, 'utf8');

/**
 * The single statement that derives today's date in the page frontmatter.
 *
 * Scoped to that statement on purpose. Both files NAME the construct they avoid
 * inside their own comments ("`toISOString` rolls over…"), so a whole-file
 * `not.toContain('toISOString')` reports the documentation that prevents the bug
 * as if it were the bug. Stripping comments first was tried and is worse: a
 * comment regex over Astro source — frontmatter, JSX `{/* … *​/}` and a CSS
 * block in one file — silently ate the very statement under test, leaving a
 * guard that passed because it was reading nothing at all.
 *
 * Reading one statement is narrower, and it is honest about what it proves.
 */
const todayStatement = /const today = ([\s\S]*?);\n/.exec(pageSrc)?.[1] ?? '';

/** The arguments the island hands to `declareUsage`. */
const declareCall = /declareUsage\(\{([\s\S]*?)\}\)/.exec(islandSrc)?.[1] ?? '';

/** Resolves a dotted `host-trades.*` key against the Spanish catalog. */
function resolveEsKey(dottedKey: string): unknown {
    const withoutNamespace = dottedKey.replace(/^host-trades\./, '');
    return withoutNamespace
        .split('.')
        .reduce<unknown>(
            (node, segment) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[segment]
                    : undefined,
            esHostTrades
        );
}

/** Every `host-trades.*` key either file passes to `t()`. */
function collectHostTradeKeys(source: string): readonly string[] {
    const matches = source.matchAll(/['"`](host-trades\.[a-zA-Z0-9._-]+)['"`]/g);
    return [...new Set([...matches].map((match) => match[1] as string))];
}

// ---------------------------------------------------------------------------
// Rendering + auth contract
// ---------------------------------------------------------------------------

describe('registrar-uso page — rendering and auth', () => {
    it('is server-rendered, because it needs the visitor', () => {
        expect(pageSrc).toContain('export const prerender = false');
    });

    it('carries the in-page login redirect as a safety net for middleware', () => {
        expect(pageSrc).toContain('buildLoginRedirect');
    });

    it('reads the provider through the API client, never a raw fetch', () => {
        expect(pageSrc).toContain('hostTradesApi.getBySlug');
        // `apps/web/CLAUDE.md`: pages must not call `fetch()` directly. The
        // sibling directory page still does; this one must not inherit that.
        expect(pageSrc).not.toMatch(/\bawait fetch\(/);
    });
});

// ---------------------------------------------------------------------------
// The timezone guard — the reason this file exists
// ---------------------------------------------------------------------------

describe('registrar-uso page — the service date', () => {
    it('derives today in one statement the guards below can actually read', () => {
        // The complementary half. Without it, a rename of `today` makes every
        // assertion below vacuous against an empty string — the exact way the
        // first version of this guard passed while the bug was present.
        expect(todayStatement.length).toBeGreaterThan(0);
        expect(declareCall.length).toBeGreaterThan(0);
    });

    it("resolves today in the market's timezone, not the server's", () => {
        expect(todayStatement).toContain('Intl.DateTimeFormat');
        expect(todayStatement).toContain('MARKET_TIMEZONE');
        expect(pageSrc).toContain("MARKET_TIMEZONE = 'America/Argentina/Buenos_Aires'");
    });

    it('never derives the date through toISOString', () => {
        // The Node server runs UTC, so slicing an ISO string rolls over to
        // TOMORROW at 21:00 local time: a host recording an evening service is
        // handed a future date and then blocked by the form's own future-date
        // guard. The island test cannot catch this — it only forwards the string
        // it is given, and the test environment is itself UTC.
        expect(todayStatement).not.toContain('toISOString');
    });

    it('forwards the picked date to the API untouched, with no Date round-trip', () => {
        expect(declareCall).toContain('servicedAt');
        expect(declareCall).not.toContain('Date');
    });
});

// ---------------------------------------------------------------------------
// The four terminal states
// ---------------------------------------------------------------------------

describe('registrar-uso page — terminal states', () => {
    it('tells a revoked provider apart from one that never existed', () => {
        expect(pageSrc).toContain("outcome = 'revoked'");
        expect(pageSrc).toContain("outcome = 'notFound'");
        expect(pageSrc).toContain("outcome = 'error'");
    });

    it('matches revocation on the error CODE, not on the 422 status', () => {
        // A validation failure is also 422, and it is a different screen.
        expect(pageSrc).toContain("result.error.code === 'PROVIDER_REVOKED'");
    });

    it('detects the missing provider by its 404 status', () => {
        expect(pageSrc).toContain('result.error.status === 404');
    });

    it('offers a retry only for the transient failure', () => {
        // A 404 and a revocation are deterministic — a retry button on those
        // invites a click that can never succeed.
        expect(pageSrc).toContain("outcome === 'error' ? (");
        expect(pageSrc).toContain('registerUsage.loadError.retry');
    });
});

// ---------------------------------------------------------------------------
// H-05 — a 403 (non-host scanned the QR) is NOT a load error
// ---------------------------------------------------------------------------

describe('registrar-uso page — 403 is a gate, not a failure (H-05)', () => {
    /** The branch body between `outcome = 'accessDenied';` and the next `} else`. */
    const accessDeniedBranch =
        /outcome = 'accessDenied';([\s\S]*?)\n\s*\} else if/.exec(pageSrc)?.[1] ?? '';

    it('branches on the 403 status, distinct from 404/422/other errors', () => {
        expect(pageSrc).toContain('result.error.status === 403');
        expect(pageSrc).toContain("outcome = 'accessDenied'");
    });

    it('does not log an expected 403 as a failure', () => {
        // Without this branch existing, the previous test already proves the
        // bug; this one guards the regression once it does exist — a 403
        // must never reach the `logger.error` call reserved for the
        // transient/unknown branch.
        expect(accessDeniedBranch.length).toBeGreaterThan(0);
        expect(accessDeniedBranch).not.toContain('logger.error');
    });

    it('renders the shared host-only gate for a 403, not the generic "could not load" card', () => {
        expect(pageSrc).toContain('HostTradesAccessDenied');
        expect(pageSrc).toMatch(/outcome === 'accessDenied' \? \(\s*<HostTradesAccessDenied/);
    });

    it('never shows the "reload the page" retry CTA for an access-denied read', () => {
        // The 403 keeps firing by design (HOST_TRADE_VIEW) — retrying can
        // never succeed for this outcome, unlike the transient 'error' case.
        expect(pageSrc).not.toMatch(/outcome === 'accessDenied'[\s\S]{0,80}loadError\.retry/);
    });
});

// ---------------------------------------------------------------------------
// Island wiring + styling rules
// ---------------------------------------------------------------------------

describe('registrar-uso page — island and styling', () => {
    it('hydrates the form, which is the whole point of the page', () => {
        expect(pageSrc).toMatch(/<RegisterUsageForm[\s\S]*?client:load/);
    });

    it('passes the provider slug and today down to the island', () => {
        expect(pageSrc).toContain('providerSlug={provider.slug}');
        expect(pageSrc).toContain('today={today}');
    });

    it('styles the island with a CSS Module, as the web app requires', () => {
        expect(islandSrc).toContain("from './RegisterUsageForm.module.css'");
    });

    it('uses no Tailwind utility classes — those are admin-only', () => {
        for (const utility of [
            'className="flex',
            'className="grid',
            'class="flex ',
            'text-sm',
            'bg-white',
            'px-4'
        ]) {
            expect(islandSrc + pageSrc).not.toContain(utility);
        }
    });
});

// ---------------------------------------------------------------------------
// i18n — the production-only failure class
// ---------------------------------------------------------------------------

describe('registrar-uso — i18n keys resolve', () => {
    it('registers the island prefix, or the island renders raw keys in prod', () => {
        expect(CLIENT_I18N_KEY_PREFIXES).toContain('host-trades.registerUsage');
    });

    it('uses at least one host-trades key in each file', () => {
        // The complementary half: without this, the per-key loops below would
        // pass vacuously if the regex ever stopped matching anything.
        expect(collectHostTradeKeys(pageSrc).length).toBeGreaterThan(5);
        expect(collectHostTradeKeys(islandSrc).length).toBeGreaterThan(5);
    });

    it('resolves every host-trades key the page uses to real Spanish copy', () => {
        for (const key of collectHostTradeKeys(pageSrc)) {
            // The category key is built dynamically from the enum value; the
            // catalog is asserted for the whole set elsewhere.
            if (key.startsWith('host-trades.categories.')) continue;
            expect(resolveEsKey(key), `missing i18n key: ${key}`).toBeTypeOf('string');
        }
    });

    it('resolves every host-trades key the island uses to real Spanish copy', () => {
        for (const key of collectHostTradeKeys(islandSrc)) {
            expect(resolveEsKey(key), `missing i18n key: ${key}`).toBeTypeOf('string');
        }
    });

    it('keeps the interpolation placeholders the copy promises', () => {
        expect(resolveEsKey('host-trades.registerUsage.success.body')).toContain('{{name}}');
        expect(resolveEsKey('host-trades.registerUsage.form.note.counter')).toContain(
            '{{remaining}}'
        );
    });
});
