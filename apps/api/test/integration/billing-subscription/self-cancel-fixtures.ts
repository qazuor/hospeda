import {
    addonInstances,
    addonProducts,
    addons,
    billingOptions,
    buildEmailDedupKey,
    buildEventOccurrence,
    coveredPeriods,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    inArray,
    plans,
    planVersions,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND } from '@repo/service-core';
import {
    actorHeaders as baseActorHeaders,
    routeClock as baseRouteClock,
    routeFake as baseRouteFake,
    NOW,
    retireRevocationRouteRows,
    seedCardRevocable,
    seedPrincipal,
    seedUser
} from './revocation-route-fixtures';

const periodIds: string[] = [];
const addonInstanceIds: string[] = [];
const addonComplementIds: string[] = [];
export const routeClock = baseRouteClock;
export const routeFake = baseRouteFake;
export const actorHeaders = baseActorHeaders;
export { NOW, seedUser } from './revocation-route-fixtures';

/** Seed a card principal with a provider link and one paid service period. */
export async function seedSelfActive(
    fake: FakePaymentProvider,
    clock: ReturnType<typeof routeClock>
) {
    const seeded = await seedCardRevocable({ fake, clock });
    const [period] = await getDb()
        .insert(coveredPeriods)
        .values({
            subscriptionId: seeded.subscriptionId,
            paymentId: seeded.paymentId,
            periodStart: new Date('2026-09-08T12:00:00.000Z'),
            creditedAt: NOW
        })
        .returning({ id: coveredPeriods.id });
    if (!period) throw new Error('Expected paid period');
    periodIds.push(period.id);
    return seeded;
}

/** Seed a paid card principal with its real provider link in S23 or S24 origin state. */
export async function seedSelfDirectCard(
    status: 'SUSPENDED' | 'GRACE_PERIOD',
    fake: FakePaymentProvider,
    clock: ReturnType<typeof routeClock>
) {
    const seeded = await seedSelfActive(fake, clock);
    if (status === 'GRACE_PERIOD') {
        await getDb()
            .update(subscriptions)
            .set({
                status,
                graceStartedAt: new Date('2026-10-01T12:00:00.000Z'),
                graceEndsAt: new Date('2026-10-11T12:00:00.000Z')
            })
            .where(eq(subscriptions.id, seeded.subscriptionId));
    } else {
        await getDb()
            .update(subscriptions)
            .set({ status })
            .where(eq(subscriptions.id, seeded.subscriptionId));
    }
    return seeded;
}

/** Seed an owned principal in one of the non-active source states. */
export async function seedSelfState(
    status:
        | 'SUSPENDED'
        | 'GRACE_PERIOD'
        | 'PAUSED'
        | 'CANCEL_SCHEDULED'
        | 'ACTIVE'
        | 'CANCELLED'
        | 'PENDING_AUTHORIZATION'
) {
    const ownerId = await seedUser(`self-${status.toLowerCase()}`);
    const subscriptionId = await seedPrincipal({ ownerId, status });
    if (status === 'GRACE_PERIOD') {
        await getDb()
            .update(subscriptions)
            .set({
                graceStartedAt: new Date('2026-10-01T12:00:00.000Z'),
                graceEndsAt: new Date('2026-10-11T12:00:00.000Z')
            })
            .where(eq(subscriptions.id, subscriptionId));
    }
    if (status === 'CANCEL_SCHEDULED') {
        await getDb()
            .update(subscriptions)
            .set({ serviceEndsAt: new Date('2026-11-05T12:00:00.000Z') })
            .where(eq(subscriptions.id, subscriptionId));
    }
    return { ownerId, subscriptionId };
}

