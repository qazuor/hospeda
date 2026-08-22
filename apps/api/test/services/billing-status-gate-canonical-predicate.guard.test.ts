/**
 * @file billing-status-gate-canonical-predicate.guard.test.ts
 * @description Static guard: every API-side billing gate that asks "is this
 * subscription live right now?" must route through the canonical
 * `isEntitlementGrantingStatus` / `ENTITLEMENT_GRANTING_STATUSES` export
 * (`@repo/billing`), never a hand-rolled subscription-status comparison.
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
 * `packages/billing/src/predicates/is-entitlement-granting-status.ts`) and had
 * its own passing tests the whole time; the bug was always call sites that
 * never migrated to it.
 *
 * ## Scope (HOS-702)
 *
 * HOS-594 deliberately scoped its version of this guard to the two files that
 * fix touched, explicitly listing the unmigrated remainder as out of scope.
 * HOS-702 audited that remainder — 64 raw literal comparisons across 41 files —
 * triaged out the legitimate ones (the `isSubscriptionLive` predicate itself,
 * newsletter subscription status, addon PURCHASE status, the remapped web-front
 * vocabulary, and management-only actions where `comp` is excluded on purpose
 * because a complimentary subscription has no MercadoPago preapproval to
 * cancel/pause/re-price), migrated the real ones, and widened the guard to the
 * billing zone that actually migrated. Files NOT in this list are either out of
 * this guard's scope by triage or, in the case of exhaustive status→label
 * mappers (`routes/host/protected/dashboard.ts`), files where enumerating every
 * status IS the definition.
 *
 * ## Why the anti-pattern check is shaped this way
 *
 * The defect class is "N call sites forgot to use the shared predicate", so the
 * assertion has to be over the SET of gate call sites, not over one call site's
 * runtime behaviour — a unit test for `addon.checkout.ts` alone would never
 * have caught the identical bug sitting in `addon-entitlement.service.ts`.
 *
 * The check below is deliberately NOT anchored on `===` or any other single
 * syntax form. A reviewer could just as easily reintroduce the bug as
 * `['active', 'trialing'].includes(sub.status)`, a `switch` with
 * `case 'active':` / `case 'trialing':`, or `new Set(['active',
 * 'trialing']).has(sub.status)` — all of which silently drop `comp` exactly
 * like the original bug, and NONE of which contain a `===` token. Instead, the
 * guard flags any file where the string literals `'active'` and `'trialing'`
 * (quoted, so prose in a comment doesn't trip it) appear within a short window
 * of each other — that co-occurrence IS the bug, regardless of which JS
 * construct expresses it, because it means someone reconstructed the
 * entitlement-granting set by hand instead of calling the predicate that
 * already encodes it correctly.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../src');

/**
 * Files that decide subscription liveness for a billing gate, and how many
 * canonical-predicate references each must contain (one per historical
 * hand-rolled call site — HOS-594 for the add-on pair, HOS-702 for the rest).
 */
