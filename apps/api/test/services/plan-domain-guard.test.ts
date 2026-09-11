/**
 * Unit tests for the cross-domain refusal in the two accommodation remediation
 * services (HOS-1122).
 *
 * ## Why this is its own file rather than a case in each service's suite
 *
 * The bug being pinned is not "the wrong number came out". It is that the
 * WRONG NUMBER LOOKED RIGHT:
 *
 * - `applyUpgradeRestorations` handed a commerce plan id resolved a slug that
 *   `ALL_PLANS` does not contain, whose caps then came back `{-1, -1, -1}` —
 *   the sentinel for *unlimited* — and restored every plan-restricted
 *   accommodation and promotion the owner had. A successful run, a summary full
 *   of ids, no error and nothing in the logs to look for.
 * - `applyDowngradeRestrictions` threw `PlanCatalogMissError`, which its only
 *   production caller treats as "target plan not in catalog (non-blocking)" —
 *   a data gap, not a call from another domain.
 *
 * Both suites next door drive their service through injected `deps`, so they
 * would have exercised the guard only through whatever their mock returned.
 * Here the guard is reached with the deps stubbed to be LOUD if they run at
 * all: any call to them means the refusal did not happen.
 *
 * @module test/services/plan-domain-guard
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

import {
    ALL_GASTRONOMY_PLANS,
    ALL_PLANS,
    OWNER_BASICO_PLAN,
    PARTNER_GOLD_PLAN
} from '@repo/billing';
import { PlanDomainMismatchError } from '../../src/services/billing/plan-domain-guard';
import type { DowngradeRemediationDeps } from '../../src/services/plan-downgrade-remediation.service';
import { applyDowngradeRestrictions } from '../../src/services/plan-downgrade-remediation.service';
import type {
    PlanCaps,
    UpgradeRestorationDeps
} from '../../src/services/plan-upgrade-restoration.service';
import { applyUpgradeRestorations } from '../../src/services/plan-upgrade-restoration.service';

const USER_ID = 'user-1';
const CUSTOMER_ID = 'cust-1';
const GASTRONOMY_SLUG = ALL_GASTRONOMY_PLANS[0]?.slug ?? 'gastronomy-basico';

/**
 * Downgrade deps that fail the test if touched. The refusal has to happen
 * BEFORE any excess is computed — a guard that merely discards the result
 * afterwards would still have read a host's whole portfolio against a
 * restaurant's plan.
 */
function loudDowngradeDeps(): DowngradeRemediationDeps {
    return {
        computeExcess: vi.fn(async () => {
            throw new Error('computeExcess must not run for a non-accommodation plan');
        }),
        fetchAccommodationSlugs: vi.fn(async () => {
            throw new Error('fetchAccommodationSlugs must not run');
        })
    };
}

/** Restoration deps that fail the test if the cap read is reached. */
function loudRestorationDeps(planSlug: string): UpgradeRestorationDeps {
    return {
        getPlanSlug: vi.fn().mockResolvedValue(planSlug),
        getPlanCaps: vi.fn((): PlanCaps => {
            throw new Error('getPlanCaps must not run for a non-accommodation plan');
        }),
        getRestrictedAccommodations: vi.fn().mockResolvedValue([]),
        getActiveAccommodationCount: vi.fn().mockResolvedValue(0),
        getRestrictedPromotions: vi.fn().mockResolvedValue([]),
        getActivePromotionCount: vi.fn().mockResolvedValue(0),
        getAccommodationsWithArchivedPhotos: vi.fn().mockResolvedValue([]),
        fetchAccommodationSlugs: vi.fn().mockResolvedValue({})
    };
}

