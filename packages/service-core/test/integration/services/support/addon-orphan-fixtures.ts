/**
 * Fixtures for the addon orphanhood, A5 and S21 (HOS-1545, B5.6). Every helper writes through
 * the transaction it receives, so a test run inside `withServiceTestTransaction` leaves no row
 * behind; `seedCommittedOrphans` is the exception (it commits, for the provider half) and
 * `retireCommittedOrphanRows` cleans it. Reuses `coverage-fixtures.ts` without editing it.
 */
import type { ListingResponse } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    coveredPeriods,
    type DrizzleClient,
    domainEventModel,
    emailOutbox,
    eq,
    inArray,
    payments,
    providerLinks,
    reconciliationMarks,
    refunds,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { expect } from 'vitest';
import type {
    AddonOrphanhoodPorts,
    LiveAnchorReader
} from '../../../../src/services/billing/addon/addon-orphanhood-ports';
import { getServiceTestDb } from '../helpers';
import {
    addonPolicyFromTx,
    seedCoverageAddon,
    seedCoverageAddonProduct,
    seedCoveragePlanVersion,
    seedCoverageUser
} from './coverage-fixtures';

/** The vertical of the VERTICAL_SUBSCRIPTION helpers below. */
export const ORPHAN_VERTICAL = 'accommodation';

/** The instant every orphanhood test reads as "now". */
export const orphanNow = new Date('2026-10-13T12:00:00.000Z');

type ScopeType = 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';

/** A fresh owner. */
export async function seedOrphanOwner(tx: DrizzleClient): Promise<{ readonly userId: string }> {
    return seedCoverageUser(tx);
}

/** Inserts a PRINCIPAL row in the given state, with its own plan version. */
export async function seedPrincipal(
    tx: DrizzleClient,
    input: {
        readonly userId: string;
        readonly vertical: string;
        readonly status: string;
        readonly succeedsId?: string | null;
        readonly succeededById?: string | null;
    }
): Promise<{ readonly subscriptionId: string }> {
    const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(tx, input.vertical);
    const [row] = await tx
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: input.vertical,
            planVersionId,
            billingOptionId,
            paymentMethod: 'CARD',
            status: input.status,
            class: 'PRINCIPAL',
            succeedsId: input.succeedsId ?? null,
            succeededById: input.succeededById ?? null
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('orphan fixture principal missing');
    return { subscriptionId: row.id };
}

/** Inserts a COMPLEMENTO row (optionally with a provider link, a grace clock or an open pause). */
export async function seedComplement(
    tx: DrizzleClient,
    input: {
        readonly userId: string;
        readonly vertical: string;
        readonly status: string;
        readonly paymentMethod?: 'CARD' | 'MANUAL';
        readonly withLink?: boolean;
        readonly serviceEndsAt?: Date | null;
        readonly grace?: boolean;
        readonly openPause?: boolean;
    }
): Promise<{ readonly subscriptionId: string; readonly authorizationId: string | null }> {
    const [row] = await tx
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: input.vertical,
            paymentMethod: input.paymentMethod ?? 'CARD',
            status: input.status,
            class: 'COMPLEMENTO',
            serviceEndsAt: input.serviceEndsAt ?? null,
            graceStartedAt: input.grace ? new Date('2026-10-10T10:00:00.000Z') : null,
            graceEndsAt: input.grace ? new Date('2026-10-17T10:00:00.000Z') : null,
            updatedAt: new Date('2026-10-01T10:00:00.000Z')
        })
        .returning({ id: subscriptions.id });
    if (!row) throw new Error('orphan fixture complement missing');
    let authorizationId: string | null = null;
    if (input.withLink ?? true) {
        authorizationId = `orphan-${crypto.randomUUID()}`;
        await tx.insert(providerLinks).values({
            subscriptionId: row.id,
            provider: 'MERCADO_PAGO',
            providerId: authorizationId
        });
    }
    if (input.openPause)
        await tx.insert(subscriptionPauses).values({
            subscriptionId: row.id,
            reason: 'CUSTOMER_REQUEST',
            startsAt: new Date('2026-10-05T10:00:00.000Z')
        });
    return { subscriptionId: row.id, authorizationId };
}

