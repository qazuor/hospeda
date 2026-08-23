/**
 * @file addons-status-gate-canonical-predicate.guard.test.ts
 * @description Static guard: the add-ons self-service page's UX-level
 * subscription gate must route through the canonical
 * `isEntitlementGrantingStatus` predicate (`@repo/billing`), never a
 * hand-rolled subscription-status list.
 *
 * HOS-594: `USABLE_SUBSCRIPTION_STATUSES = ['active', 'trial', 'trialing']`
 * silently omitted `comp` — the real gate lives server-side
 * (`addon.checkout.ts`, also fixed by HOS-594), but this page-level check
 * still hid the purchase UI from a comp subscriber whenever the backend
 * happened not to normalize their status first. Mirrors the API-side guard
 * (`apps/api/test/services/billing-status-gate-canonical-predicate.guard.test.ts`,
 * renamed and widened to the whole billing zone by HOS-702)
 * — same anti-pattern, same fix, different app.
 *
 * The anti-pattern check is deliberately NOT anchored on `.includes(` — a
 * reviewer could just as easily reintroduce the bug as a `switch`, a `Set`,
 * or a chain of `===` comparisons, none of which contain `.includes(`. The
 * guard instead flags any co-occurrence of the quoted literals `'active'`
 * and `'trialing'` within a short window, which is what a hand-rolled
 * entitlement-granting set looks like regardless of the JS construct used
 * to express it. The page's one deliberate, reviewed exception — accepting
 * the legacy `'trial'` value outside the predicate (see the inline comment
 * in the page) — does not trip this guard, since `'trial'` alone never
 * co-occurs with `'trialing'` in the fixed source.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ADDONS_PAGE = resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/addons/index.astro');

/** Matches importing the predicate from the canonical package. */
const PREDICATE_IMPORT = /isEntitlementGrantingStatus[\s\S]{0,120}?from\s+['"]@repo\/billing['"]/;

/** Matches an actual invocation, not just a mention in an import/comment. */
const PREDICATE_CALL = /isEntitlementGrantingStatus\s*\(/;

/**
 * How close two quoted status literals may sit before their co-occurrence is
 * treated as a hand-rolled entitlement-granting set. See the identical
 * constant/rationale in the API-side sibling guard.
 */
const PROXIMITY_WINDOW = 200;

/**
 * Strips `/* *\/` block comments and `//` line comments before the
 * anti-pattern scan runs, for the same reason as the API-side sibling guard:
 * the explanatory comment around this exact fix legitimately spells out both
 * status literals together to document WHY, and scanning comments would make
 * the guard fail on its own prose. Deliberately naive (no string-literal
 * awareness) — see the sibling guard's fuller rationale.
 */
function stripComments(source: string): string {
    const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlockComments.replace(/\/\/.*$/gm, '');
}

/**
 * Syntax-form-agnostic: flags any file where the quoted literals `'active'`
 * and `'trialing'` appear in live (non-comment) code within
 * {@link PROXIMITY_WINDOW} characters of each other, regardless of whether
 * they are joined by `.includes()`, `===`, a `switch`, or a `Set`.
 */
function hasHandRolledActiveTrialingPair(source: string): boolean {
    const liveCode = stripComments(source);
    const activePositions = [
        ...liveCode.matchAll(/['"]active['"]|SubscriptionStatusEnum\.ACTIVE\b/g)
    ].map((m) => m.index ?? -1);
    const trialingPositions = [
        ...liveCode.matchAll(/['"]trialing['"]|SubscriptionStatusEnum\.TRIALING\b/g)
    ].map((m) => m.index ?? -1);

    for (const activeIndex of activePositions) {
        for (const trialingIndex of trialingPositions) {
            if (Math.abs(activeIndex - trialingIndex) <= PROXIMITY_WINDOW) {
                return true;
            }
        }
    }
    return false;
}

/** Root of the web app's source tree, scanned below. */
const WEB_SRC_ROOT = resolve(__dirname, '../../src');

/**
 * Files under `apps/web/src` that rebuild the status set by hand and are
 * allowed to. The web app cannot import the server-side predicate, so the bar
 * here is different from the API's: what the scan protects against is a page
 * inventing its own idea of "subscription is live" and hiding paid UI from a
 * complimentary subscriber — which is exactly what HOS-594 did.
 */
const HAND_ROLLED_SCAN_EXCLUSIONS: ReadonlyArray<{
    readonly file: string;
    readonly why: string;
}> = [
    {
        file: 'components/billing/CheckoutStatusPoller.client.tsx',
        why: 'SUCCESS_STATUSES already includes comp; the second, separate set is deliberate because the API it polls remaps comp to active.'
    }
] as const;

/** Source extensions the scan reads — .astro included, since pages gate UI too. */
const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.astro'];

/** Recursively collect source files under a directory, as paths relative to it. */
function collectSourceFiles(dir: string, base: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full, base));
        } else if (SCANNED_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
            found.push(full.slice(base.length + 1));
        }
    }
    return found;
}

describe('HOS-594 guard: addons page status gate uses the canonical entitlement predicate', () => {
    const source = readFileSync(ADDONS_PAGE, 'utf8');

    it('imports isEntitlementGrantingStatus from @repo/billing', () => {
        expect(
            source,
            "The addons page does not import isEntitlementGrantingStatus from '@repo/billing'. " +
                'The subscription-usability check must route through the canonical predicate, never ' +
                'a hand-rolled status list (HOS-594).'
        ).toMatch(PREDICATE_IMPORT);
    });

    it('calls isEntitlementGrantingStatus', () => {
        expect(
            source,
            'The addons page imports isEntitlementGrantingStatus but never calls it — a leftover ' +
                'import alone does not satisfy this guard.'
        ).toMatch(PREDICATE_CALL);
    });

    it('does not hand-roll the active/trialing pair (misses comp — HOS-594)', () => {
        expect(
            hasHandRolledActiveTrialingPair(source),
            "The addons page contains the literal 'active' and 'trialing' string tokens close " +
                'together, which is the signature of hand-rolling the entitlement-granting set — it ' +
                "silently drops 'comp' regardless of whether it is written as .includes(), ===, a " +
                'switch, or a Set (HOS-594). Use isEntitlementGrantingStatus(subscription.status) ' +
                "instead (plus the page's own deliberate 'trial' exception, kept outside the " +
                'predicate on purpose).'
        ).toBe(false);
    });

    it('no unreviewed file under src/ hand-rolls the entitlement-granting set', () => {
        /*
         * HOS-594's page-level gate hid the purchase UI from a comp subscriber.
         * The server-side gate was the real one and was fixed too, but a page
         * that quietly disagrees with the server about who is entitled is its
         * own bug — and this file was the only one anybody had checked.
         */
        const allowed = new Set(HAND_ROLLED_SCAN_EXCLUSIONS.map((e) => e.file));
        const offenders = collectSourceFiles(WEB_SRC_ROOT, WEB_SRC_ROOT)
            .filter((file) => !allowed.has(file))
            .filter((file) =>
                hasHandRolledActiveTrialingPair(readFileSync(`${WEB_SRC_ROOT}/${file}`, 'utf-8'))
            );

        expect(
            offenders,
            `These files rebuild the entitlement-granting set by hand:\n` +
                `${offenders.map((f) => `  - ${f}`).join('\n')}\n\n` +
                'Omitting `comp` hides paid UI from complimentary subscribers (HOS-594). ' +
                'Either derive the set from the server response, or add the file to ' +
                'HAND_ROLLED_SCAN_EXCLUSIONS with the reason it is deliberate.'
        ).toEqual([]);
    });

    it('every scan exclusion still matches the pattern it excuses', () => {
        const stale = HAND_ROLLED_SCAN_EXCLUSIONS.filter(
            (entry) =>
                !hasHandRolledActiveTrialingPair(
                    readFileSync(`${WEB_SRC_ROOT}/${entry.file}`, 'utf-8')
                )
        ).map((entry) => entry.file);

        expect(
            stale,
            `Listed in HAND_ROLLED_SCAN_EXCLUSIONS but no longer matching:\n` +
                `${stale.map((f) => `  - ${f}`).join('\n')}`
        ).toEqual([]);
    });
});
