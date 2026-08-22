/**
 * @file billing-status-gate-canonical-predicate.guard.test.ts
 * @description Static guard: every service-core gate that asks "is this
 * subscription live right now?" must route through the canonical
 * `isEntitlementGrantingStatus` / `ENTITLEMENT_GRANTING_STATUSES` export
 * (`@repo/billing`), never a hand-rolled subscription-status comparison.
 *
 * Sibling of `apps/api/test/services/billing-status-gate-canonical-predicate.guard.test.ts`
 * — same anti-pattern, same fix, different package. Two guards rather than one
 * because each can only read its own package's `src`.
 *
 * ## The defect class
 *
 * `subscriptions.find((sub) => sub.status === 'active' || sub.status ===
 * 'trialing')` silently drops `comp`. That single omission is HOS-238
 * (entitlements resolved against no plan), HOS-239 (`plan: null` for comped
 * subscribers), and HOS-594 (add-on sales dead in production for months) — the
 * same bug, shipped three times, in three different files.
 * `isEntitlementGrantingStatus` already resolves the correct set
 * (`active | trialing | comp`, see
 * `packages/billing/src/predicates/is-entitlement-granting-status.ts`); the bug
 * was always call sites that never migrated to it.
 *
 * HOS-702 audited the whole billing surface (64 raw literal comparisons across
 * 41 files), triaged out the legitimate ones (the `isSubscriptionLive`
 * predicate itself, newsletter subscription status, addon PURCHASE status, and
 * management-only actions where `comp` is excluded on purpose because a
 * complimentary subscription has no MercadoPago preapproval to
 * cancel/pause/re-price), and migrated the real ones — the files listed below.
 *
 * ## Why the anti-pattern check is shaped this way
 *
 * It is deliberately NOT anchored on `===` or any other single syntax form. The
 * bug reads identically as `['active', 'trialing'].includes(sub.status)`, a
 * `switch` with `case 'active':` / `case 'trialing':`, or `new Set(['active',
 * 'trialing']).has(sub.status)` — all of which silently drop `comp`, and none of
 * which contain a `===` token. The guard instead flags any file where the quoted
 * literals `'active'` and `'trialing'` appear within a short window of each
 * other in LIVE code: that co-occurrence IS the bug, regardless of the
 * construct, because it means someone reconstructed the entitlement-granting set
 * by hand instead of calling the predicate that already encodes it correctly.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

/**
 * Files that decide subscription liveness for a billing/entitlement gate, and
 * how many canonical-predicate references each must contain (one per historical
 * hand-rolled call site — HOS-702).
 */
const BILLING_STATUS_GATE_FILES = [
    { file: 'services/billing/addon/addon-user-addons.ts', minCalls: 1 },
    { file: 'services/billing/addon/addon-limit-recalculation.service.ts', minCalls: 1 },
    { file: 'services/commerce/commerce-visibility.ts', minCalls: 1 },
    { file: 'services/accommodation/featured-entitlement.resolver.ts', minCalls: 1 }
] as const;

/**
 * Matches an actual use of the canonical export — either a predicate
 * invocation or a reference to the const set — not just a mention in a comment.
 */