/** Inserts an addon with one version of the scope, and a product (PERIODICO by default). */
export async function seedOrphanProduct(
    tx: DrizzleClient,
    input: {
        readonly scopeType: ScopeType;
        readonly compatibleVerticals: readonly string[];
        readonly chargeKind?: 'PERIODICO' | 'UNA_VEZ';
        readonly cycle?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
    }
): Promise<{ readonly productId: string; readonly versionId: string }> {
    const { addonId, versionIds } = await seedCoverageAddon(tx, {
        versions: [{ validity: 'WHILE_SUBSCRIPTION_ALIVE', scopeType: input.scopeType }]
    });
    const versionId = versionIds[0];
    if (!versionId) throw new Error('orphan fixture addon version missing');
    if (input.chargeKind === 'UNA_VEZ') {
        const { productId } = await seedCoverageAddonProduct(tx, {
            addonId,
            versionId,
            compatibleVerticals: input.compatibleVerticals
        });
        return { productId, versionId };
    }
    const [product] = await tx
        .insert(addonProducts)
        .values({
            addonId,
            versionId,
            price: 5000,
            currency: 'ARS',
            chargeKind: 'PERIODICO',
            cycle: input.cycle ?? 'monthly',
            compatibleVerticals: [...input.compatibleVerticals]
        })
        .returning({ id: addonProducts.id });
    if (!product) throw new Error('orphan fixture periodic product missing');
    return { productId: product.id, versionId };
}

/** Inserts an addon instance (a new product per call avoids the purchase identity index). */
export async function seedOrphanInstance(
    tx: DrizzleClient,
    input: {
        readonly ownerId: string;
        readonly scopeType: ScopeType;
        readonly compatibleVerticals: readonly string[];
        readonly status: string;
        readonly targetId?: string | null;
        readonly complementSubscriptionId?: string | null;
        readonly chargeKind?: 'PERIODICO' | 'UNA_VEZ';
        readonly cycle?: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
    }
): Promise<{ readonly instanceId: string; readonly productId: string }> {
    const { productId, versionId } = await seedOrphanProduct(tx, {
        scopeType: input.scopeType,
        compatibleVerticals: input.compatibleVerticals,
        chargeKind: input.chargeKind,
        cycle: input.cycle
    });
    const [instance] = await tx
        .insert(addonInstances)
        .values({
            productId,
            addonVersionId: versionId,
            ownerId: input.ownerId,
            status: input.status,
            targetId: input.targetId ?? null,
            complementSubscriptionId: input.complementSubscriptionId ?? null,
            startsAt: new Date('2026-10-03T10:00:00.000Z'),
            updatedAt: new Date('2026-10-03T10:00:00.000Z')
        })
        .returning({ id: addonInstances.id });
    if (!instance) throw new Error('orphan fixture addon instance missing');
    return { instanceId: instance.id, productId };
}

/** Inserts a credited provider charge and its optional open covered period. */
export async function seedComplementCharge(
    tx: DrizzleClient,
    input: {
        readonly subscriptionId: string;
        readonly factAt?: Date;
        readonly status?: string;
        readonly amount?: number;
        readonly coveredPeriodStart?: Date;
    }
): Promise<{ readonly paymentId: string }> {
    const factAt = input.factAt ?? new Date('2026-10-02T10:00:00.000Z');
    const [payment] = await tx
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: input.amount ?? 250000,
            currency: 'ARS',
            status: input.status ?? 'SUCCEEDED',
            provider: 'fake',
            providerFactId: `complement-${crypto.randomUUID()}`,
            factAt
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('orphan fixture complement payment missing');
    if (input.coveredPeriodStart)
        await tx.insert(coveredPeriods).values({
            subscriptionId: input.subscriptionId,
            periodStart: input.coveredPeriodStart,
            paymentId: payment.id,
            creditedAt: factAt
        });
    return { paymentId: payment.id };
}

