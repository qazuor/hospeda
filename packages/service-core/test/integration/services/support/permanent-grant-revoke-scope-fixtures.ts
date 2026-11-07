import type { ListingResponse } from '@repo/billing-verticals-contract';
import {
    addonProducts,
    addons,
    addonVersions,
    billingOptions,
    emailOutbox,
    eq,
    inArray,
    payments,
    plans,
    planVersions,
    providerLinks,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { vi } from 'vitest';
import { grantPermanentGrant } from '../../../../src/services/billing/grant/permanent-grant.service.js';
import { getServiceTestDb } from '../helpers.js';
import {
    addonPolicyFromTx,
    seedCoveragePayment,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './coverage-fixtures.js';
import { outboxBeforeCancelNotice } from './outbox-before-cancel-notice.js';
import { namespaceFake } from './payment-provider.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './permanent-grant-fixtures.js';
import { revokeNow } from './permanent-grant-revoke-fixtures.js';
import { retireS20Rows, seedS20Addon } from './permanent-grant-s20-fixtures.js';

type Scope = 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';

const seeded: Array<{
    readonly userIds: string[];
    readonly principalIds: string[];
    readonly planVersionIds: string[];
    readonly grantPlanId: string;
    readonly productIds: string[];
}> = [];

/** Commit a real grant over one titled addon; all ids belong to this worker's cleanup. */
export async function createScopeRevokeScenario(input: {
    readonly scopeType: Scope;
    readonly withUntitledAddon?: boolean;
    readonly withPayingPrincipalIn?: VerticalEnum;
}) {
    const db = getServiceTestDb();
    const beneficiary = await seedCoverageUser(db);
    const signer = await seedCoverageUser(db);
    const other = await seedCoverageUser(db);
    const userIds = [beneficiary.userId, signer.userId, other.userId];
    const principalIds: string[] = [];
    const planVersionIds: string[] = [];
    const productIds: string[] = [];
    const fake = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => revokeNow }
    });
    const seedPrincipal = async (vertical: VerticalEnum, withProvider: boolean) => {
        const plan = await seedCoveragePlanVersion(db, vertical);
        planVersionIds.push(plan.planVersionId);
        const principal = await seedCoverageSubscription(db, {
            userId: beneficiary.userId,
            vertical,
            ...plan,
            status: 'ACTIVE'
        });
        principalIds.push(principal.subscriptionId);
        if (withProvider) {
            const authorization = await fake.authorize({
                reference: crypto.randomUUID(),
                amount: { amountMinor: 1000000, currency: 'ARS' },
                cadence: { everyMonths: 1 },
                reason: 'principal fixture',
                returnUrl: 'https://example.test/return',
                payerEmail: `principal-${crypto.randomUUID()}@example.test`
            });
            await fake.approve({ authorizationId: authorization.authorizationId });
            await db.insert(providerLinks).values({
                subscriptionId: principal.subscriptionId,
                provider: 'MERCADO_PAGO',
                providerId: authorization.authorizationId
            });
        }
        return principal.subscriptionId;
    };
    let payingPrincipalId: string | undefined;
    if (input.withPayingPrincipalIn) {
        if (input.scopeType !== 'USER' && input.scopeType !== 'GLOBAL')
            throw new Error('paying principal belongs to USER or GLOBAL');
        payingPrincipalId = await seedPrincipal(input.withPayingPrincipalIn, false);
        await seedCoveragePayment(db, { subscriptionId: payingPrincipalId, status: 'SUCCEEDED' });
    }
    const listings = new Map<string, ListingResponse>();
    let targetPrincipalId: string | undefined;
    let targetId: string | null = null;
    if (input.scopeType === 'LISTING') {
        targetId = crypto.randomUUID();
        listings.set(targetId, {
            vertical: VerticalEnum.ACCOMMODATION,
            ownerId: beneficiary.userId,
            acceptsFeature: true
        });
    } else if (input.scopeType === 'VERTICAL_SUBSCRIPTION') {
        targetPrincipalId = await seedPrincipal(VerticalEnum.ACCOMMODATION, true);
        targetId = targetPrincipalId;
    }
    const addon = await seedS20Addon({
        fake,
        userId: beneficiary.userId,
        vertical: VerticalEnum.ACCOMMODATION,
        targetId,
        scopeType: input.scopeType,
        compatibleVerticals:
            input.scopeType === 'USER' || input.scopeType === 'GLOBAL'
                ? [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE]
                : [VerticalEnum.ACCOMMODATION]
    });
    productIds.push(addon.productId);
    const untitledAddon = input.withUntitledAddon
        ? await seedS20Addon({
              fake,
              userId: beneficiary.userId,
              vertical: VerticalEnum.VENUE,
              targetId: null,
              scopeType: 'USER',
              compatibleVerticals: [VerticalEnum.VENUE]
          })
        : undefined;
    if (untitledAddon) productIds.push(untitledAddon.productId);
    const emitCoverageChanged = vi.fn(
        async (_event: {
            readonly userId: string;
            readonly vertical: string;
            readonly sourceType: string;
            readonly change: string;
        }) => undefined
    );
    const listing = async ({ listingId }: { readonly listingId: string }) => {
        const row = listings.get(listingId);
        if (!row) throw new Error(`listing ${listingId} not programmed`);
        return row;
    };
    const ports = {
        planPolicy: currentFloorPolicy,
        clock: { now: () => revokeNow },
        provider: namespaceFake(fake),
        beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
        coverageNotices: { emitCoverageChanged },
        orphanhood: { addonPolicy: addonPolicyFromTx(db), listing }
    };
    const grantPlan = await seedGrantPlan(db, VerticalEnum.ACCOMMODATION);
    seeded.push({
        userIds,
        principalIds,
        planVersionIds,
        grantPlanId: grantPlan.planId,
        productIds
    });
    const grant = await grantPermanentGrant(
        {
            beneficiaryUserId: beneficiary.userId,
            actor: grantSignerActor(signer.userId),
            reason: 'scope fixture grant',
            includesAddons: true,
            anchors: [{ vertical: VerticalEnum.ACCOMMODATION, ...grantPlan }]
        },
        ports
    );
    return {
        userId: beneficiary.userId,
        signerId: signer.userId,
        otherId: other.userId,
        grant,
        addon,
        untitledAddon,
        targetId,
        targetPrincipalId,
        payingPrincipalId,
        fake,
        ports,
        listing,
        emitCoverageChanged
    };
}

