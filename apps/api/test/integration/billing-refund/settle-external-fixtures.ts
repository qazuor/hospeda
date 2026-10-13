/**
 * Seeding for the admin action 14 route tests (HOS-1540, TEST:B5:6). Every row
 * gets a random id and is registered here; `cleanupSettleExternalRows` deletes
 * exactly those rows, children first. Plans, plan versions, add-ons and add-on
 * versions stay: versions are immutable by trigger (`reject_plan_version_effect_change`,
 * `reject_catalog_version_change`), the plan version is neither current nor
 * sellable and the add-on loses its only product, so no catalog lookup and no
 * global population sees them. Never TRUNCATE.
 */
import {
    addonInstances,
    addonProducts,
    addons,
    addonVersions,
    billingOptions,
    coveredPeriods,
    eq,
    getDb,
    inArray,
    payments,
    plans,
    planVersions,
    refunds,
    subscriptions,
    users
} from '@repo/db';
import { type PermissionEnum, VerticalEnum } from '@repo/schemas';

const created = {
    users: [] as string[],
    billingOptions: [] as string[],
    subscriptions: [] as string[],
    payments: [] as string[],
    addonProducts: [] as string[],
    addonInstances: [] as string[]
};

/** The fixed instant the seeded payments happened at. */
export const SEEDED_AT = new Date('2026-10-01T03:00:00.000Z');