/** Seed a live complement row for list-exclusion assertions. */
export async function seedSelfComplement(ownerId: string) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical: VerticalEnum.GASTRONOMY,
            slug: `self-cancel-complement-${crypto.randomUUID()}`,
            name: 'Self cancel complement fixture'
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected complement plan');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical: VerticalEnum.GASTRONOMY,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: false,
            current: false,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('Expected complement plan version');
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 7300, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected complement billing option');
    const [row] = await db
        .insert(subscriptions)
        .values({
            userId: ownerId,
            vertical: VerticalEnum.GASTRONOMY,
            planVersionId: version.id,
            billingOptionId: option.id,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'COMPLEMENTO'
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('Expected complement subscription');
    addonComplementIds.push(row.id);
    return { subscriptionId: row.id };
}

/** Seed recurrent addon fixtures matching the addon-orphanhood integration helpers. */
export async function seedSelfPreviewAddon(input: {
    readonly ownerId: string;
    readonly targetId: string;
    readonly status: 'ACTIVE' | 'PENDING_AUTHORIZATION';
    readonly chargeKind?: 'PERIODICO' | 'UNA_VEZ';
}) {
    const { seedOrphanInstance, seedComplement } = await import(
        '../../../../../packages/service-core/test/integration/services/support/addon-orphan-fixtures'
    );
    return getDb().transaction(async (tx) => {
        const complement = await seedComplement(tx, {
            userId: input.ownerId,
            vertical: 'accommodation',
            status: 'ACTIVE'
        });
        const seeded = await seedOrphanInstance(tx, {
            ownerId: input.ownerId,
            scopeType: 'VERTICAL_SUBSCRIPTION',
            compatibleVerticals: ['accommodation'],
            status: input.status,
            targetId: input.targetId,
            complementSubscriptionId: complement.subscriptionId,
            chargeKind: input.chargeKind
        });
        const [product] = await tx
            .select({ addonId: addonProducts.addonId })
            .from(addonProducts)
            .where(eq(addonProducts.id, seeded.productId));
        if (!product) throw new Error('Expected addon product');
        await tx
            .update(addons)
            .set({ name: 'Preview addon' })
            .where(eq(addons.id, product.addonId));
        addonInstanceIds.push(seeded.instanceId);
        addonComplementIds.push(complement.subscriptionId);
        return { instanceId: seeded.instanceId, complementId: complement.subscriptionId };
    });
}

/** Preset the scheduled-cancellation notice as sent, transient or exhausted. */
export async function presetSelfCancelNotice(input: {
    readonly ownerId: string;
    readonly subscriptionId: string;
    readonly status: 'sent' | 'pending' | 'failed';
}) {
    const template = BEFORE_CANCEL_TEMPLATE_BY_KIND.SCHEDULED_CANCELLATION;
    const dedupKey = buildEmailDedupKey({
        recipient: input.ownerId,
        template,
        occurrence: buildEventOccurrence({ eventId: input.subscriptionId })
    });
    await emailOutboxModel.enqueue({
        recipientUserId: input.ownerId,
        recipientEmail: `self-cancel-${crypto.randomUUID()}@example.test`,
        template,
        payload: { subscriptionId: input.subscriptionId },
        dedupKey
    });
    if (input.status !== 'pending') {
        await getDb()
            .update(emailOutbox)
            .set({
                status: input.status,
                lastError: input.status === 'failed' ? 'delivery-exhausted' : null
            })
            .where(eq(emailOutbox.dedupKey, dedupKey));
    }
}

/** Retire all self-cancellation fixture periods, rows and seeded identities. */
export async function retireSelfCancelRows() {
    const ids = periodIds.splice(0);
    if (ids.length) await getDb().delete(coveredPeriods).where(inArray(coveredPeriods.id, ids));
    const instances = addonInstanceIds.splice(0);
    if (instances.length)
        await getDb().delete(addonInstances).where(inArray(addonInstances.id, instances));
    const complements = addonComplementIds.splice(0);
    if (complements.length)
        await getDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED' })
            .where(inArray(subscriptions.id, complements));
    await retireRevocationRouteRows();
}