/** Remove only rows seeded here, children before parents. */
export async function retireScopeRevokeScenarios(): Promise<void> {
    const rows = seeded.splice(0);
    if (rows.length === 0) return;
    const db = getServiceTestDb();
    await retireS20Rows();
    for (const row of rows) {
        if (row.principalIds.length > 0) {
            await db
                .delete(providerLinks)
                .where(inArray(providerLinks.subscriptionId, row.principalIds));
            await db.delete(payments).where(inArray(payments.subscriptionId, row.principalIds));
            await db.delete(subscriptions).where(inArray(subscriptions.id, row.principalIds));
        }
        await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, row.userIds));
        await retirePermanentGrantRows(row.userIds);
        for (const productId of row.productIds) {
            const [product] = await db
                .select({ addonId: addonProducts.addonId, versionId: addonProducts.versionId })
                .from(addonProducts)
                .where(eq(addonProducts.id, productId));
            if (!product) continue;
            await db.delete(addonProducts).where(eq(addonProducts.id, productId));
            await db.delete(addonVersions).where(eq(addonVersions.id, product.versionId));
            await db.delete(addons).where(eq(addons.id, product.addonId));
        }
        for (const versionId of row.planVersionIds) {
            const [version] = await db
                .select({ planId: planVersions.planId })
                .from(planVersions)
                .where(eq(planVersions.id, versionId));
            if (!version) continue;
            await db.delete(billingOptions).where(eq(billingOptions.planVersionId, versionId));
            await db.delete(planVersions).where(eq(planVersions.id, versionId));
            await db.delete(plans).where(eq(plans.id, version.planId));
        }
        await db.delete(planVersions).where(eq(planVersions.planId, row.grantPlanId));
        await db.delete(plans).where(eq(plans.id, row.grantPlanId));
    }
}
