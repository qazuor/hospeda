import {
    FLOOR_PLAN_ROLE,
    NON_SELLABLE_PLAN_ROLES,
    PRE_TRIAL_PLAN_ROLE,
    ServiceErrorCode,
    TRIAL_PLAN_ROLE,
    VERTICAL_ACTIVATION_KEY
} from '@repo/schemas';
import { isMeteredEntitlement } from '@repo/verticals';
import { ServiceError } from '../../types';
import {
    CYCLE_MINIMUM_DAYS,
    FLOOR_REQUIRED_KEYS,
    PLAN_PUBLICATION_REJECTIONS
} from './plan-publication.rejections.js';
import type { PublicationContext } from './plan-publication.types.js';

/**
 * The G-R3 validation plus the sellable-role and trial-effects invariants of
 * action 18 (HOS-1436, piece V2, AC:V2:7). Each cause throws its OWN message;
 * the route maps `VALIDATION_ERROR` to HTTP 400.
 */

/** Whether a key's class marks it commercial. */
function isCommercialKey(input: { key: string; keyClasses: ReadonlyMap<string, string> }): boolean {
    return input.keyClasses.get(input.key) === 'COMMERCIAL';
}

/**
 * Validates a publication. Throws a `VALIDATION_ERROR` on the FIRST cause it
 * finds, in the order the AC lists them.
 *
 * Cause (a) covers only `pre_trial` and `floor` — the two non-sellable plans
 * that are not the trial plan (the trial plan's entitlements are derived, never
 * stored), per `G-R3` (04-catalogos.md:7774-7780, V2.md:507-520).
 */
export function validatePublication(input: { context: PublicationContext }): void {
    const { content, role, activationEvent, catalog, planId, keyClasses, previousCycles } =
        input.context;
    const entitlementKeys = content.entitlements.map((item) => item.key);
    const reject = (message: string): never => {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, message);
    };

    // A plan of a non-sellable role publishes only non-sellable versions.
    if (role !== null && content.sellable) {
        reject(PLAN_PUBLICATION_REJECTIONS.sellableNonSellableRole);
    }

    // A trial plan derives its entitlements and limits: it never stores them
    // (V2.md:412-416,457-462). Its own message, NOT G-R3(a).
    if (
        role === TRIAL_PLAN_ROLE &&
        (content.entitlements.length > 0 || content.limits.length > 0)
    ) {
        reject(PLAN_PUBLICATION_REJECTIONS.trialStoresEffects);
    }

    // (a) the two non-sellable plans that are not the trial plan grant no
    // commercial key and no metered entitlement. "Metered" is decided by
    // `@repo/verticals` (`isMeteredEntitlement`), the single definition of the
    // program, not by a rule of this module (HOS-1654).
    if (role !== null && NON_SELLABLE_PLAN_ROLES.includes(role)) {
        const commercialEntitlement = content.entitlements.some(
            (item) =>
                isCommercialKey({ key: item.key, keyClasses }) ||
                isMeteredEntitlement({ planQuota: item.planQuota, trialQuota: item.trialQuota })
        );
        const commercialLimit = content.limits.some((item) =>
            isCommercialKey({ key: item.key, keyClasses })
        );
        if (commercialEntitlement || commercialLimit) {
            reject(PLAN_PUBLICATION_REJECTIONS.extraKey);
        }
    }

    // (b) the floor version grants "subscribe_to_plan" and "recover_own_listing".
    if (role === FLOOR_PLAN_ROLE) {
        const missing = FLOOR_REQUIRED_KEYS.some((key) => !entitlementKeys.includes(key));
        if (missing) reject(PLAN_PUBLICATION_REJECTIONS.floorKeyMissing);
    }

    // (c) the activation capability holds "if and only if".
    if (role === PRE_TRIAL_PLAN_ROLE) {
        const grantsActivation = entitlementKeys.includes(VERTICAL_ACTIVATION_KEY);
        const trialPlan = catalog.find((plan) => plan.role === TRIAL_PLAN_ROLE);
        const trialDaysPositive = (trialPlan?.currentVersion?.trialDays ?? 0) > 0;
        const expected = activationEvent != null && trialDaysPositive;
        if (grantsActivation !== expected) {
            reject(PLAN_PUBLICATION_REJECTIONS.activationIff);
        }
    }

    // (d) no trial or non-sellable version inherits Turista VIP.
    if (role !== null && content.inheritsTouristVip) {
        reject(PLAN_PUBLICATION_REJECTIONS.vipInheritance);
    }

    // (e) a sellable, current version repeats no rank in the vertical.
    if (role === null && content.sellable) {
        const repeated = catalog.some(
            (plan) =>
                plan.id !== planId &&
                plan.currentVersion != null &&
                plan.currentVersion.sellable &&
                plan.currentVersion.rank === content.rank
        );
        if (repeated) reject(PLAN_PUBLICATION_REJECTIONS.duplicateRank);
    }

    // (f) every plan of the vertical keeps exactly one current version. The
    // target plan is about to receive the version being published.
    const planWithoutCurrent = catalog.some(
        (plan) => plan.id !== planId && plan.currentVersion == null
    );
    if (planWithoutCurrent) reject(PLAN_PUBLICATION_REJECTIONS.planWithoutCurrent);

    // (g) a trial plan never crosses zero trial days in either direction.
    if (role === TRIAL_PLAN_ROLE && input.context.previous != null) {
        const wasPositive = input.context.previous.trialDays > 0;
        const isPositive = content.trialDays > 0;
        if (wasPositive !== isPositive) reject(PLAN_PUBLICATION_REJECTIONS.trialDaysFlip);
    }

    // (h) the grace is strictly shorter than the shortest cycle the version offers.
    // The cycles come from the request, else from the current version's billing
    // options; with neither, (h) does not apply.
    const cycles = content.cycles ?? previousCycles;
    if (cycles != null && cycles.length > 0) {
        const shortest = Math.min(...cycles.map((cycle) => CYCLE_MINIMUM_DAYS[cycle]));
        if (content.graceDays >= shortest) {
            reject(PLAN_PUBLICATION_REJECTIONS.graceNotShorter);
        }
    }
}
