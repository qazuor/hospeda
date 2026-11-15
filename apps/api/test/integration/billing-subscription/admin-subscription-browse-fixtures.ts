/**
 * Seeding for the HOS-2081 admin subscription browse route tests.
 *
 * The plan, its non-sellable version, the billing option and the principal subscription are
 * inserted directly (never through `publishPlanVersion`; PM-474/PM-476). Timestamps are fixed
 * so the HTTP serialization is deterministic. The user, subscription and billing option are
 * registered and deleted by id, children first; the plan and its version stay because
 * `plan_version` is immutable by trigger (`reject_plan_version_effect_change`) and both are
 * neither current nor sellable.
 */
import {
    billingOptions,
    courtesyGrants,
    getDb,
    inArray,
    plans,
    planVersions,
    subscriptionPauses,
    subscriptions,
    users
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';

/** Stored plan name; no translation exists for the random slug, so it is returned as-is. */
export const BROWSE_PLAN_NAME = 'Browse plan';
/** Monthly amount of the seeded billing option, in minor units. */
export const BROWSE_AMOUNT_MINOR = 10000;
/** Currency of the seeded billing option. */
export const BROWSE_CURRENCY = 'ARS';
/** Creation instant of the seeded subscription. */
export const BROWSE_CREATED_AT = new Date('2026-09-01T10:00:00.000Z');
/** Next-charge instant of the seeded subscription. */
export const BROWSE_NEXT_CHARGE_AT = new Date('2026-11-01T09:30:00.000Z');
/** Service-end instant of the seeded subscription. */
export const BROWSE_SERVICE_ENDS_AT = new Date('2026-12-01T09:30:00.000Z');
/** Creation instant of the seeded plan version. */
export const BROWSE_PLAN_VERSION_CREATED_AT = new Date('2026-01-15T08:00:00.000Z');

const created = {
    users: [] as string[],
    subscriptions: [] as string[],
    billingOptions: [] as string[]
};

/** A seeded owner and their principal subscription with every related id. */
export interface SeededBrowseSubscription {
    readonly userId: string;
    readonly email: string;
    readonly displayName: string;
    readonly subscriptionId: string;
    readonly planId: string;
    readonly planVersionId: string;
    readonly billingOptionId: string;
}

/**
 * Seed one owner (unique email) and an ACTIVE PRINCIPAL subscription with a non-sellable
 * plan version and a monthly option. No provider link and no payment are needed to read it.
 */
export async function seedBrowseSubscription(label: string): Promise<SeededBrowseSubscription> {
    const db = getDb();
    const email = `browse-${label}-${crypto.randomUUID()}@example.test`;
    const displayName = `Browse ${label}`;

    const [user] = await db
        .insert(users)
        .values({ email, displayName, emailVerified: true, lifecycleState: 'ACTIVE' })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    created.users.push(user.id);

    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `browse-${crypto.randomUUID()}`,
            name: BROWSE_PLAN_NAME
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');

    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100_000_000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false,
            createdAt: BROWSE_PLAN_VERSION_CREATED_AT
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');

    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: BROWSE_AMOUNT_MINOR,
            currency: BROWSE_CURRENCY
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    created.billingOptions.push(option.id);

    const [row] = await db
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL',
            nextChargeAt: BROWSE_NEXT_CHARGE_AT,
            serviceEndsAt: BROWSE_SERVICE_ENDS_AT,
            createdAt: BROWSE_CREATED_AT
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected subscription');
    created.subscriptions.push(row.id);

    return {
        userId: user.id,
        email,
        displayName,
        subscriptionId: row.id,
        planId: plan.id,
        planVersionId: version.id,
        billingOptionId: option.id
    };
}

/**
 * Delete the seeded rows that can be deleted, children first: pauses and
 * courtesies, subscriptions, billing options, then users. The plan and its
 * version stay because `plan_version` is immutable by trigger
 * (`reject_plan_version_effect_change`), exactly as in `real-coverage-wiring`.
 */
export async function retireBrowseRows(): Promise<void> {
    const db = getDb();
    const subscriptionIds = created.subscriptions.splice(0);
    const billingOptionIds = created.billingOptions.splice(0);
    const userIds = created.users.splice(0);
    if (subscriptionIds.length > 0) {
        await db
            .delete(courtesyGrants)
            .where(inArray(courtesyGrants.subscriptionId, subscriptionIds));
        await db
            .delete(subscriptionPauses)
            .where(inArray(subscriptionPauses.subscriptionId, subscriptionIds));
        await db.delete(subscriptions).where(inArray(subscriptions.id, subscriptionIds));
    }
    if (billingOptionIds.length > 0) {
        await db.delete(billingOptions).where(inArray(billingOptions.id, billingOptionIds));
    }
    if (userIds.length > 0) {
        await db.delete(users).where(inArray(users.id, userIds));
    }
}
