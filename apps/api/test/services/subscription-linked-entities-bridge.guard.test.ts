/**
 * @file subscription-linked-entities-bridge.guard.test.ts
 * @description Static guard, HOS-1280: pins the known call sites of
 * `reconcileSubscriptionLinkedEntities` (and, for the two files this fix
 * touched, `reconcilePartnerForSubscription`) so this exact bug class cannot
 * regress silently.
 *
 * ## The defect class
 *
 * Three state-changing sites never called the bridge that publishes /
 * unpublishes a commerce listing: the admin hard-cancel hook, both pause/
 * resume surfaces (admin + self-serve), and the comp-grant supersede loop
 * (which called it once for the NEW row, never for each row it superseded).
 * The accommodation half was self-healing — the 6-hourly
 * `entity-subscription-cache-reconcile` cron re-derives every accommodation
 * row — but commerce visibility had no such backstop, so a cancelled/paused
 * gastronomy or experience listing stayed PUBLIC with the underlying charge
 * dead, FOREVER (HOS-1280).
 *
 * HOS-1292 closed the "forever": that same cron now also compares every
 * non-accommodation row's cached status against live billing and, on a
 * disagreement, drives `reconcileCommerceListingForSubscription` — which is
 * exactly the shape a missed bridge call leaves behind. This guard is NOT
 * thereby redundant. The backstop bounds the damage at one cron interval; it
 * does not remove it, and the window it leaves open is up to six hours of a
 * dead charge holding a listing public. A missing bridge call is still a bug
 * to catch at review time, not a state to wait out.
 *
 * ## Why a hand-maintained comment could not be trusted (and why this isn't one)
 *
 * `subscription-linked-entities.service.ts`'s own docblock used to enumerate
 * "six call sites" by name. By the time HOS-1280 measured it, there were 9 in
 * 8 files — a seventh had been added, then an eighth and ninth, and nobody
 * came back to update the comment. A prose list is not evidence; this file
 * is a scan, so it fails the moment it stops matching reality instead of
 * quietly drifting.
 *
 * ## Scope — what this guard DOES prove
 *
 *   - Every file pinned in `BRIDGE_CALL_SITES` still contains at least the
 *     recorded number of `reconcileSubscriptionLinkedEntities(...)` calls —
 *     regression protection for the exact three sites HOS-1280 fixed, plus
 *     the six sites that already called it correctly.
 *   - The two files HOS-1280 also wired to `reconcilePartnerForSubscription`
 *     (`qzpay-admin-hooks.ts`, `subscription-pause.ts` — both demonstrably
 *     reachable by a partner subscription; see the HOS-1280 PR description
 *     for the reachability measurement) keep calling it too.
 *   - The TOTAL count of `reconcileSubscriptionLinkedEntities(...)` call
 *     expressions under `apps/api/src` matches the sum of the pinned counts
 *     — so a brand-new tenth file that starts calling the bridge, or a
 *     literal count that moves in an already-pinned file, forces this table
 *     to be updated instead of silently drifting the way the old docblock
 *     did. This is the guard's answer to "did every site get wired?": ask
 *     `rg 'reconcileSubscriptionLinkedEntities\(' apps/api/src` and diff
 *     against this table, never trust a hand-written list on its own.
 *
 * ## Scope — what this guard does NOT prove (stated so green is not read as more)
 *
 *   - It is NOT the "every `billing_subscriptions.status` writer is
 *     reviewed" audit that `inv1-cache-invalidation.guard.test.ts` runs for
 *     `clearEntitlementCache` (its `discoverBillingSubscriptionsWriters()` /
 *     `BILLING_SUBSCRIPTIONS_WRITERS` pair). Building that SAME auto-
 *     discovery + reviewed-registry pattern for the reconcile-bridge
 *     invariant is the natural next step, but doing it properly means
 *     triaging on the order of 40 direct `.update(billingSubscriptions)`
 *     sites across `apps/api/src`, `packages/service-core` and
 *     `packages/seed/src/data-migrations` — each one requires judgment on
 *     whether the write changes `status`, whether the row can ever be
 *     commerce/partner-domain, and whether an existing webhook/cron already
 *     covers it. That is a bounded but real audit and doing it hastily here
 *     risks exactly the "guard born with unreviewed exceptions" failure mode
 *     HOS-1277 explicitly declined for its own guard. Left as an explicit,
 *     named follow-up rather than a rushed, possibly-wrong allowlist.
 *   - It is source-level (`.matchAll` over file text), not a runtime
 *     assertion: it proves the call is PRESENT, not that it sits on the
 *     reachable branch or is never dead code. The HOS-1280 regression tests
 *     added alongside the three fixed sites — in
 *     `test/routes/billing/admin/hooks/qzpay-admin-hooks.test.ts`,
 *     `test/routes/subscription-pause.test.ts`, and
 *     `test/services/subscription-comp-grant.service.test.ts` — are what
 *     prove the runtime effect (the call fires with the right arguments, in
 *     the right order relative to the underlying write).
 *
 * ## HOS-1306: the second reconciler, and the pairing invariant
 *
 * HOS-1280 left this open, in its own words: "It says nothing about
 * `reconcilePartnerForSubscription`'s OTHER four call sites (or lack thereof)
 * outside the two files HOS-1280 touched — that full audit is HOS-1306's."
 *
 * That audit is now here. There are TWO reconcilers, not one: partners live in
 * `partner_subscriptions` and are driven by `reconcilePartnerForSubscription`,
 * which the entity bridge never calls. So `PARTNER_CALL_SITES` is now a
 * COMPLETE table with its own total tripwire, and — the part that actually
 * closes the class — `BRIDGE_ONLY_SITES` records the bridge call sites that
 * deliberately skip the partner reconciler, each with the measured reason a
 * partner cannot reach it. The pairing test then requires every bridge call
 * site to be in one table or the other.
 *
 * That shape, rather than "call both everywhere", is deliberate. A partner
 * reconcile on a path a partner never walks is an invocation nobody exercises
 * and nobody later dares delete — the measurement is what decides, per site.
 * And the scope stays NARROW on purpose: this guard constrains these two
 * reconcilers and nothing else. The general "every `billing_subscriptions`
 * status writer is reviewed" parity guard is HOS-1295's, deliberately last in
 * its epic because a broad version fails in ~145 places today and would be
 * switched off rather than satisfied.
 *
 * @module test/services/subscription-linked-entities-bridge.guard
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = resolve(__dirname, '../../src');

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

/** Recursively collect source files under a directory, as repo-relative paths. */
function collectSourceFiles(dir: string, base: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) {
            found.push(...collectSourceFiles(full, base));
        } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
            found.push(full.slice(base.length + 1));
        }
    }
    return found;
}