const PREDICATE_USE = /(isEntitlementGrantingStatus\s*\(|ENTITLEMENT_GRANTING_STATUSES\b)/g;

/** Matches importing either canonical export from the canonical package. */
const PREDICATE_IMPORT =
    /(isEntitlementGrantingStatus|ENTITLEMENT_GRANTING_STATUSES)[\s\S]{0,200}?from\s+['"]@repo\/billing['"]/;

/**
 * How close two quoted status literals may sit before we treat their
 * co-occurrence as "someone re-implemented the entitlement-granting set by
 * hand". 200 chars comfortably spans a multi-line boolean expression,
 * `.includes([...])` call, `switch` block, or `Set` literal, while staying far
 * short of spanning two unrelated statements in these files.
 */
const PROXIMITY_WINDOW = 200;

/**
 * Strips block comments (including JSDoc) and `//` line comments before the
 * anti-pattern scan runs. Deliberate: the JSDoc/inline comments around a fix
 * like this one legitimately spell out both status literals together to explain
 * WHY — scanning comments would make this guard fail on its own explanatory
 * prose. Only literals in live code should trip it.
 *
 * Deliberately naive (no string-literal awareness): a `//` inside a quoted
 * string on the same line as real code would also get stripped from that point
 * onward. None of the guarded files contain a status literal that way, and a
 * false negative here just means "guard misses a rare case", not "guard flags
 * legitimate code".
 */
function stripComments(source: string): string {
    const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlockComments.replace(/\/\/.*$/gm, '');
}

/**
 * Returns true if the quoted literals `'active'`/`"active"` and
 * `'trialing'`/`"trialing"` both appear in live (non-comment) code, within
 * {@link PROXIMITY_WINDOW} characters of each other. Syntax-form agnostic by
 * construction.
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

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

/**
 * Files under `packages/service-core/src` that rebuild the status set by hand
 * and are allowed to, each with the reason. Same triage criterion as the
 * `apps/api` sibling guard: does this path touch a MercadoPago preapproval? If
 * it does, excluding `comp` is correct — a complimentary subscription has
 * `mp_subscription_id = NULL` by design.
 *
 * A file that lands in the pattern and is NOT listed fails the scan below.
 */
const HAND_ROLLED_SCAN_EXCLUSIONS: ReadonlyArray<{
    readonly file: string;
    readonly why: string;
}> = [
    {
        file: 'services/billing/plan/plan-price-change.service.ts',
        why: 'Its own docstring says it: comp is excluded because there is no preapproval to re-price.'
    },
    {
        file: 'services/billing/subscription/subscription-status-constants.ts',
        why: 'Pure status constants — enumerating them is the whole point of the file.'
    },
    {
        file: 'services/billing/subscription/subscription-status-normalize.ts',
        why: 'The qzpay→Hospeda spelling map. It must name every status to translate them.'
    },
    {
        file: 'services/billing/subscription/subscription-status-transitions.ts',
        why: 'The transition state machine, which documents COMP explicitly. Enumerating states is its definition.'
    }
] as const;

/** Source extensions the scan reads. */
const SCANNED_EXTENSIONS = ['.ts', '.tsx'];

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

describe('HOS-702 guard: service-core billing status gates use the canonical predicate', () => {
    it.each(
        BILLING_STATUS_GATE_FILES.map((f) => f.file)
    )('%s imports the canonical entitlement-status export from @repo/billing', (file) => {
        const source = readSrc(file);
        expect(
            source,
            `${file} does not import isEntitlementGrantingStatus / ` +
                "ENTITLEMENT_GRANTING_STATUSES from '@repo/billing'. Subscription " +
                'liveness must be resolved via the canonical predicate ' +
                '(packages/billing/src/predicates/is-entitlement-granting-status.ts), ' +
                'never a hand-rolled subscription-status comparison (HOS-702).'
        ).toMatch(PREDICATE_IMPORT);
    });

    it.each(
        BILLING_STATUS_GATE_FILES
    )('$file uses the canonical entitlement-status export at least $minCalls time(s)', ({
        file,
        minCalls
    }) => {
        const source = readSrc(file);
        const useCount = [...source.matchAll(PREDICATE_USE)].length;
        expect(
            useCount,
            `${file} uses the canonical entitlement-status export only ${useCount} ` +
                `time(s), expected at least ${minCalls}. Every hand-rolled status check ` +
                'in this file must route through it, not just be imported once elsewhere.'
        ).toBeGreaterThanOrEqual(minCalls);
    });

    it.each(
        BILLING_STATUS_GATE_FILES.map((f) => f.file)
    )('%s does not hand-roll the active/trialing pair (misses comp — HOS-702)', (file) => {
        const source = readSrc(file);
        expect(
            hasHandRolledActiveTrialingPair(source),
            `${file} contains the literal 'active' and 'trialing' string tokens close ` +
                'together, which is the signature of hand-rolling the entitlement-granting ' +
                "set — it silently drops 'comp' regardless of whether it is written as ===, " +
                '.includes(), a switch, or a Set (HOS-702). Use ' +
                'isEntitlementGrantingStatus(sub.status) or ENTITLEMENT_GRANTING_STATUSES ' +
                'instead.'
        ).toBe(false);
    });

    it('no unreviewed file under src/ hand-rolls the entitlement-granting set', () => {
        /*
         * The scan the family asked for. A whitelist proves the reviewed files
         * have not regressed and says nothing about a new one — but the defect
         * class is precisely "somebody writes a NEW hand-rolled set". Scanning
         * moves the burden onto whoever writes it: route through the canonical
         * predicate, or record why this file is an exception.
         */
        const allowed = new Set(HAND_ROLLED_SCAN_EXCLUSIONS.map((e) => e.file));
        const offenders = collectSourceFiles(SRC_ROOT, SRC_ROOT)
            .filter((file) => !allowed.has(file))
            .filter((file) => hasHandRolledActiveTrialingPair(readSrc(file)));

        expect(
            offenders,
            `These files rebuild the entitlement-granting set by hand:\n` +
                `${offenders.map((f) => `  - ${f}`).join('\n')}\n\n` +
                'Omitting `comp` that way is HOS-238, HOS-239 and HOS-594. Use ' +
                'isEntitlementGrantingStatus / ENTITLEMENT_GRANTING_STATUSES ' +
                '(@repo/billing), or add the file to HAND_ROLLED_SCAN_EXCLUSIONS with ' +
                'the reason it is deliberate.'
        ).toEqual([]);
    });

    it('every scan exclusion still exists and still needs to be there', () => {
        // An exclusion rots two ways: the file is renamed and the entry guards
        // nothing, or the file is migrated and the entry blindfolds the scan
        // against a future regression in it.
        const stale = HAND_ROLLED_SCAN_EXCLUSIONS.filter(
            (entry) => !hasHandRolledActiveTrialingPair(readSrc(entry.file))
        ).map((entry) => entry.file);

        expect(
            stale,
            `Listed in HAND_ROLLED_SCAN_EXCLUSIONS but no longer matching the ` +
                `pattern:\n${stale.map((f) => `  - ${f}`).join('\n')}`
        ).toEqual([]);
    });
});
