/**
 * @file usos-de-beneficio-page.test.ts
 * @description Source-level guards for the benefit-usage page (HOS-376 T-046).
 *
 * SCOPE, stated plainly: Vitest cannot render `.astro`, so these assertions
 * prove what the page DECLARES, not what it renders. They cover the failures
 * that are invisible in review and expensive in production — an i18n key absent
 * from the catalog or from the client prefix list, a raw `fetch`, a list read
 * after hydration instead of on the server — and they are NOT a substitute for
 * the browser check.
 *
 * The behaviour of the island itself is tested for real, with a DOM, in
 * `test/components/host/host-trades/BenefitUsagesPanel.test.tsx`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import esAccount from '../../../../packages/i18n/src/locales/es/account.json';
import esHostTrades from '../../../../packages/i18n/src/locales/es/host-trades.json';
import { ACCOUNT_NAV_GROUPS } from '../../src/config/navigation';
import { CLIENT_I18N_KEY_PREFIXES } from '../../src/lib/i18n-client-namespaces';

const PAGE_PATH = resolve(
    __dirname,
    '../../src/pages/[lang]/mi-cuenta/usos-de-beneficio/index.astro'
);
const ISLAND_PATH = resolve(
    __dirname,
    '../../src/components/host/host-trades/BenefitUsagesPanel.client.tsx'
);
const CARD_PATH = resolve(__dirname, '../../src/components/host/host-trades/BenefitUsageCard.tsx');
const PILL_PATH = resolve(
    __dirname,
    '../../src/components/host/host-trades/BenefitUsagesCountPill.client.tsx'
);
const REVIEW_PATH = resolve(
    __dirname,
    '../../src/components/host/host-trades/ReviewFormDialog.client.tsx'
);
const ACCOUNT_LAYOUT_PATH = resolve(__dirname, '../../src/layouts/AccountLayout.astro');

const pageSrc = readFileSync(PAGE_PATH, 'utf8');
const islandSrc = readFileSync(ISLAND_PATH, 'utf8');
const cardSrc = readFileSync(CARD_PATH, 'utf8');
const pillSrc = readFileSync(PILL_PATH, 'utf8');
const reviewSrc = readFileSync(REVIEW_PATH, 'utf8');
const accountLayoutSrc = readFileSync(ACCOUNT_LAYOUT_PATH, 'utf8');

/** Resolves a dotted `host-trades.*` key against the Spanish catalog. */
function resolveEsKey(dottedKey: string): unknown {
    return dottedKey
        .replace(/^host-trades\./, '')
        .split('.')
        .reduce<unknown>(
            (node, segment) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[segment]
                    : undefined,
            esHostTrades
        );
}

/**
 * Every literal `host-trades.*` key a source passes to `t()`.
 *
 * Template keys (`host-trades.usages.status.${...}`) are excluded by the regex
 * on purpose — they are covered by the enumerated checks further down, which
 * assert every member of each closed set rather than the interpolation.
 */
