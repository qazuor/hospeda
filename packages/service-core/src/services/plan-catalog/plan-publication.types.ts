import type { planVersions } from '@repo/db';
import type { BillingCycle, PlanRole, PlanVersionContentInput } from '@repo/schemas';

/**
 * The types the action 18 service shares across its modules (HOS-1436, piece
 * V2, AC:V2:6/7): the read context the validation and the confirmation use, and
 * the injected port that counts the customers a version reaches.
 */

/** A plan version row. */
export type PlanVersionRow = typeof planVersions.$inferSelect;

/** One entitlement effect, as read back from a version. */
export interface EntitlementEffect {
    readonly key: string;
    readonly planQuota: number | null;
    readonly trialQuota: number | null;
}

/** One limit effect, as read back from a version. */
export interface LimitEffect {
    readonly key: string;
    readonly value: number;
}

/** The effects (`entitlements` and `limits`) a version grants. */
export interface VersionEffects {
    readonly entitlements: readonly EntitlementEffect[];
    readonly limits: readonly LimitEffect[];
}

/** The vertical catalog the validation reads, with each plan's current version. */
export interface CatalogPlan {
    readonly id: string;
    readonly role: PlanRole | null;
    readonly currentVersion: PlanVersionRow | null;
}

/** Everything the G-R3 validation and the confirmation need. */
export interface PublicationContext {
    readonly planId: string;
    readonly vertical: string;
    readonly activationEvent: string | null;
    readonly role: PlanRole | null;
    readonly previous: PlanVersionRow | null;
    readonly catalog: readonly CatalogPlan[];
    readonly content: PlanVersionContentInput;
    readonly keyClasses: ReadonlyMap<string, string>;
    /** The current version's cycles, read when the request declares none. */
    readonly previousCycles?: readonly BillingCycle[];
}

/**
 * Injected port that counts the customers a version reaches. The real one
 * returns `0` because the subscription anchor to `plan_version` does not exist
 * yet (it lands with `B3`); this is a B3 follow-up.
 */
export type CountAnchoredCustomersPort = (input: {
    readonly planVersionId: string | null;
}) => Promise<number>;

/** The default port: no anchoring exists yet, so publishing reaches nobody. */
export const zeroAnchoredCustomers: CountAnchoredCustomersPort = async () => 0;
