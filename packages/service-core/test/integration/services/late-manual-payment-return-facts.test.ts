import {
    accommodations,
    billingOptions,
    inArray,
    listingPublicationModel,
    partners,
    planVersionEntitlements,
    planVersions,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { EntitlementKeyEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import {
    type LateManualPaymentReturnPorts,
    readLateManualPaymentReturn
} from '../../../src/services/billing/subscription/late-manual-payment-return-facts';
import {
    closeServiceTestPool,
    getServiceTestDb,
    getServiceTestPool,
    isServiceTestDbAvailable
} from './helpers.js';
import { seedCoveragePlanVersion } from './support/coverage-fixtures.js';
import {
    retirePlanChanges,
    seedPlanChange,
    seedPlanChangePublications,
    seedPlanChangeTargetWithLimit
} from './support/plan-change-fixtures.js';
import { nextPlanVersionRank } from './support/plan-version-rank.js';

const now = new Date('2026-10-10T12:00:00.000Z');
const extraSubscriptions: string[] = [];
const extraPartners: string[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    if (extraSubscriptions.length)
        await db
            .delete(subscriptions)
            .where(inArray(subscriptions.id, extraSubscriptions.splice(0)));
    if (extraPartners.length)
        await db.delete(partners).where(inArray(partners.id, extraPartners.splice(0)));
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

/** Records a status change the way PB transitions do. */
async function statusEvent(input: {
    readonly listingId: string;
    readonly from: PublicationStatusEnum;
    readonly to: PublicationStatusEnum;
    readonly actorType: 'owner' | 'job';
    readonly userId: string;
    readonly at: string;
}) {
    await listingPublicationModel.insertStatusChangedEvent({
        tx: getServiceTestDb(),
        vertical: VerticalEnum.ACCOMMODATION,
        listingId: input.listingId,
        from: input.from,
        to: input.to,
        actorType: input.actorType,
        actorId: input.actorType === 'owner' ? input.userId : undefined,
        correlationId: crypto.randomUUID(),
        occurredAt: new Date(input.at)
    } as Parameters<typeof listingPublicationModel.insertStatusChangedEvent>[0]);
}

/** Inserts a version whose entitlements and VIP flag are written before it is sealed. */
async function seedVersion(input: {
    readonly sourcePlanVersionId: string;
    readonly inheritsTouristVip?: boolean;
    readonly entitlements?: readonly EntitlementKeyEnum[];
}) {
    const source = await getServiceTestPool().query<{ plan_id: string; vertical: string }>(
        'SELECT plan_id, vertical FROM plan_version WHERE id = $1',
        [input.sourcePlanVersionId]
    );
    const row = source.rows[0];
    if (!row) throw new Error('Source version missing');
    return getServiceTestDb().transaction(async (tx) => {
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: row.plan_id,
                vertical: row.vertical,
                rank: nextPlanVersionRank(),
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: false,
                inheritsTouristVip: input.inheritsTouristVip ?? false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Version missing');
        const [option] = await tx
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'monthly',
                amount: 500000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('Option missing');
        if (input.entitlements?.length)
            await tx
                .insert(planVersionEntitlements)
                .values(input.entitlements.map((key) => ({ planVersionId: version.id, key })));
        return { planVersionId: version.id, billingOptionId: option.id };
    });
}

async function dueChange(input: {
    readonly subscriptionId: string;
    readonly target: { readonly planVersionId: string; readonly billingOptionId: string };
}) {
    await getServiceTestDb()
        .insert(subscriptionScheduledChanges)
        .values({
            subscriptionId: input.subscriptionId,
            targetPlanVersionId: input.target.planVersionId,
            targetBillingOptionId: input.target.billingOptionId,
            effectiveAt: new Date('2026-09-01T00:00:00.000Z')
        });
}

/**
 * One owner with every listing case: three UNPUBLISHED_BY_BILLING with manual publish
 * instants, one archived from PUBLISHED, one archived from DRAFT, one MODERATED, one
 * PURGED, one incomplete and one already PUBLISHED.
 */
async function seedListings() {
    const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
    const userId = seeded.user.id;
    const ids = await seedPlanChangePublications({
        userId,
        statuses: [
            PublicationStatusEnum.PUBLISHED,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            PublicationStatusEnum.ARCHIVED,
            PublicationStatusEnum.ARCHIVED,
            PublicationStatusEnum.MODERATED,
            PublicationStatusEnum.PURGED,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        ]
    });
    const [
        published,
        oldest,
        newest,
        middle,
        archivedPublic,
        archivedDraft,
        moderated,
        purged,
        incomplete
    ] = ids as [string, string, string, string, string, string, string, string, string];
    const owner = { userId, actorType: 'owner' as const, from: PublicationStatusEnum.DRAFT };
    const toPublished = PublicationStatusEnum.PUBLISHED;
    await statusEvent({ ...owner, listingId: oldest, to: toPublished, at: '2026-02-01T00:00:00Z' });
    await statusEvent({ ...owner, listingId: newest, to: toPublished, at: '2026-04-01T00:00:00Z' });
    await statusEvent({ ...owner, listingId: middle, to: toPublished, at: '2026-03-01T00:00:00Z' });
    await statusEvent({
        ...owner,
        listingId: incomplete,
        to: toPublished,
        at: '2026-05-01T00:00:00Z'
    });
    await statusEvent({
        userId,
        actorType: 'job',
        listingId: archivedPublic,
        from: PublicationStatusEnum.PUBLISHED,
        to: PublicationStatusEnum.ARCHIVED,
        at: '2026-06-01T00:00:00Z'
    });
    await statusEvent({
        userId,
        actorType: 'job',
        listingId: archivedDraft,
        from: PublicationStatusEnum.DRAFT,
        to: PublicationStatusEnum.ARCHIVED,
        at: '2026-06-01T00:00:00Z'
    });
    return {
        seeded,
        userId,
        ids: {
            published,
            oldest,
            newest,
            middle,
            archivedPublic,
            archivedDraft,
            moderated,
            purged,
            incomplete
        }
    };
}

function ports(incompleteId: string): LateManualPaymentReturnPorts {
    return {
        readIncompleteListingIds: async ({ listingIds }) =>
            new Map(listingIds.includes(incompleteId) ? [[incompleteId, ['photos']]] : [])
    };
}

const outcomes = (items: readonly { readonly id: string; readonly outcome: string }[]) =>
    Object.fromEntries(items.map((item) => [item.id, item.outcome]));

describe.skipIf(!isServiceTestDbAvailable())('HOS-1640 MP4 preview reads (real DB)', () => {
    it('I3: classifies every listing case exactly, with more candidates than quota', async () => {
        // Arrange
        const { seeded, userId, ids } = await seedListings();
        const pro = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 3
        });

        // Act
        const result = await readLateManualPaymentReturn({
            tx: getServiceTestDb(),
            subject: {
                id: seeded.predecessor.id,
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                planVersionId: pro.planVersionId
            },
            now,
            ports: ports(ids.incomplete)
        });

        // Assert
        expect(result.presence.kind).toBe('LISTINGS');
        if (result.presence.kind !== 'LISTINGS') throw new Error('expected listings');
        expect(result.presence.limit).toBe(3);
        expect(outcomes(result.presence.listings)).toEqual({
            [ids.published]: 'ALREADY_PUBLISHED',
            [ids.newest]: 'RETURNS',
            [ids.middle]: 'RETURNS',
            [ids.oldest]: 'NO_SLOT',
            [ids.archivedPublic]: 'NO_SLOT',
            [ids.archivedDraft]: 'ARCHIVED_DRAFT',
            [ids.moderated]: 'MODERATED',
            [ids.purged]: 'PURGED',
            [ids.incomplete]: 'INCOMPLETE'
        });
        expect(result.s7Effects).toEqual({
            complements: { resumed: [], skipped: [] },
            touristVip: { cancels: false, subscriptionIds: [] },
            scheduledChange: null
        });
    });

    it('B1: a candidate at the same place as an earlier one is LOCATION_CONFLICT and the slot goes on', async () => {
        // Arrange
        const { seeded, userId, ids } = await seedListings();
        const pro = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 3
        });
        const db = getServiceTestDb();
        const key = `hos-1640-${crypto.randomUUID()}`;
        await db
            .update(accommodations)
            .set({ locationKey: key })
            .where(inArray(accommodations.id, [ids.newest, ids.middle]));

        // Act
        const result = await readLateManualPaymentReturn({
            tx: db,
            subject: {
                id: seeded.predecessor.id,
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                planVersionId: pro.planVersionId
            },
            now,
            ports: ports(ids.incomplete)
        });

        // Assert
        if (result.presence.kind !== 'LISTINGS') throw new Error('expected listings');
        const outcome = outcomes(result.presence.listings);
        expect(outcome[ids.newest]).toBe('RETURNS');
        expect(outcome[ids.middle]).toBe('LOCATION_CONFLICT');
        expect(outcome[ids.oldest]).toBe('RETURNS');
        expect(outcome[ids.archivedPublic]).toBe('NO_SLOT');
    });

    it('I1: a due Pro→Básico downgrade brings back only the Básico quota', async () => {
        // Arrange
        const { seeded, userId, ids } = await seedListings();
        const pro = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 3
        });
        const basico = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 2
        });
        await dueChange({ subscriptionId: seeded.predecessor.id, target: basico });

        // Act
        const result = await readLateManualPaymentReturn({
            tx: getServiceTestDb(),
            subject: {
                id: seeded.predecessor.id,
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                planVersionId: pro.planVersionId
            },
            now,
            ports: ports(ids.incomplete)
        });

        // Assert
        if (result.presence.kind !== 'LISTINGS') throw new Error('expected listings');
        expect(result.presence.limit).toBe(2);
        const returning = result.presence.listings
            .filter((listing) => listing.outcome === 'RETURNS')
            .map((listing) => listing.id);
        expect(returning).toEqual([ids.newest]);
        expect(result.s7Effects.scheduledChange).toEqual({
            effectiveAt: new Date('2026-09-01T00:00:00.000Z')
        });
    });

    it('I1: a due gold→silver change says the carousel comes back, not the gold page', async () => {
        // Arrange
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const gold = await seedVersion({
            sourcePlanVersionId: seeded.planVersionId,
            entitlements: [
                EntitlementKeyEnum.PARTNER_PUBLIC_PAGE,
                EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE
            ]
        });
        const silver = await seedVersion({
            sourcePlanVersionId: seeded.planVersionId,
            entitlements: [EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE]
        });
        const db = getServiceTestDb();
        const [partner] = await db
            .insert(partners)
            .values({
                slug: `hos-1640-${crypto.randomUUID()}`,
                name: 'Bodega Sur',
                ownerUserId: seeded.user.id
            })
            .returning({ id: partners.id });
        if (partner) extraPartners.push(partner.id);
        const subject = {
            id: seeded.predecessor.id,
            userId: seeded.user.id,
            vertical: VerticalEnum.PARTNER,
            planVersionId: gold.planVersionId
        };

        // Act
        const before = await readLateManualPaymentReturn({ tx: db, subject, now, ports: {} });
        await dueChange({ subscriptionId: seeded.predecessor.id, target: silver });
        const after = await readLateManualPaymentReturn({ tx: db, subject, now, ports: {} });

        // Assert
        expect(before.presence).toEqual({
            kind: 'PARTNER',
            partner: { name: 'Bodega Sur', slug: expect.stringMatching(/^hos-1640-/) },
            outcome: 'GOLD_PAGE_RETURNS'
        });
        expect(after.presence).toMatchObject({ kind: 'PARTNER', outcome: 'CAROUSEL_RETURNS' });
    });

    it('I1: a due change to a plan without Tourist VIP inheritance cancels no paid VIP', async () => {
        // Arrange
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const withVip = await seedVersion({
            sourcePlanVersionId: seeded.planVersionId,
            inheritsTouristVip: true
        });
        const withoutVip = await seedVersion({ sourcePlanVersionId: seeded.planVersionId });
        const db = getServiceTestDb();
        const vip = await db.transaction(async (tx) => {
            const plan = await seedCoveragePlanVersion(tx, 'tourist');
            const [row] = await tx
                .insert(subscriptions)
                .values({
                    userId: seeded.user.id,
                    vertical: 'tourist',
                    planVersionId: plan.planVersionId,
                    billingOptionId: plan.billingOptionId,
                    paymentMethod: 'CARD',
                    status: 'ACTIVE',
                    class: 'PRINCIPAL'
                })
                .returning({ id: subscriptions.id });
            return row;
        });
        if (!vip) throw new Error('VIP fixture failed');
        extraSubscriptions.push(vip.id);
        const subject = {
            id: seeded.predecessor.id,
            userId: seeded.user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            planVersionId: withVip.planVersionId
        };

        // Act
        const before = await readLateManualPaymentReturn({ tx: db, subject, now, ports: {} });
        await dueChange({ subscriptionId: seeded.predecessor.id, target: withoutVip });
        const after = await readLateManualPaymentReturn({ tx: db, subject, now, ports: {} });

        // Assert
        expect(before.s7Effects.touristVip).toEqual({ cancels: true, subscriptionIds: [vip.id] });
        expect(after.s7Effects.touristVip).toEqual({ cancels: false, subscriptionIds: [] });
    });
});