const BILLING_STATUS_GATE_FILES = [
    // HOS-594 (the original pair).
    { file: 'services/addon.checkout.ts', minCalls: 3 },
    { file: 'services/addon-entitlement.service.ts', minCalls: 3 },
    // HOS-702 (migrated in this change).
    { file: 'routes/billing/start-paid.ts', minCalls: 2 },
    { file: 'cron/jobs/addon-expiry.job.ts', minCalls: 2 },
    { file: 'services/usage-tracking.service.ts', minCalls: 1 },
    {
        file: 'services/trial.service.ts',
        minCalls: 3,
        // Uses the predicate for its real gates AND legitimately enumerates
        // statuses elsewhere: a comp-first ranking, a documented short-circuit,
        // and a TRIALING-only cron query (a comp is never trialing).
        alsoEnumerates: true
    },
    { file: 'services/partner-reconcile.service.ts', minCalls: 1 },
    { file: 'services/billing/subscription-domain-metadata.ts', minCalls: 1 },
    { file: 'routes/commerce/protected/start-subscription.ts', minCalls: 1 },
    // HOS-702 (already migrated before this change — pinned so they cannot regress).
    { file: 'routes/user/protected/entitlements.ts', minCalls: 1 },
    { file: 'routes/user/protected/subscription.ts', minCalls: 1 },
    { file: 'routes/user/protected/stats.ts', minCalls: 1 },
    { file: 'middlewares/owner-entitlement.ts', minCalls: 2 },
    { file: 'middlewares/commerce-entitlement.ts', minCalls: 1 },
    {
        file: 'services/commerce-subscription-attach.service.ts',
        minCalls: 1,
        // findOwnerVerticalSubscription uses the predicate; SLOT_OCCUPYING_STATUSES
        // in the same file enumerates by hand and omits comp. Unreachable today —
        // subscription-comp-create rejects non-accommodation plans — so it is a
        // latent gap, tracked rather than force-migrated.
        alsoEnumerates: true
    }
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
 * WHY (e.g. "the hand-rolled `['active', 'trialing']` pair used to miss
 * `comp`") — scanning comments would make this guard fail on its own
 * explanatory prose. Only literals in live code should trip it.
 *
 * Deliberately naive (no string-literal awareness): a `//` inside a quoted
 * string on the same line as real code would also get stripped from that point
 * onward. None of the guarded files contain a status literal that way, and a
 * false negative here just means "guard misses a rare case", not "guard flags
 * legitimate code" — an acceptable trade-off for a source-level scan.
 */
function stripComments(source: string): string {
    const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlockComments.replace(/\/\/.*$/gm, '');
}

/**
 * Returns true if the quoted literals `'active'`/`"active"` and
 * `'trialing'`/`"trialing"` both appear in live (non-comment) code, within
 * {@link PROXIMITY_WINDOW} characters of each other. Syntax-form agnostic by
 * construction: it does not care whether they are joined by `===`,
 * `.includes()`, a `switch`, or a `Set` — only that they co-occur, which is the
 * actual signature of the bug (reconstructing the entitlement-granting set by
 * hand instead of calling the canonical predicate).
 */
function hasHandRolledActiveTrialingPair(source: string): boolean {
    const liveCode = stripComments(source);

    /*
     * Both spellings, because they are the same reconstruction wearing
     * different clothes. Anchoring only on the quoted literals — which is what
     * this guard did until HOS-679 — left `SubscriptionStatusEnum.ACTIVE` +
     * `SubscriptionStatusEnum.TRIALING` completely invisible. That was not
     * theoretical: a sweep of 2698 source files found NINE files using the enum
     * form and zero using both, so the enum spelling was not a rare variant —
     * it was an entire blind half. Two of those nine were already listed in
     * BILLING_STATUS_GATE_FILES, which means their anti-pattern assertion could
     * never have failed.
     */
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

/**
 * Every file under `apps/api/src` that reconstructs the status set by hand and
 * is allowed to, each with the reason it is allowed. Triaged file by file
 * against the criterion HOS-702 established:
 *
 *   **Does this path touch a MercadoPago preapproval?**
 *
 * If it does, excluding `comp` is CORRECT and adding it would be the opposite
 * bug — a complimentary subscription has `mp_subscription_id = NULL` by design,
 * so there is no preapproval to cancel, pause or re-price. Most entries below
 * already carry that reasoning in their own source, several citing the issue
 * number; this list records the verdict, it does not invent it.
 *
 * An entry here is a claim someone had to make deliberately. A file that lands
 * in the pattern and is NOT listed fails the scan below — which is the whole
 * point: the burden moves onto whoever writes the next hand-rolled set.
 */
const HAND_ROLLED_SCAN_EXCLUSIONS: ReadonlyArray<{
    readonly file: string;
    readonly why: string;
}> = [
    // ── Definition: enumerating the statuses IS what the file is for ────────
    {
        file: 'routes/host/protected/dashboard.ts',
        why: 'mapQZPayStatusToDashboard is an exhaustive status→label mapper (and maps comp→active). Its real entitlement gate already calls the canonical predicate.'
    },
    {
        file: 'services/admin-billing-view.status.ts',
        why: 'STORED_SUBSCRIPTION_STATUS_SPELLINGS enumerates every stored spelling, comp included — the enumeration is the definition.'
    },
    {
        file: 'services/billing/trial-eligibility.service.ts',
        why: 'Classifies "has this account consumed its trial", not whether benefits apply; comp is handled by its own documented branch.'
    },
    {
        file: 'services/trial.service.ts',
        why: 'Already imports and uses the canonical predicate; the remaining literals are a comp-first ranking, a documented short-circuit, and a TRIALING-only cron query.'
    },

    // ── MercadoPago management: excluding comp is correct ───────────────────
    {
        file: 'cron/jobs/propagate-plan-price-changes.job.ts',
        why: 'Re-prices the MercadoPago preapproval directly; a comp subscription has none.'
    },
    {
        file: 'cron/jobs/finalize-cancelled-subs.ts',
        why: 'Hard-cancels the preapproval after finalizing.'
    },
    {
        file: 'cron/jobs/preapproval-less-expiry.job.ts',
        why: 'Its own docstring: comp has no preapproval and must never be reaped — excluded by the status filter, deliberately.'
    },
    {
        file: 'routes/billing/admin/qzpay-admin-hooks.ts',
        why: 'Guards on "MercadoPago only accepts pausing an active preapproval".'
    },
    {
        file: 'routes/billing/plan-change.ts',
        why: 'Selects the subscription it then mutates through changePlan / applyTrialingPlanUpgrade — both preapproval operations.'
    },
    {
        file: 'routes/billing/subscription-pause.ts',
        why: 'Docstring: annual subscriptions have no preapproval to pause.'
    },
    {
        file: 'routes/webhooks/mercadopago/payment-logic.ts',
        why: 'Carries an explicit HOS-714 note telling the next sweep NOT to migrate it: changePlan() twelve lines below mutates a preapproval.'
    },
    {
        file: 'routes/webhooks/mercadopago/subscription-logic.ts',
        why: 'Runs inside a MercadoPago webhook, so only for subscriptions that have a preapproval. Its featured-entitlement branch does include COMP by hand — correct today, and tracked as drift risk rather than migrated blind.'
    },
    {
        file: 'services/billing/apply-price-increase.service.ts',
        why: 'Re-prices preapprovals, and additionally filters on isNotNull(mpSubscriptionId), so comp is excluded twice over. (The missing D-4 note on trialing is HOS-747, a documentation gap, not a behaviour one.)'
    },
    {
        file: 'services/subscription-cancel.service.ts',
        why: 'Pauses the MercadoPago preapproval via qzpay-core.'
    },
    {
        file: 'services/subscription-uncancel.service.ts',
        why: 'Re-authorizes the MercadoPago preapproval via qzpay-core.'
    },

    // ── Open questions, deliberately excluded rather than force-migrated ────
    {
        file: 'services/plan-disable-lifecycle.service.ts',
        why: 'LIVE_STATUSES omits comp, but this path never calls MercadoPago (verified: zero preapproval/qzpay references) — it only flips cancelAtPeriodEnd and notifies. So a comped subscriber is invisible to plan retirement: never told, never migrated. That is the INVERSE of the historical bug (benefits kept, not denied) and is a product decision, not something a guard should force. Tracked as an owner decision.'
    },
    {
        file: 'services/commerce-subscription-attach.service.ts',
        why: 'SLOT_OCCUPYING_STATUSES omits comp while findOwnerVerticalSubscription in the same file uses the canonical predicate. Unreachable today — subscription-comp-create rejects non-accommodation plans — so it is a latent gap, not a live bug.'
    }
] as const;

/** Source extensions the scan reads. */
const SCANNED_EXTENSIONS = ['.ts', '.tsx'];

/** Recursively collect source files under a directory, as repo-relative paths. */
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

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

describe('HOS-702 guard: API billing status gates use the canonical entitlement predicate', () => {
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
                'never a hand-rolled subscription-status comparison (HOS-594 / HOS-702).'
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

    /*
     * Only the files whose ENTIRE relationship with the status set is the
     * predicate. The two carrying `alsoEnumerates` do both things at once —
     * they gate through the predicate and separately enumerate statuses for a
     * different, legitimate purpose — so this particular assertion cannot say
     * anything true about them.
     *
     * Worth recording how they surfaced: until HOS-679 taught the detector the
     * `SubscriptionStatusEnum` spelling, this test PASSED on both, because it
     * only ever looked for quoted literals. It was not proving them clean, it
     * was unable to see them. Widening the detector is what turned a vacuous
     * green into a real question — and the honest answer is an exemption with a
     * reason, not a weaker predicate.
     */
    it.each(
        BILLING_STATUS_GATE_FILES.filter((f) => !('alsoEnumerates' in f)).map((f) => f.file)
    )('%s does not hand-roll the active/trialing pair (misses comp — HOS-594/HOS-702)', (file) => {
        const source = readSrc(file);
        expect(
            hasHandRolledActiveTrialingPair(source),
            `${file} contains the literal 'active' and 'trialing' string tokens close ` +
                'together, which is the signature of hand-rolling the entitlement-granting ' +
                "set — it silently drops 'comp' regardless of whether it is written as ===, " +
                '.includes(), a switch, or a Set (HOS-594 / HOS-702). Use ' +
                'isEntitlementGrantingStatus(sub.status) or ENTITLEMENT_GRANTING_STATUSES ' +
                'instead.'
        ).toBe(false);
    });

    it('no unreviewed file under src/ hand-rolls the entitlement-granting set', () => {
        /*
         * The assertion HOS-679 actually asked for.
         *
         * Until now this guard was a whitelist of fifteen files: it proved
         * those fifteen had not regressed, and said nothing at all about a
         * sixteenth. But the defect class is "someone writes a NEW hand-rolled
         * set", so a whitelist can only ever confirm what has already been
         * reviewed. That is the difference between guarding against regression
         * and guarding against recurrence — and recurrence is what shipped this
         * bug three times.
         *
         * Scanning inverts the burden: a new file that reconstructs the set
         * fails CI, and the author either routes it through the canonical
         * predicate or adds an entry to HAND_ROLLED_SCAN_EXCLUSIONS saying why
         * it is correct. Both outcomes are fine; silence is not.
         */
        const allowed = new Set(HAND_ROLLED_SCAN_EXCLUSIONS.map((e) => e.file));
        const offenders = collectSourceFiles(SRC_ROOT, SRC_ROOT)
            .filter((file) => !allowed.has(file))
            .filter((file) => hasHandRolledActiveTrialingPair(readSrc(file)));

        expect(
            offenders,
            `These files rebuild the entitlement-granting set by hand:\n` +
                `${offenders.map((f) => `  - ${f}`).join('\n')}\n\n` +
                'Omitting `comp` that way is HOS-238, HOS-239 and HOS-594 — the same bug ' +
                'shipped three times, one of which left add-on sales dead in production ' +
                'for months. Route the check through isEntitlementGrantingStatus / ' +
                'ENTITLEMENT_GRANTING_STATUSES (@repo/billing).\n\n' +
                'If excluding `comp` is deliberate here — typically because the path ' +
                'mutates a MercadoPago preapproval, and a comp subscription has none — ' +
                'add the file to HAND_ROLLED_SCAN_EXCLUSIONS with the reason. Saying why ' +
                'is the point: it is what makes the next reader able to tell a decision ' +
                'from an oversight.'
        ).toEqual([]);
    });

    it('every scan exclusion still exists and still needs to be there', () => {
        /*
         * An exclusion list rots in two directions, and both end with a guard
         * that quietly checks less than it claims: a file gets renamed and its
         * entry silently stops matching anything, or a file gets migrated to the
         * predicate and its entry stays behind, blindfolding the scan against a
         * future regression in that same file.
         */
        const stale = HAND_ROLLED_SCAN_EXCLUSIONS.filter(
            (entry) => !hasHandRolledActiveTrialingPair(readSrc(entry.file))
        ).map((entry) => entry.file);

        expect(
            stale,
            `These files are listed in HAND_ROLLED_SCAN_EXCLUSIONS but no longer match ` +
                `the pattern:\n${stale.map((f) => `  - ${f}`).join('\n')}\n\n` +
                'Either they were migrated to the canonical predicate — in which case ' +
                'remove the entry so the scan covers them again — or they were renamed, ' +
                'in which case the entry has been guarding nothing.'
        ).toEqual([]);
    });

    it('no exclusion is undocumented', () => {
        const unexplained = HAND_ROLLED_SCAN_EXCLUSIONS.filter(
            (entry) => entry.why.trim().length < 40
        ).map((entry) => entry.file);

        expect(
            unexplained,
            'Every exclusion must carry a real reason, not a placeholder: ' +
                `${unexplained.join(', ')}`
        ).toEqual([]);
    });
});