/** An in-memory `ficha` and live-anchor reader, programmable per test. */
export function orphanPorts(tx: DrizzleClient): {
    readonly ports: AddonOrphanhoodPorts;
    readonly setListing: (listingId: string, listing: ListingResponse) => void;
    readonly anchor: (userId: string, vertical: string) => void;
} {
    const listings = new Map<string, ListingResponse>();
    const anchors = new Set<string>();
    const liveAnchors: LiveAnchorReader = {
        async hasLiveAnchor({ userId, vertical }) {
            return anchors.has(`${userId}|${vertical}`);
        }
    };
    return {
        ports: {
            addonPolicy: addonPolicyFromTx(tx),
            listing: async ({ listingId }) => {
                const listing = listings.get(listingId);
                if (!listing) throw new Error(`listing ${listingId} not programmed`);
                return listing;
            },
            liveAnchors
        },
        setListing: (listingId, listing) => listings.set(listingId, listing),
        anchor: (userId, vertical) => anchors.add(`${userId}|${vertical}`)
    };
}

/** The instance's status and updated_at. */
export async function readInstance(
    tx: DrizzleClient,
    instanceId: string
): Promise<{ readonly status: string; readonly updatedAt: Date }> {
    const [row] = await tx
        .select({ status: addonInstances.status, updatedAt: addonInstances.updatedAt })
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    if (!row) throw new Error(`instance ${instanceId} missing`);
    return row;
}

/** The subscription columns S21 touches or must not touch. */
export async function readSubscription(tx: DrizzleClient, subscriptionId: string) {
    const [row] = await tx
        .select({
            status: subscriptions.status,
            serviceEndsAt: subscriptions.serviceEndsAt,
            graceStartedAt: subscriptions.graceStartedAt,
            graceEndsAt: subscriptions.graceEndsAt,
            updatedAt: subscriptions.updatedAt
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    if (!row) throw new Error(`subscription ${subscriptionId} missing`);
    return row;
}

/** The pauses of a subscription. */
export async function readPauses(tx: DrizzleClient, subscriptionId: string) {
    return tx
        .select({ actualEndAt: subscriptionPauses.actualEndAt })
        .from(subscriptionPauses)
        .where(eq(subscriptionPauses.subscriptionId, subscriptionId));
}

/** The provider-cancellation decisions recorded on a subscription, read in the transaction. */
export async function readDecisions(tx: DrizzleClient, subscriptionId: string) {
    return (
        await domainEventModel.findByEntity({
            entityType: 'subscription',
            entityId: subscriptionId,
            tx
        })
    ).filter((event) => event.eventType === 'subscription.provider_cancellation_decided');
}

/** The refunds and reconciliation marks of a subscription (S21 never creates them). */
export async function readMoneyTrail(tx: DrizzleClient, subscriptionId: string) {
    const marks = await tx
        .select({ id: reconciliationMarks.id })
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
    const refundRows = await tx
        .select({ id: refunds.id })
        .from(refunds)
        .innerJoin(payments, eq(payments.id, refunds.paymentId))
        .where(eq(payments.subscriptionId, subscriptionId));
    return { marks, refunds: refundRows };
}

/** A VERTICAL_SUBSCRIPTION instance on `targetId`, with a card complement linked to MP. */
export async function seedVerticalAddon(
    tx: DrizzleClient,
    input: {
        readonly userId: string;
        readonly targetId: string;
        readonly instanceStatus?: string;
        readonly complementStatus?: string;
    }
) {
    const complement = await seedComplement(tx, {
        userId: input.userId,
        vertical: ORPHAN_VERTICAL,
        status: input.complementStatus ?? 'ACTIVE'
    });
    const { instanceId } = await seedOrphanInstance(tx, {
        ownerId: input.userId,
        scopeType: 'VERTICAL_SUBSCRIPTION',
        compatibleVerticals: [ORPHAN_VERTICAL],
        status: input.instanceStatus ?? 'ACTIVE',
        targetId: input.targetId,
        complementSubscriptionId: complement.subscriptionId
    });
    return { instanceId, complementId: complement.subscriptionId, complement };
}

export async function expectUntouched(
    tx: DrizzleClient,
    seeded: { readonly instanceId: string; readonly complementId: string },
    instanceStatus = 'ACTIVE'
) {
    expect((await readInstance(tx, seeded.instanceId)).status).toBe(instanceStatus);
    expect((await readSubscription(tx, seeded.complementId)).status).toBe('ACTIVE');
    expect(await readDecisions(tx, seeded.complementId)).toHaveLength(0);
}

export async function expectOrphaned(
    tx: DrizzleClient,
    seeded: { readonly instanceId: string; readonly complementId: string }
) {
    expect((await readInstance(tx, seeded.instanceId)).status).toBe('CANCELLED');
    expect((await readSubscription(tx, seeded.complementId)).status).toBe('CANCELLED');
    const decisions = await readDecisions(tx, seeded.complementId);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.reason).toBe('A5');
}

const committedInstances: string[] = [];
const committedSubscriptions: string[] = [];
const committedUsers: string[] = [];

/**
 * Takes every COMMITTED orphan row out of the live populations and drops its mail (HOS-1545,
 * corrida 2, where the provider call goes after the commit): instances and subscriptions end
 * `CANCELLED` without a grace clock, and the outbox rows of the seeded owners are deleted.
 */
export async function retireCommittedOrphanRows(): Promise<void> {
    const db = getServiceTestDb();
    const instances = committedInstances.splice(0);
    const subs = committedSubscriptions.splice(0);
    const people = committedUsers.splice(0);
    if (instances.length > 0)
        await db
            .update(addonInstances)
            .set({ status: 'CANCELLED' })
            .where(inArray(addonInstances.id, instances));
    if (subs.length > 0) {
        await db.delete(subscriptionPauses).where(inArray(subscriptionPauses.subscriptionId, subs));
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(inArray(subscriptions.id, subs));
    }
    if (people.length > 0)
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, people));
}

