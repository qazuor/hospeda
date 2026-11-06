import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import {
    accommodations,
    billingOptions,
    coveredPeriods,
    destinations,
    eq,
    idempotencyKeys,
    inArray,
    listingPublicationModel,
    payments,
    planVersionLimits,
    planVersions,
    promoCodes,
    promoRedemptions,
    providerLinks,
    subscriptionPauses,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { getServiceTestDb, getServiceTestPool, seedAccommodation } from '../helpers.js';
import { seedCoveragePlanVersion } from './coverage-fixtures.js';
import {
    seedPredecessor,
    seedSuccessionChoice,
    successionClock,
    successionPorts,
    successionReturnUrl
} from './succession-fixtures.js';

const owned: Array<{ userId: string; predecessorId: string; promoCodeIds: string[] }> = [];
const publicationFixtures: Array<{
    readonly userId: string;
    readonly extraUserIds: string[];
    readonly destinationIds: string[];
    readonly listingIds: string[];
}> = [];

/** Creates a destination version and all immutable children in one transaction. */
export async function seedPlanChangeTargetWithLimit(input: {
    readonly sourcePlanVersionId: string;
    readonly targetLimit: number;
    readonly amountMinor?: number;
}) {
    const source = await getServiceTestPool().query<{ plan_id: string; vertical: string }>(
        'SELECT plan_id, vertical FROM plan_version WHERE id = $1',
        [input.sourcePlanVersionId]
    );
    const sourceRow = source.rows[0];
    if (!sourceRow) throw new Error('Plan-change source version missing');
    return getServiceTestDb().transaction(async (tx) => {
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: sourceRow.plan_id,
                vertical: sourceRow.vertical,
                rank: 1_500_000_000 + Math.floor(Math.random() * 100_000_000),
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Plan-change destination version missing');
        const [option] = await tx
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'monthly',
                amount: input.amountMinor ?? 500000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('Plan-change destination option missing');
        await tx.insert(planVersionLimits).values({
            planVersionId: version.id,
            key: PUBLICATION_LIMIT_KEYS.accommodation,
            value: input.targetLimit
        });
        return {
            planVersionId: version.id,
            billingOptionId: option.id,
            amountMinor: input.amountMinor ?? 500000
        };
    });
}

/** Seeds owner listings and a target publication limit for downgrade coverage tests. */
export async function seedPlanChangePublications(input: {
    readonly userId: string;
    readonly statuses: readonly PublicationStatusEnum[];
}) {
    const db = getServiceTestDb();
    const fixture = {
        userId: input.userId,
        extraUserIds: [] as string[],
        destinationIds: [] as string[],
        listingIds: [] as string[]
    };
    for (const [index, status] of input.statuses.entries()) {
        const seeded = await seedAccommodation(db, { publicationStatus: status });
        fixture.destinationIds.push(seeded.destinationId);
        fixture.listingIds.push(seeded.accommodationId);
        if (seeded.userId !== input.userId) {
            fixture.extraUserIds.push(seeded.userId);
            await db
                .update(accommodations)
                .set({ ownerId: input.userId })
                .where(eq(accommodations.id, seeded.accommodationId));
        }
        if (status === PublicationStatusEnum.PUBLISHED)
            await listingPublicationModel.insertStatusChangedEvent({
                tx: db,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: seeded.accommodationId,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                actorId: input.userId,
                correlationId: crypto.randomUUID(),
                occurredAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`)
            });
    }
    publicationFixtures.push(fixture);
    return fixture.listingIds;
}

/** Seeds one S1/S2-shaped predecessor and programmable contract verdict. */
export async function seedPlanChange(input: {
    readonly status?: string;
    readonly providerState?: 'active' | 'cancelled';
    readonly rankRelation?: 'HIGHER' | 'LOWER';
}) {
    const choice = await seedSuccessionChoice();
    let targetPlanVersionId = choice.targetPlanVersionId;
    let targetBillingOptionId = choice.targetBillingOptionId;
    if (input.rankRelation) {
        const source = await getServiceTestPool().query<{ rank: number }>(
            'SELECT rank FROM plan_version WHERE id = $1',
            [choice.planVersionId]
        );
        const targetPlan = await getServiceTestPool().query<{ plan_id: string }>(
            'SELECT plan_id FROM plan_version WHERE id = $1',
            [choice.targetPlanVersionId]
        );
        const originRank = source.rows[0]?.rank;
        const planId = targetPlan.rows[0]?.plan_id;
        if (originRank === undefined || !planId) throw new Error('Rank fixture missing');
        const version = await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, true, false, 0, false) RETURNING id',
            [planId, 'accommodation', originRank + (input.rankRelation === 'HIGHER' ? 1 : -1)]
        );
        targetPlanVersionId = version.rows[0]?.id ?? '';
        const option = await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 500000, 'ARS') RETURNING id",
            [targetPlanVersionId]
        );
        targetBillingOptionId = option.rows[0]?.id ?? '';
    }
    const seeded = await seedPredecessor({
        userId: choice.user.id,
        planVersionId: choice.planVersionId,
        billingOptionId: choice.predecessorBillingOptionId,
        status: input.status ?? 'ACTIVE',
        providerState: input.providerState ?? 'active',
        honestAboutM1: true
    });
    const nextChargeAt = new Date('2026-11-11T13:00:00.000Z');
    await getServiceTestDb()
        .update(subscriptions)
        .set({ nextChargeAt })
        .where(eq(subscriptions.id, seeded.predecessor.id));
    if (input.status === 'PAUSED')
        await getServiceTestDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: seeded.predecessor.id,
                reason: 'CUSTOMER_REQUEST',
                requestedMonths: 2,
                startsAt: new Date('2026-10-10T13:00:00.000Z'),
                expectedEndAt: new Date('2026-12-10T13:00:00.000Z')
            });
    const verticals = new VerticalsForBillingSimulator({ clock: successionClock });
    verticals.setPlanPolicy({
        planVersionId: targetPlanVersionId,
        policy: { graceDays: 10, allowsPause: false, current: true, sellable: true }
    });
    verticals.setPlanPolicy({
        planVersionId: choice.planVersionId,
        policy: { graceDays: 10, allowsPause: false, current: true, sellable: true }
    });
    owned.push({ userId: choice.user.id, predecessorId: seeded.predecessor.id, promoCodeIds: [] });
    return {
        ...choice,
        targetPlanVersionId,
        targetBillingOptionId,
        ...seeded,
        nextChargeAt,
        verticals,
        ports: {
            ...successionPorts(seeded.provider),
            planPolicy: verticals.planPolicy.bind(verticals),
            changeDirection: verticals.changeDirection.bind(verticals)
        },
        input: {
            actor: { id: choice.user.id },
            subscriptionId: seeded.predecessor.id,
            billingOptionId: targetBillingOptionId,
            returnUrl: successionReturnUrl,
            payerEmail: choice.user.email
        }
    };
}

/** Adds another higher-rank destination to exercise a queued downgrade replacement. */
export async function seedAdditionalPlanChangeTarget(input: {
    readonly planVersionId: string;
    readonly rankOffset?: number;
    readonly amountMinor?: number;
}) {
    const source = await getServiceTestPool().query<{ rank: number; plan_id: string }>(
        'SELECT rank, plan_id FROM plan_version WHERE id = $1',
        [input.planVersionId]
    );
    const row = source.rows[0];
    if (!row) throw new Error('Source plan version missing');
    const version = await getServiceTestPool().query<{ id: string }>(
        'INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause) VALUES ($1, $2, $3, true, false, 0, false) RETURNING id',
        [row.plan_id, 'accommodation', row.rank + (input.rankOffset ?? 2)]
    );
    const planVersionId = version.rows[0]?.id;
    if (!planVersionId) throw new Error('Destination plan version missing');
    const option = await getServiceTestPool().query<{ id: string }>(
        "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', $2, 'ARS') RETURNING id",
        [planVersionId, input.amountMinor ?? 600000]
    );
    const billingOptionId = option.rows[0]?.id;
    if (!billingOptionId) throw new Error('Destination billing option missing');
    return { planVersionId, billingOptionId, amountMinor: input.amountMinor ?? 600000 };
}

/** Adds a second principal for one user so row-scoped promotion effects can be checked. */
export async function seedSiblingPlanChangeSubscription(input: { readonly userId: string }) {
    const row = await getServiceTestDb().transaction(async (tx) => {
        const plan = await seedCoveragePlanVersion(tx, 'experience');
        const [subscription] = await tx
            .insert(subscriptions)
            .values({
                userId: input.userId,
                vertical: 'experience',
                planVersionId: plan.planVersionId,
                billingOptionId: plan.billingOptionId,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning({ id: subscriptions.id });
        return subscription;
    });
    if (!row) throw new Error('Sibling plan-change subscription missing');
    owned.push({ userId: '', predecessorId: row.id, promoCodeIds: [] });
    return row;
}

/** Credits a paid monthly period covering the frozen clock. */
export async function seedCoveredPayment(input: {
    readonly subscriptionId: string;
    readonly amountMinor: number;
}) {
    const db = getServiceTestDb();
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: input.amountMinor,
            currency: 'ARS',
            status: 'SUCCEEDED',
            provider: 'fake',
            providerFactId: crypto.randomUUID(),
            factAt: successionClock.now()
        })
        .returning();
    if (!payment) throw new Error('Payment fixture missing');
    const periodStart = new Date('2026-10-01T13:00:00.000Z');
    await db.insert(coveredPeriods).values({
        subscriptionId: input.subscriptionId,
        periodStart,
        paymentId: payment.id,
        creditedAt: periodStart
    });
    return { payment, periodStart };
}

/** Seeds an active promotion on this subscription. */
export async function seedPlanChangePromo(input: {
    readonly subscriptionId: string;
    readonly userId: string;
}) {
    const db = getServiceTestDb();
    const [code] = await db
        .insert(promoCodes)
        .values({
            code: `PLAN-${crypto.randomUUID()}`,
            discountKind: 'FIXED',
            value: 1000,
            allVerticals: true,
            stackable: true,
            usableWithAnotherActive: true,
            durationKind: 'N_CHARGES',
            durationCharges: 2,
            validFrom: new Date('2026-01-01T00:00:00Z')
        })
        .returning();
    if (!code) throw new Error('Promo fixture missing');
    const [redemption] = await db
        .insert(promoRedemptions)
        .values({
            promoCodeId: code.id,
            userId: input.userId,
            subscriptionId: input.subscriptionId,
            redeemedAt: successionClock.now(),
            remainingCharges: 2
        })
        .returning();
    if (!redemption) throw new Error('Redemption fixture missing');
    const owner = owned.find((item) => item.predecessorId === input.subscriptionId);
    owner?.promoCodeIds.push(code.id);
    return redemption;
}

/** Removes only mutable rows seeded by this fixture after each case. */
export async function retirePlanChanges(): Promise<void> {
    const db = getServiceTestDb();
    const fixtures = owned.splice(0);
    for (const item of fixtures) {
        const successorRows = await db
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(eq(subscriptions.succeedsId, item.predecessorId));
        const ids = [item.predecessorId, ...successorRows.map((row) => row.id)];
        await db
            .delete(subscriptionScheduledChanges)
            .where(inArray(subscriptionScheduledChanges.subscriptionId, ids));
        await db.delete(coveredPeriods).where(inArray(coveredPeriods.subscriptionId, ids));
        await db.delete(payments).where(inArray(payments.subscriptionId, ids));
        await db.delete(promoRedemptions).where(inArray(promoRedemptions.subscriptionId, ids));
        if (item.promoCodeIds.length)
            await db.delete(promoCodes).where(inArray(promoCodes.id, item.promoCodeIds));
        await db.delete(providerLinks).where(inArray(providerLinks.subscriptionId, ids));
        await db.delete(subscriptionPauses).where(inArray(subscriptionPauses.subscriptionId, ids));
        await db.delete(idempotencyKeys).where(inArray(idempotencyKeys.subjectId, ids));
        await db
            .update(subscriptions)
            .set({ succeededById: null })
            .where(eq(subscriptions.id, item.predecessorId));
        for (const successor of successorRows)
            await db.delete(subscriptions).where(eq(subscriptions.id, successor.id));
        await db.delete(subscriptions).where(eq(subscriptions.id, item.predecessorId));
    }
    const publications = publicationFixtures.splice(0);
    for (const item of publications) {
        if (item.listingIds.length > 0) {
            await db.delete(accommodations).where(inArray(accommodations.id, item.listingIds));
        }
        if (item.destinationIds.length > 0)
            await db.delete(destinations).where(inArray(destinations.id, item.destinationIds));
        if (item.extraUserIds.length > 0)
            await db.delete(users).where(inArray(users.id, item.extraUserIds));
    }
    const userIds = [...new Set(fixtures.map((item) => item.userId).filter(Boolean))];
    for (const userId of userIds) await db.delete(users).where(eq(users.id, userId));
}