/** A fresh account, registered for cleanup. */
export async function seedUser(label: string): Promise<string> {
    const [user] = await getDb()
        .insert(users)
        .values({
            email: `b53-route-${label}-${crypto.randomUUID()}@example.test`,
            displayName: `B5.3 ${label}`,
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('Expected user');
    created.users.push(user.id);
    return user.id;
}

/** An ACTIVE accommodation subscription of `ownerId` over its own non-sellable plan version. */
async function seedSubscription(ownerId: string): Promise<string> {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.ACCOMMODATION,
            slug: `b53-route-${crypto.randomUUID()}`,
            name: 'B5.3 route'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.ACCOMMODATION,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 10000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    created.billingOptions.push(option.id);
    const [subscription] = await db
        .insert(subscriptions)
        .values({
            userId: ownerId,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected subscription');
    created.subscriptions.push(subscription.id);
    return subscription.id;
}

async function insertCreditedPayment(
    subject: { readonly subscriptionId: string } | { readonly addonInstanceId: string },
    amount: number
): Promise<string> {
    const [payment] = await getDb()
        .insert(payments)
        .values({
            ...subject,
            amount,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'FAKE',
            providerFactId: `b53-route-${crypto.randomUUID()}`,
            factAt: SEEDED_AT
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Expected payment');
    created.payments.push(payment.id);
    return payment.id;
}

/**
 * A credited (`SUCCEEDED`) payment on a fresh subscription of a fresh owner,
 * with the open `covered_period` it pays for.
 */
export async function seedPaidSubscription(amount = 10000) {
    const ownerId = await seedUser('owner');
    const subscriptionId = await seedSubscription(ownerId);
    const paymentId = await insertCreditedPayment({ subscriptionId }, amount);
    const [coverage] = await getDb()
        .insert(coveredPeriods)
        .values({ subscriptionId, periodStart: SEEDED_AT, paymentId, creditedAt: SEEDED_AT })
        .returning({ id: coveredPeriods.id });
    if (!coverage) throw new Error('Expected covered period');
    return { ownerId, subscriptionId, paymentId, coveredPeriodId: coverage.id };
}

/** A credited payment of a one-time add-on instance owned by a fresh user (no subscription). */
export async function seedPaidAddonInstance(amount = 10000) {
    const db = getDb();
    const ownerId = await seedUser('addon-owner');
    const [addon] = await db
        .insert(addons)
        .values({ slug: `b53-route-addon-${crypto.randomUUID()}`, name: 'B5.3 addon' })
        .returning({ id: addons.id });
    if (!addon) throw new Error('Expected addon');
    const [version] = await db
        .insert(addonVersions)
        .values({ addonId: addon.id, validity: 'FIXED_DAYS', validityDays: 30, scopeType: 'USER' })
        .returning({ id: addonVersions.id });
    if (!version) throw new Error('Expected addon version');
    const [product] = await db
        .insert(addonProducts)
        .values({
            versionId: version.id,
            addonId: addon.id,
            price: amount,
            currency: 'ARS',
            chargeKind: 'UNA_VEZ',
            compatibleVerticals: ['accommodation']
        })
        .returning({ id: addonProducts.id });
    if (!product) throw new Error('Expected addon product');
    created.addonProducts.push(product.id);
    const [instance] = await db
        .insert(addonInstances)
        .values({ productId: product.id, addonVersionId: version.id, ownerId, status: 'ACTIVE' })
        .returning({ id: addonInstances.id });
    if (!instance) throw new Error('Expected addon instance');
    created.addonInstances.push(instance.id);
    const paymentId = await insertCreditedPayment({ addonInstanceId: instance.id }, amount);
    return { ownerId, addonInstanceId: instance.id, paymentId };
}

/** An RF1 `REQUESTED` refund on a payment, as S36 would leave it. */
export async function seedRequestedRefund(input: {
    readonly paymentId: string;
    readonly amount: number;
}): Promise<string> {
    const [row] = await getDb()
        .insert(refunds)
        .values({
            paymentId: input.paymentId,
            amount: input.amount,
            reason: 'REVOCATION',
            status: 'REQUESTED'
        })
        .returning({ id: refunds.id });
    if (!row) throw new Error('Expected refund request');
    return row.id;
}

/** Every refund row of one payment, oldest first. */
export async function refundsOfPayment(paymentId: string) {
    return getDb()
        .select()
        .from(refunds)
        .where(eq(refunds.paymentId, paymentId))
        .orderBy(refunds.createdAt, refunds.id);
}

/** The payment row and its refund rows: what a refused settlement must leave untouched. */
export async function moneyState(paymentId: string) {
    const [payment] = await getDb().select().from(payments).where(eq(payments.id, paymentId));
    return { payment, refunds: await refundsOfPayment(paymentId) };
}

/** The covered period row. */
export async function coveredPeriodRow(id: string) {
    const [row] = await getDb().select().from(coveredPeriods).where(eq(coveredPeriods.id, id));
    return row;
}

/** Request headers of a mock actor; without an actor, the request carries no session. */
export function actorHeaders(actor?: {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
}): Record<string, string> {
    const base = { 'content-type': 'application/json', 'user-agent': 'vitest' };
    if (!actor) return base;
    return {
        ...base,
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions)
    };
}

/** Delete every row this file seeded, children first. */
export async function cleanupSettleExternalRows(): Promise<void> {
    const db = getDb();
    const paymentIds = created.payments.splice(0);
    if (paymentIds.length > 0) {
        await db.delete(refunds).where(inArray(refunds.paymentId, paymentIds));
        await db.delete(coveredPeriods).where(inArray(coveredPeriods.paymentId, paymentIds));
        await db.delete(payments).where(inArray(payments.id, paymentIds));
    }
    const deleteAll = async (ids: string[], remove: (ids: string[]) => Promise<unknown>) => {
        const taken = ids.splice(0);
        if (taken.length > 0) await remove(taken);
    };
    await deleteAll(created.addonInstances, (ids) =>
        db.delete(addonInstances).where(inArray(addonInstances.id, ids))
    );
    await deleteAll(created.addonProducts, (ids) =>
        db.delete(addonProducts).where(inArray(addonProducts.id, ids))
    );
    await deleteAll(created.subscriptions, (ids) =>
        db.delete(subscriptions).where(inArray(subscriptions.id, ids))
    );
    await deleteAll(created.billingOptions, (ids) =>
        db.delete(billingOptions).where(inArray(billingOptions.id, ids))
    );
    await deleteAll(created.users, (ids) => db.delete(users).where(inArray(users.id, ids)));
}