/**
 * COMMITTED rows for the provider half of A5: an owner, a PRINCIPAL already `CANCELLED` (it
 * left the live rows) and `count` ACTIVE VERTICAL_SUBSCRIPTION instances on it, each with its
 * own ACTIVE card complement linked to a real, approved preapproval of the fake. Random ids;
 * {@link retireCommittedOrphanRows} takes them out after each test.
 */
export async function seedCommittedOrphans(input: {
    readonly fake: FakePaymentProvider;
    readonly count?: number;
}): Promise<{
    readonly userId: string;
    readonly principalId: string;
    readonly addons: readonly {
        readonly instanceId: string;
        readonly complementId: string;
        readonly authorizationId: string;
    }[];
}> {
    const authorizationIds: string[] = [];
    for (let i = 0; i < (input.count ?? 1); i++) {
        const { authorizationId } = await input.fake.authorize({
            reference: `orphan-${crypto.randomUUID()}`,
            amount: { amountMinor: 500000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'addon orphanhood provider fixture',
            returnUrl: 'https://example.test/return',
            payerEmail: `payer-${crypto.randomUUID()}@example.test`
        });
        await input.fake.approve({ authorizationId });
        authorizationIds.push(authorizationId);
    }
    return getServiceTestDb().transaction(async (raw) => {
        const tx = raw as unknown as DrizzleClient;
        const { userId } = await seedOrphanOwner(tx);
        committedUsers.push(userId);
        const { subscriptionId: principalId } = await seedPrincipal(tx, {
            userId,
            vertical: ORPHAN_VERTICAL,
            status: 'CANCELLED'
        });
        committedSubscriptions.push(principalId);
        const addons = [];
        for (const authorizationId of authorizationIds) {
            const { subscriptionId: complementId } = await seedComplement(tx, {
                userId,
                vertical: ORPHAN_VERTICAL,
                status: 'ACTIVE',
                withLink: false
            });
            committedSubscriptions.push(complementId);
            await tx.insert(providerLinks).values({
                subscriptionId: complementId,
                provider: 'MERCADO_PAGO',
                providerId: authorizationId
            });
            const { instanceId } = await seedOrphanInstance(tx, {
                ownerId: userId,
                scopeType: 'VERTICAL_SUBSCRIPTION',
                compatibleVerticals: [ORPHAN_VERTICAL],
                status: 'ACTIVE',
                targetId: principalId,
                complementSubscriptionId: complementId
            });
            committedInstances.push(instanceId);
            addons.push({ instanceId, complementId, authorizationId });
        }
        return { userId, principalId, addons };
    });
}
