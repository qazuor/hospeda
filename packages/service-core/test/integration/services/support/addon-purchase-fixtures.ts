import type { ListingResponse } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    addonVersions,
    type DrizzleClient,
    eq,
    inArray,
    payments,
    planVersions,
    subscriptions,
    trials
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { TrialStatusEnum } from '@repo/schemas';
import type { PurchaseAddonPorts } from '../../../../src/services/billing/addon/purchase-addon-ports';
import { getServiceTestDb } from '../helpers';
import {
    seedCoverageAddon,
    seedCoverageAddonProduct,
    seedCoveragePlanVersion,
    seedCoverageUser
} from './coverage-fixtures';

export const purchaseNow = new Date('2026-10-13T12:00:00.000Z');
const owners: string[] = [];

/** Creates committed fixture rows because purchaseAddon owns its own transaction. */
export async function purchaseFixture(
    input: {
        readonly scopeType?: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
        readonly chargeKind?: 'UNA_VEZ' | 'PERIODICO';
        readonly cycle?: 'monthly' | 'annual';
        readonly verticals?: readonly string[];
    } = {}
) {
    const db = getServiceTestDb();
    const verticals = input.verticals ?? ['accommodation'];
    const { userId: ownerId } = await db.transaction(async (tx) =>
        seedCoverageUser(tx as DrizzleClient)
    );
    owners.push(ownerId);
    const product = await createProduct({
        scopeType: input.scopeType ?? 'USER',
        chargeKind: input.chargeKind ?? 'UNA_VEZ',
        cycle: input.cycle ?? 'monthly',
        verticals
    });
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => purchaseNow },
        honestAbout: [{ lie: 'M1', why: 'A1 identity test needs an applied preapproval' }]
    });
    const listings = new Map<string, ListingResponse>();
    const anchors = new Set<string>();
    const ports: PurchaseAddonPorts = {
        provider: fake,
        clock: { now: () => purchaseNow },
        addonPolicy: async ({ addonVersionId }) => {
            const [row] = await db
                .select()
                .from(addonVersions)
                .where(eq(addonVersions.id, addonVersionId));
            if (!row) throw new Error('Addon policy fixture version missing');
            return {
                addonId: row.addonId,
                validity: row.validity,
                validityDays: row.validityDays,
                scopeType: row.scopeType
            };
        },
        listing: async ({ listingId }) => {
            const listing = listings.get(listingId);
            if (listing) return listing;
            const error = new Error('Listing missing');
            error.name = 'ListingNotFoundError';
            throw error;
        },
        liveAnchors: {
            async hasLiveAnchor({ userId, vertical }) {
                return anchors.has(`${userId}|${vertical}`);
            }
        }
    };
    return {
        ownerId,
        ...product,
        fake,
        ports,
        setListing: (id: string, listing: ListingResponse) => listings.set(id, listing),
        anchor: (vertical: string) => anchors.add(`${ownerId}|${vertical}`),
        input: (orderRequestId = crypto.randomUUID(), targetId: string | null = null) => ({
            ownerId,
            productId: product.productId,
            targetId,
            orderRequestId,
            expectedAddonVersionId: product.versionId,
            returnUrl: 'https://example.test/return',
            payerEmail: 'payer@example.test'
        })
    };
}