/** Matches an actual invocation, not an import or a comment mention. */
const BRIDGE_CALL = /reconcileSubscriptionLinkedEntities\s*\(/g;
const PARTNER_CALL = /reconcilePartnerForSubscription\s*\(/g;

function countCalls(source: string, pattern: RegExp): number {
    return [...source.matchAll(pattern)].length;
}

/**
 * Every file that calls `reconcileSubscriptionLinkedEntities`, as measured on
 * HOS-1280 (2026-09-09), and the minimum number of call expressions each must
 * keep containing. `hos1280Fix: true` marks the three sites this issue
 * actually added the call to; the rest already called it before this fix.
 */
const BRIDGE_CALL_SITES: ReadonlyArray<{
    readonly file: string;
    readonly minCalls: number;
    readonly hos1280Fix: boolean;
    readonly note: string;
}> = [
    {
        file: 'cron/jobs/abandoned-pending-subs.job.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'cron/jobs/preapproval-less-expiry.job.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'cron/jobs/dunning.job.ts',
        minCalls: 2,
        hos1280Fix: false,
        note: 'Pre-existing: enters-dunning branch + recovers branch.'
    },
    {
        file: 'cron/jobs/finalize-cancelled-subs.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing — the contrast case HOS-1280 measured the other three against.'
    },
    {
        file: 'services/commerce-subscription-attach.service.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'services/accommodation-publish-deps.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'HOS-1336: the publish-trial write-through. The local trial is the only subscription-GAIN path with no provider object, so no webhook can ever re-point the entity_subscriptions rows on its behalf — the post-commit onTrialStarted hook is the one site that can.'
    },
    {
        file: 'services/billing/trial-local-expiry.service.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing (predates HOS-1280).'
    },
    {
        file: 'routes/webhooks/mercadopago/subscription-logic.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'Pre-existing: the MercadoPago webhook.'
    },
    {
        file: 'services/subscription-comp-grant.service.ts',
        minCalls: 2,
        hos1280Fix: true,
        note: 'HOS-1280: the pre-existing call for the new comp row, PLUS a new call inside the supersede loop for each row it retires — the loop used to call the bridge zero times per superseded row.'
    },
    {
        file: 'routes/billing/subscription-pause.ts',
        minCalls: 2,
        hos1280Fix: true,
        note: 'HOS-1280: self-serve pause + self-serve resume, both previously uncalled.'
    },
    {
        file: 'routes/billing/admin/qzpay-admin-hooks.ts',
        minCalls: 3,
        hos1280Fix: true,
        note: 'HOS-1280: admin hard-cancel, admin pause, admin resume — all three previously uncalled.'
    },
    {
        file: 'services/commerce-trial-start.service.ts',
        minCalls: 1,
        hos1280Fix: false,
        note: 'HOS-1338: commerce trial grant — reconciles after the tx commits, because the entity_subscriptions upsert moved inside createTrialSubscription.'
    }
] as const;

/**
 * Every file that calls `reconcilePartnerForSubscription`, and the minimum
 * number of call expressions it must keep.
 *
 * HOS-1280 pinned only the two files it had itself wired. HOS-1306 completed
 * the table, because a partial one cannot support the pairing invariant below:
 * "is this file wired for partners?" needs a total, not a sample.
 */
const PARTNER_CALL_SITES: ReadonlyArray<{
    readonly file: string;
    readonly minCalls: number;
    readonly note: string;
}> = [
    {
        file: 'cron/jobs/abandoned-pending-subs.job.ts',
        minCalls: 1,
        note: 'Pre-existing: the Path C reaper, whose whole population is preapproval-less partner/commerce checkouts.'
    },
    {
        file: 'cron/jobs/dunning.job.ts',
        minCalls: 2,
        note: 'Pre-existing: enters-dunning branch + recovers branch.'
    },
    {
        file: 'cron/jobs/finalize-cancelled-subs.ts',
        minCalls: 1,
        note: 'Pre-existing.'
    },
    {
        file: 'routes/webhooks/mercadopago/subscription-logic.ts',
        minCalls: 1,
        note: 'Pre-existing: the MercadoPago webhook, the primary partner churn path.'
    },
    {
        file: 'routes/billing/subscription-pause.ts',
        minCalls: 2,
        note: 'HOS-1280: self-serve pause + resume, gated only on holding a billingCustomerId, not on a role.'
    },
    {
        file: 'routes/billing/admin/qzpay-admin-hooks.ts',
        minCalls: 3,
        note: 'HOS-1280: admin hard-cancel, pause, resume — generic admin routes with no product-domain filter.'
    },
    {
        file: 'services/subscription-comp-grant.service.ts',
        minCalls: 2,
        note: 'HOS-1160: the supersede loop and the granted comp row, both gated on the resolved productDomain being PARTNER. A comp fires no webhook and no cron, so this is the only path to partners.subscriptionStatus for it.'
    }
] as const;

/**
 * The counterpart table, and the reason this guard is more than two independent
 * tallies: files that call the entity bridge and deliberately do NOT call
 * `reconcilePartnerForSubscription`, each with the MEASURED reason a partner
 * subscription cannot reach that site (HOS-1306).
 *
 * A path a partner never walks must not get the call "just in case": that is a
 * second invocation nobody exercises and nobody later dares delete. But the
 * decision has to be recorded somewhere a scan can enforce, or the next call
 * site is born with the same silent gap that produced HOS-1306 in the first
 * place. So the invariant below is a PAIRING one — every bridge call site is
 * either wired for partners or listed here with a reason — rather than a bare
 * count.
 *
 * This is deliberately NARROW: it constrains these two reconcilers and nothing
 * else. The general "every status writer is reviewed" parity guard is HOS-1295,
 * which runs last in its epic precisely because a broad version of it fails in
 * ~145 places today and would be switched off within weeks.
 */
const BRIDGE_ONLY_SITES: ReadonlyArray<{ readonly file: string; readonly reason: string }> = [
    {
        file: 'cron/jobs/preapproval-less-expiry.job.ts',
        reason:
            "A partner subscription can never hold this job's target shape: " +
            "status IN ('active','trialing') AND mp_subscription_id IS NULL. Measured by " +
            'enumerating every `update(billingSubscriptions)` site in apps/api/src and ' +
            "packages/service-core/src (~39) and reading each one's `.set({...})`. Only six " +
            "write status='active', and each is closed to this shape: the MP preapproval " +
            'webhook (subscription-logic.ts) finds its row BY mp_subscription_id, so the id is ' +
            'the lookup key and cannot be null; confirmAnnualSubscription (payment-logic.ts) is ' +
            'reachable only from initiatePaidAnnualSubscription, which calls ' +
            'assertAccommodationOrTouristPlanDomain and throws PLAN_DOMAIN_MISMATCH for partner; ' +
            'the trial-conversion handler and trial.service both require status=trialing, which ' +
            'partner can never reach (see the trial-local-expiry entry); courtesy-expiry only ' +
            "acts on status='courtesy', which courtesy-grant refuses to create without a " +
            'non-null mp_subscription_id; addon-recurring-activation filters productDomain=ADDON. ' +
            'Every resume() path requires a prior paused row, which requires a prior active one. ' +
            'And nothing anywhere nulls mp_subscription_id on a live row — the single writer ' +
            'that nulls it (subscription-comp-grant.service.ts) writes status=cancelled in the ' +
            'same statement.\n' +
            'CAVEAT, and the reason this entry is longer than the other two: unlike them, this ' +
            'exclusion rests on the ABSENCE of a producing write rather than on a structural ' +
            'invariant — no type and no CI guard enforces it. HOS-1062 ("activar sin ' +
            'MercadoPago ... y que los crons contemplen esas filas") is explicitly building the ' +
            'population that makes it false. Whoever lands HOS-1062 must wire ' +
            'reconcilePartnerForSubscription here in the same change and move this file to ' +
            'PARTNER_CALL_SITES.'
    },
    {
        file: 'services/billing/trial-local-expiry.service.ts',
        reason:
            'A partner subscription can never be `trialing`. All three partner plans carry ' +
            'trialDays: 0 (packages/billing/src/config/plans.config.ts); the partner checkout ' +
            'passes an explicit trialDays: 0 on both branches (subscription-checkout.service.ts) ' +
            'and CI guard check-no-trial-to-mercadopago.sh forbids re-adding one; ' +
            'createTrialSubscription — the only writer of status=trialing outside the MP webhook ' +
            '— has exactly two call sites (accommodation-publish-deps.ts, ' +
            'commerce-trial-start.service.ts), rejects a non-positive trialDays, and throws when ' +
            "the plan's product_domain disagrees with the requested one; deriveTrialingStatus " +
            'returns trialing only for a non-null future trial_end, and the partner row is ' +
            'created with trial_end: null. The promo trial_extension effect cannot bootstrap one ' +
            'either: it refuses a subscription that is not already trialing.'
    },
    {
        file: 'services/commerce-subscription-attach.service.ts',
        reason:
            'Type-level. attachListingToSubscription only ever receives a subscription resolved ' +
            'by findOwnerVerticalSubscription, whose domain comes from ' +
            "commerceVerticalToProductDomain(vertical) with CommerceVertical = 'gastronomy' | " +
            "'experience', and whose .find() requires subscriptionMatchesDomain(sub, domain) — " +
            'which fails CLOSED for every non-accommodation domain. A partner subscription ' +
            'satisfies neither vertical, so it cannot be the subscription a listing is attached to.'
    },
    {
        file: 'services/accommodation-publish-deps.ts',
        reason:
            "A partner subscription can never be created by this site. The trial's product " +
            'domain is pinned to ProductDomainEnum.ACCOMMODATION (PUBLISH_PRODUCT_DOMAIN), ' +
            "and createTrialSubscription throws when the plan's product_domain disagrees with " +
            'the requested one, so the row this hook reconciles is accommodation-domain by ' +
            'construction. The partner plans also carry trialDays: 0 with trial_end: null, so ' +
            'no partner row can ever be trialing — the same measurement the ' +
            'trial-local-expiry entry below records, and this file is one of the two ' +
            'createTrialSubscription call sites it names.'
    },
    {
        file: 'services/commerce-trial-start.service.ts',
        reason:
            'Type-level + domain predicate. startCommerceListingTrial is only ever called with ' +
            "a CommerceVertical ('gastronomy' | 'experience'), which maps via " +
            'commerceVerticalToProductDomain to productDomain ∈ {gastronomy, experience}. ' +
            "createTrialSubscription rejects when the plan's product_domain disagrees with the " +
            "requested one. Partner plans carry product_domain='partner' and trialDays: 0, so " +
            'a partner subscription can never satisfy the domain check nor reach status=trialing.'
    }
] as const;

describe('HOS-1280 guard: reconcileSubscriptionLinkedEntities call sites are pinned', () => {
    it.each(
        BRIDGE_CALL_SITES.map((s) => [s.file, s.minCalls, s.note] as const)
    )('%s calls the bridge at least %i time(s) (%s)', (file, minCalls) => {
        const source = readSrc(file);
        const actual = countCalls(source, BRIDGE_CALL);
        expect(
            actual,
            `${file} calls reconcileSubscriptionLinkedEntities ${actual} time(s), expected ` +
                `at least ${minCalls}. If this dropped, a state-changing write in this file lost ` +
                'its bridge call — the exact HOS-1280 bug class (a cancelled/paused commerce ' +
                'subscription leaves its listing PUBLIC forever, with no backstop cron).'
        ).toBeGreaterThanOrEqual(minCalls);
    });

    it.each(
        PARTNER_CALL_SITES.map((s) => [s.file, s.minCalls] as const)
    )('%s calls reconcilePartnerForSubscription at least %i time(s)', (file, minCalls) => {
        const source = readSrc(file);
        const actual = countCalls(source, PARTNER_CALL);
        expect(
            actual,
            `${file} calls reconcilePartnerForSubscription ${actual} time(s), expected at ` +
                `least ${minCalls}. This file was measured as reachable by a partner ` +
                'subscription and wired accordingly — do not remove the call without ' +
                're-measuring reachability, and do not lower this number to make a red go away.'
        ).toBeGreaterThanOrEqual(minCalls);
    });

    it('the pinned files still exist and are readable', () => {
        for (const site of BRIDGE_CALL_SITES) {
            expect(() => readSrc(site.file), `Missing or unreadable: ${site.file}`).not.toThrow();
        }
    });

    it('every pinned entry carries a real note', () => {
        for (const site of BRIDGE_CALL_SITES) {
            expect(
                site.note.trim().length,
                `BRIDGE_CALL_SITES entry for ${site.file} has no note`
            ).toBeGreaterThan(10);
        }
    });

    it("at least three pinned entries are marked as this issue's own fix", () => {
        // Sanity check on the table itself, not the source tree: HOS-1280 fixed
        // exactly three sites. If this count changes, the table was edited
        // without updating this assertion (or vice versa) — worth a second look.
        const fixed = BRIDGE_CALL_SITES.filter((s) => s.hos1280Fix);
        expect(fixed.map((s) => s.file).sort()).toEqual(
            [
                'routes/billing/admin/qzpay-admin-hooks.ts',
                'routes/billing/subscription-pause.ts',
                'services/subscription-comp-grant.service.ts'
            ].sort()
        );
    });

    // ── HOS-1306: the pairing invariant ──────────────────────────────────────
    //
    // The three tests below are what turn two independent tallies into one
    // question with one answer. Before them, `reconcilePartnerForSubscription`
    // could be missing from a bridge call site and nothing anywhere would say
    // so — which is exactly how it came to be wired at 5 of 9 sites while the
    // root CLAUDE.md asserted there was only one reconciler at all.

    it('HOS-1306: every bridge call site is either wired for partners or on the reasoned exclusion list', () => {
        const partnerFiles = new Set(PARTNER_CALL_SITES.map((s) => s.file));
        const excludedFiles = new Set(BRIDGE_ONLY_SITES.map((s) => s.file));

        // Scanned from the source tree, NOT read off BRIDGE_CALL_SITES. Reading
        // the pinned table would make this test blind to exactly the case it
        // exists for: a BRAND-NEW file that starts calling the bridge is, by
        // definition, absent from that table, so a table-driven pairing check
        // passes it silently and leaves only the count tripwire — which says
        // "add a table entry", not "you forgot the partner reconciler".
        // Measured, not assumed: the table-driven version of this test stayed
        // GREEN when an unpaired bridge call was mutated into a new file.
        const DEFINITION_FILE = 'services/subscription-linked-entities.service.ts';
        const bridgeFiles = collectSourceFiles(SRC_ROOT, SRC_ROOT).filter(
            (f) =>
                f !== DEFINITION_FILE &&
                countCalls(readFileSync(resolve(SRC_ROOT, f), 'utf-8'), BRIDGE_CALL) > 0
        );

        const unclassified = bridgeFiles.filter(
            (file) => !partnerFiles.has(file) && !excludedFiles.has(file)
        );

        expect(
            unclassified,
            `File(s) call reconcileSubscriptionLinkedEntities but neither call ` +
                `reconcilePartnerForSubscription nor appear in BRIDGE_ONLY_SITES: ` +
                `${unclassified.join(', ')}.\n\n` +
                'A site that moves a subscription status must settle BOTH reconcilers, because ' +
                'partners live in `partner_subscriptions` and the entity bridge never touches ' +
                'them (HOS-1306). Decide which this is:\n' +
                '  - a partner CAN reach it -> add the reconcilePartnerForSubscription call and ' +
                'an entry in PARTNER_CALL_SITES;\n' +
                '  - a partner CANNOT reach it -> add an entry to BRIDGE_ONLY_SITES with the ' +
                'MEASURED reason (a domain predicate, a type constraint, a status that is ' +
                'unreachable for the partner plans — not a guess, and not a docblock).\n' +
                'Wiring a call a partner never exercises is its own defect: it is dead code ' +
                'nobody later dares remove.'
        ).toEqual([]);
    });

    it('HOS-1306: a file cannot be both wired for partners and excluded', () => {
        const partnerFiles = new Set(PARTNER_CALL_SITES.map((s) => s.file));
        const both = BRIDGE_ONLY_SITES.map((s) => s.file).filter((f) => partnerFiles.has(f));
        expect(
            both,
            `File(s) appear in BOTH PARTNER_CALL_SITES and BRIDGE_ONLY_SITES: ${both.join(', ')}. ` +
                'The two tables are a partition — one of the entries is stale.'
        ).toEqual([]);
    });

    it('HOS-1306: every exclusion carries a real, specific reason', () => {
        for (const site of BRIDGE_ONLY_SITES) {
            expect(
                site.reason.trim().length,
                `BRIDGE_ONLY_SITES entry for ${site.file} has no substantive reason. An ` +
                    'exclusion without evidence is the failure mode this guard exists to stop.'
            ).toBeGreaterThan(80);
        }
    });

    it('HOS-1306: total reconcilePartnerForSubscription call-expression count matches the pinned sum', () => {
        // Same tripwire the bridge half has, and for the same reason: a new file
        // that starts calling the partner reconciler, or a count that moves in an
        // already-pinned file, must force this table to be updated rather than
        // drift silently.
        const DEFINITION_FILE = 'services/partner-reconcile.service.ts';
        const allFiles = collectSourceFiles(SRC_ROOT, SRC_ROOT).filter(
            (f) => f !== DEFINITION_FILE
        );
        let total = 0;
        const perFile = new Map<string, number>();
        for (const file of allFiles) {
            const n = countCalls(readFileSync(resolve(SRC_ROOT, file), 'utf-8'), PARTNER_CALL);
            if (n > 0) {
                perFile.set(file, n);
                total += n;
            }
        }

        const pinnedFiles = new Set(PARTNER_CALL_SITES.map((s) => s.file));
        const unpinned = [...perFile.keys()].filter((f) => !pinnedFiles.has(f));
        expect(
            unpinned,
            `Found file(s) calling reconcilePartnerForSubscription that are NOT in ` +
                `PARTNER_CALL_SITES: ${unpinned.join(', ')}. Add an entry.`
        ).toEqual([]);

        const pinnedSum = PARTNER_CALL_SITES.reduce((sum, s) => sum + s.minCalls, 0);
        expect(
            total,
            `Total reconcilePartnerForSubscription(...) call expressions under apps/api/src is ` +
                `${total}, but PARTNER_CALL_SITES' minCalls sum to ${pinnedSum}. If a pinned ` +
                "file's call count changed, update its minCalls."
        ).toBe(pinnedSum);
    });

    it('total bridge call-expression count under apps/api/src matches the pinned sum (tripwire for new/removed sites)', () => {
        // Excludes the reconciler's OWN definition file: `export async function
        // reconcileSubscriptionLinkedEntities(` matches the same
        // `identifier(` shape as an invocation, but it is the declaration, not
        // a call site.
        const DEFINITION_FILE = 'services/subscription-linked-entities.service.ts';
        const allFiles = collectSourceFiles(SRC_ROOT, SRC_ROOT).filter(
            (f) => f !== DEFINITION_FILE
        );
        let total = 0;
        const perFile = new Map<string, number>();
        for (const file of allFiles) {
            const n = countCalls(readFileSync(resolve(SRC_ROOT, file), 'utf-8'), BRIDGE_CALL);
            if (n > 0) {
                perFile.set(file, n);
                total += n;
            }
        }

        const pinnedSum = BRIDGE_CALL_SITES.reduce((sum, s) => sum + s.minCalls, 0);
        const pinnedFiles = new Set(BRIDGE_CALL_SITES.map((s) => s.file));
        const unpinned = [...perFile.keys()].filter((f) => !pinnedFiles.has(f));

        expect(
            unpinned,
            `Found file(s) calling reconcileSubscriptionLinkedEntities that are NOT in ` +
                `BRIDGE_CALL_SITES: ${unpinned.join(', ')}. Add an entry (this is exactly the drift ` +
                'that let the old docblock lie about "six call sites" while there were nine.)'
        ).toEqual([]);

        expect(
            total,
            `Total reconcileSubscriptionLinkedEntities(...) call expressions under apps/api/src is ` +
                `${total}, but BRIDGE_CALL_SITES' minCalls sum to ${pinnedSum}. If a pinned file's ` +
                'call count changed, update its minCalls; do not silently let this table undercount ' +
                'reality.'
        ).toBe(pinnedSum);
    });
});