function collectHostTradeKeys(source: string): readonly string[] {
    const matches = source.matchAll(/['"](host-trades\.[a-zA-Z0-9._-]+)['"]/g);
    return [...new Set([...matches].map((match) => match[1] as string))];
}

// ---------------------------------------------------------------------------
// Rendering + data contract
// ---------------------------------------------------------------------------

describe('usos-de-beneficio page — rendering and auth', () => {
    it('is server-rendered, because it needs the visitor', () => {
        expect(pageSrc).toContain('export const prerender = false');
    });

    it('carries the in-page login redirect as a safety net for middleware', () => {
        expect(pageSrc).toContain('buildLoginRedirect');
    });

    it('reads both lists through the API client, never a raw fetch', () => {
        expect(pageSrc).toContain('hostTradesApi.listPendingUsages');
        expect(pageSrc).toContain('hostTradesApi.listUsages');
        expect(pageSrc).not.toMatch(/\bawait fetch\(/);
    });

    it('hands the server-read rows to the island instead of leaving it to fetch', () => {
        // The whole point of reading server-side: the screen is complete before
        // any JavaScript runs. An island that fetched on mount would show a
        // skeleton on every visit and lose the content for a crawler-free but
        // slow connection alike.
        expect(pageSrc).toContain('initialPending={pending}');
        expect(pageSrc).toContain('initialHistory={history}');
        expect(pageSrc).toContain('initialHistoryTotal={historyTotal}');
    });

    it('renders an explicit error instead of redirecting when a read fails', () => {
        // The host arrives here from a link in the confirmation e-mail; bouncing
        // him to the directory would read as "this does not exist".
        expect(pageSrc).toContain('loadFailed = true');
        expect(pageSrc).toContain('loadFailed={loadFailed}');
        expect(pageSrc).not.toMatch(/Astro\.redirect\([^)]*directorio/);
    });
});

// ---------------------------------------------------------------------------
// i18n — the load-bearing guards
// ---------------------------------------------------------------------------

describe('usos-de-beneficio page — i18n', () => {
    it('reads a non-trivial number of keys, so the checks below are not vacuous', () => {
        expect(collectHostTradeKeys(pageSrc).length).toBeGreaterThan(0);
        expect(collectHostTradeKeys(islandSrc).length).toBeGreaterThan(5);
    });

    it.each([
        ['page', () => collectHostTradeKeys(pageSrc)],
        ['island', () => collectHostTradeKeys(islandSrc)],
        ['card', () => collectHostTradeKeys(cardSrc)],
        ['review dialog', () => collectHostTradeKeys(reviewSrc)]
    ])('resolves every %s key against the Spanish catalog', (_name, keys) => {
        for (const key of keys()) {
            expect(resolveEsKey(key), `missing i18n key: ${key}`).toBeTruthy();
        }
    });

    it.each([
        'host-trades.usages',
        'host-trades.review'
    ])('registers %s for the production dictionary subset', (prefix) => {
        // Without this the islands render raw dotted keys in PRODUCTION
        // while dev looks perfect, because dev ships the whole dictionary.
        expect(CLIENT_I18N_KEY_PREFIXES).toContain(prefix);
    });

    it('never passes an empty fallback in the review dialog either', () => {
        expect(reviewSrc).not.toMatch(/t\(\s*['"][^'"]+['"]\s*,\s*''\s*\)/);
    });

    it.each([
        'PENDING',
        'CONFIRMED',
        'REJECTED',
        'EXPIRED'
    ])('has status copy for %s, which the island builds by interpolation', (status) => {
        expect(resolveEsKey(`host-trades.usages.status.${status}`)).toBeTruthy();
    });

    it.each([
        'ALL',
        'PENDING',
        'CONFIRMED',
        'REJECTED',
        'EXPIRED'
    ])('has filter copy for %s', (filter) => {
        expect(resolveEsKey(`host-trades.usages.filters.${filter}`)).toBeTruthy();
    });

    it('never passes an empty fallback, which would surface the raw key', () => {
        // `resolve()` treats '' as absent (`if (fallback)`), so `t(key, '')`
        // prints the dotted key in production.
        for (const source of [pageSrc, islandSrc, cardSrc]) {
            expect(source).not.toMatch(/t\(\s*['"][^'"]+['"]\s*,\s*''\s*\)/);
        }
    });
});

// ---------------------------------------------------------------------------
// Reachability
// ---------------------------------------------------------------------------

describe('usos-de-beneficio — reachability', () => {
    it('is linked from the host navigation group', () => {
        // A page nobody can navigate to is only reachable from the QR
        // confirmation screen, which is not where a host looks for his history.
        const host = ACCOUNT_NAV_GROUPS.find((group) => group.id === 'anfitrion');
        const item = host?.items.find((entry) => entry.id === 'benefitUsages');

        expect(item?.href).toBe('mi-cuenta/usos-de-beneficio');
        expect(item?.surfaces).toContain('sidebar');
    });

    it('has a label for that nav item in the Spanish catalog', () => {
        expect((esAccount as { nav: Record<string, string> }).nav.benefitUsages).toBeTruthy();
    });

    it('mounts the count badge on that nav item (T-047)', () => {
        expect(accountLayoutSrc).toContain(
            "item.id === 'benefitUsages' && <BenefitUsagesCountPill locale={locale} client:idle />"
        );
        expect(accountLayoutSrc).toContain(
            "import { BenefitUsagesCountPill } from '@/components/host/host-trades/BenefitUsagesCountPill.client';"
        );
    });
});

// ---------------------------------------------------------------------------
// The badge's rule (T-047)
// ---------------------------------------------------------------------------

describe('usos-de-beneficio — the nav badge clears on resolve, not on view', () => {
    it('makes no "mark as seen" CALL, which is what the whats-new molde has', () => {
        // The rule of §6.6, as a guard: a badge that cleared on view would hide
        // a usage still waiting for an answer.
        //
        // Scoped to call expressions, not to the word. A bare /seen/i over the
        // file flags the JSDoc that EXPLAINS why no such call exists — the guard
        // would then be reporting its own documentation as the defect, and the
        // only way to make it pass would be to delete the explanation.
        expect(pillSrc).not.toMatch(/\b(markSeen|markAllSeen|useWhatsNew)\s*\(/);
        expect(pillSrc).toContain('countPendingUsages()');
    });

    it('re-reads when the panel announces a resolved usage', () => {
        // Both halves: the panel emits and the badge listens on the same name.
        expect(islandSrc).toContain('BENEFIT_USAGES_UPDATED_EVENT');
        expect(islandSrc).toContain('window.dispatchEvent');
        expect(pillSrc).toContain('addEventListener(BENEFIT_USAGES_UPDATED_EVENT');
    });

    it('states the count in the accessible label, not only as a glyph', () => {
        expect(pillSrc).toContain('aria-label={label}');

        // The CLDR PAIR, not a base key: the label is pluralised through
        // `tPlural`, so `pendingCount` alone no longer resolves and asserting it
        // would only pass by un-pluralising the badge again. Both halves are
        // checked because a missing `_one` is invisible until exactly one usage
        // is pending — the most common case there is.
        expect(resolveEsKey('host-trades.usages.badge.pendingCount_one')).toBeTruthy();
        expect(resolveEsKey('host-trades.usages.badge.pendingCount_other')).toBeTruthy();
        expect(pillSrc).toContain('tPlural(');
    });
});