describe('applyDowngradeRestrictions — domain gate (HOS-1122)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('refuses a COMMERCE plan slug before computing any excess', async () => {
        const deps = loudDowngradeDeps();

        await expect(
            applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: GASTRONOMY_SLUG,
                deps
            })
        ).rejects.toBeInstanceOf(PlanDomainMismatchError);

        expect(deps.computeExcess).not.toHaveBeenCalled();
    });

    it('names the domain it actually resolved to, not just "wrong"', async () => {
        // The message is the whole diagnostic: a bare failure would read like
        // the `PlanCatalogMissError` this replaces, which ops already know to
        // dismiss as a catalogue gap.
        let error: unknown;
        try {
            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: GASTRONOMY_SLUG,
                deps: loudDowngradeDeps()
            });
        } catch (err) {
            error = err;
        }

        expect(error).toBeInstanceOf(PlanDomainMismatchError);
        const mismatch = error as PlanDomainMismatchError;
        expect(mismatch.resolvedDomain).toBe('gastronomy');
        expect(mismatch.expectedDomain).toBe('accommodation');
        expect(mismatch.message).toContain(GASTRONOMY_SLUG);
    });

    it('refuses a PARTNER plan and an unknown slug too — the gate is not commerce-specific', async () => {
        for (const slug of [PARTNER_GOLD_PLAN.slug, 'not-a-plan-at-all']) {
            await expect(
                applyDowngradeRestrictions({
                    userId: USER_ID,
                    customerId: CUSTOMER_ID,
                    targetPlanSlug: slug,
                    deps: loudDowngradeDeps()
                })
            ).rejects.toBeInstanceOf(PlanDomainMismatchError);
        }
    });

    it('lets an ACCOMMODATION plan through', async () => {
        // Without this the suite would pass with a guard that refuses
        // everything, which is a different bug with the same green.
        const deps = loudDowngradeDeps();
        deps.computeExcess = vi.fn().mockResolvedValue({
            accommodations: { cap: 1, activeCount: 1, excessCount: 0, items: [] },
            promotions: { cap: 1, activeCount: 0, excessCount: 0, items: [] },
            photos: [],
            grandfatherFlags: [],
            hasExcess: false
        });

        const summary = await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: OWNER_BASICO_PLAN.slug,
            deps
        });

        expect(deps.computeExcess).toHaveBeenCalledOnce();
        expect(summary.restricted.accommodations).toEqual([]);
    });
});

describe('applyUpgradeRestorations — domain gate (HOS-1122)', () => {
    beforeEach(() => vi.clearAllMocks());

    it('refuses a COMMERCE plan before reading caps that would answer "unlimited"', async () => {
        const deps = loudRestorationDeps(GASTRONOMY_SLUG);

        await expect(
            applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: 'plan-uuid-gastronomy',
                deps
            })
        ).rejects.toBeInstanceOf(PlanDomainMismatchError);

        expect(deps.getPlanCaps).not.toHaveBeenCalled();
        expect(deps.getRestrictedAccommodations).not.toHaveBeenCalled();
    });

    it('refuses when the plan id resolves to NO slug at all', async () => {
        // The path that used to be worst: `getPlanSlug` returning null fed
        // `getPlanCaps('')`, which fell through to `{-1, -1, -1}` and restored
        // everything.
        const deps = loudRestorationDeps('');
        deps.getPlanSlug = vi.fn().mockResolvedValue(null);

        await expect(
            applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: 'plan-uuid-missing',
                deps
            })
        ).rejects.toBeInstanceOf(PlanDomainMismatchError);
        expect(deps.getPlanCaps).not.toHaveBeenCalled();
    });

    it('lets an ACCOMMODATION plan through', async () => {
        const accommodationSlug = ALL_PLANS[0]?.slug ?? OWNER_BASICO_PLAN.slug;
        const deps = loudRestorationDeps(accommodationSlug);
        deps.getPlanCaps = vi.fn().mockReturnValue({
            accommodationsCap: 3,
            promotionsCap: 3,
            photosPerAccommodationCap: 10
        });

        const summary = await applyUpgradeRestorations({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            newPlanId: 'plan-uuid-owner',
            deps
        });

        expect(deps.getPlanCaps).toHaveBeenCalledWith(accommodationSlug);
        expect(summary.restored.accommodations).toEqual([]);
    });
});