/** Seeds an addon catalog product; one-time products use FIXED_DAYS. */
export async function createProduct(input: {
    readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
    readonly chargeKind: 'UNA_VEZ' | 'PERIODICO';
    readonly cycle: 'monthly' | 'annual';
    readonly verticals: readonly string[];
}): Promise<{ readonly productId: string; readonly versionId: string }> {
    return getServiceTestDb().transaction(async (raw) => {
        const tx = raw as DrizzleClient;
        const { addonId, versionIds } = await seedCoverageAddon(tx, {
            versions: [
                {
                    validity:
                        input.chargeKind === 'UNA_VEZ' ? 'FIXED_DAYS' : 'WHILE_SUBSCRIPTION_ALIVE',
                    scopeType: input.scopeType
                }
            ]
        });
        const versionId = versionIds[0];
        if (!versionId) throw new Error('Purchase fixture version missing');
        if (input.chargeKind === 'UNA_VEZ') {
            const product = await seedCoverageAddonProduct(tx, {
                addonId,
                versionId,
                compatibleVerticals: input.verticals
            });
            return { ...product, versionId };
        }
        const [product] = await tx
            .insert(addonProducts)
            .values({
                addonId,
                versionId,
                price: 5000,
                currency: 'ARS',
                chargeKind: 'PERIODICO',
                cycle: input.cycle,
                compatibleVerticals: [...input.verticals]
            })
            .returning({ id: addonProducts.id });
        if (!product) throw new Error('Purchase fixture product missing');
        return { productId: product.id, versionId };
    });
}

/** Seeds a principal directly in the requested state. */
export async function principalFixture(input: {
    readonly ownerId: string;
    readonly vertical?: string;
    readonly status?: 'ACTIVE' | 'GRACE_PERIOD' | 'CANCELLED';
    readonly predecessorId?: string;
    readonly credited?: boolean;
}): Promise<string> {
    const vertical = input.vertical ?? 'accommodation';
    return getServiceTestDb().transaction(async (raw) => {
        const tx = raw as DrizzleClient;
        const plan = await seedCoveragePlanVersion(tx, vertical);
        const [row] = await tx
            .insert(subscriptions)
            .values({
                userId: input.ownerId,
                vertical,
                planVersionId: plan.planVersionId,
                billingOptionId: plan.billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: input.status ?? 'ACTIVE',
                succeedsId: input.predecessorId ?? null
            })
            .returning({ id: subscriptions.id });
        if (!row) throw new Error('Purchase fixture principal missing');
        if (input.credited)
            await tx.insert(payments).values({
                subscriptionId: row.id,
                amount: 250000,
                currency: 'ARS',
                status: 'SUCCEEDED',
                provider: 'fake',
                providerFactId: `purchase-${crypto.randomUUID()}`,
                factAt: purchaseNow
            });
        return row.id;
    });
}

/** Seeds a running trial directly, without a principal row. */
export async function trialFixture(input: {
    readonly ownerId: string;
    readonly vertical?: string;
}): Promise<void> {
    const vertical = input.vertical ?? 'accommodation';
    await getServiceTestDb().transaction(async (raw) => {
        const tx = raw as DrizzleClient;
        const plan = await seedCoveragePlanVersion(tx, vertical);
        const [version] = await tx
            .select({ planId: planVersions.planId })
            .from(planVersions)
            .where(eq(planVersions.id, plan.planVersionId));
        if (!version) throw new Error('Purchase fixture trial plan missing');
        await tx.insert(trials).values({
            userId: input.ownerId,
            vertical,
            status: TrialStatusEnum.TRIAL_ACTIVE,
            trialPlanId: version.planId,
            floorEntitlementsVersionId: plan.planVersionId,
            floorLimitsVersionId: plan.planVersionId,
            floorTrialPlanVersionId: plan.planVersionId,
            startedAt: purchaseNow,
            endsAt: new Date(purchaseNow.getTime() + 86400000),
            deadlinesVersion: 1,
            emailPseudonym: crypto.randomUUID().replaceAll('-', '').repeat(2)
        });
    });
}

/** Retires only this file's committed live rows after each test. */
export async function retirePurchaseFixtures(): Promise<void> {
    const ids = owners.splice(0);
    if (ids.length === 0) return;
    const db = getServiceTestDb();
    await db
        .update(addonInstances)
        .set({ status: 'ABANDONED' })
        .where(inArray(addonInstances.ownerId, ids));
    await db
        .update(subscriptions)
        .set({ status: 'CANCELLED' })
        .where(inArray(subscriptions.userId, ids));
    await db
        .update(trials)
        .set({ status: TrialStatusEnum.TRIAL_EXPIRED })
        .where(inArray(trials.userId, ids));
}
