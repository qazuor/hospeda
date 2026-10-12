/**
 * Fixtures for the real coverage sources (HOS-1532, B4.1). Every helper writes
 * through the transaction it receives, so a test run inside
 * `withServiceTestTransaction` leaves no row behind.
 */
import type { AddonPolicyResponse, Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    addons,
    addonVersions,
    billingOptions,
    type DrizzleClient,
    eq,
    manualPayments,
    payments,
    plans,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import type { BillingCoveragePorts } from '../../../../src/services/billing/coverage/coverage-ports';

/** The instant every coverage test reads as "now". */
export const coverageNow = new Date('2026-10-12T12:00:00.000Z');

/** A clock frozen at a given instant. */
export function frozenClock(at: Date = coverageNow): Clock {
    return { now: () => at };
}

/** Inserts a fresh user. */
export async function seedCoverageUser(tx: DrizzleClient): Promise<{ readonly userId: string }> {
    const [user] = await tx
        .insert(users)
        .values({
            email: `coverage-${crypto.randomUUID()}@example.test`,
            displayName: 'Coverage test user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning({ id: users.id });
    if (!user) throw new Error('coverage fixture user missing');
    return { userId: user.id };
}

/** Inserts a plan, a non-sellable version and a billing option in a vertical. */
export async function seedCoveragePlanVersion(
    tx: DrizzleClient,
    vertical: string
): Promise<{ readonly planVersionId: string; readonly billingOptionId: string }> {
    const [plan] = await tx
        .insert(plans)
        .values({ vertical, slug: `coverage-${crypto.randomUUID()}`, name: 'Coverage plan' })
        .returning({ id: plans.id });
    if (!plan) throw new Error('coverage fixture plan missing');
    const [version] = await tx
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 1_000_000_000) + 1,
            sellable: false,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning({ id: planVersions.id });
    if (!version) throw new Error('coverage fixture plan version missing');
    const [option] = await tx
        .insert(billingOptions)
        .values({ planVersionId: version.id, cycle: 'monthly', amount: 250000, currency: 'ARS' })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('coverage fixture billing option missing');
    return { planVersionId: version.id, billingOptionId: option.id };
}

/** Inserts one subscription row directly, in the state the test asks for. */
export async function seedCoverageSubscription(
    tx: DrizzleClient,
    input: {
        readonly userId: string;
        readonly vertical: string;
        readonly planVersionId: string;
        readonly billingOptionId: string;
        readonly status: string;
        readonly class?: 'PRINCIPAL' | 'COMPLEMENTO';
        readonly createdAt?: Date;
        readonly serviceEndsAt?: Date | null;
        readonly succeedsId?: string | null;
    }
): Promise<{ readonly subscriptionId: string; readonly createdAt: Date }> {
    const [row] = await tx
        .insert(subscriptions)
        .values({
            userId: input.userId,
            vertical: input.vertical,
            planVersionId: input.planVersionId,
            billingOptionId: input.billingOptionId,
            paymentMethod: 'CARD',
            status: input.status,
            class: input.class ?? 'PRINCIPAL',
            serviceEndsAt: input.serviceEndsAt ?? null,
            succeedsId: input.succeedsId ?? null,
            createdAt: input.createdAt ?? new Date('2026-10-01T10:00:00.000Z')
        })
        .returning({ id: subscriptions.id, createdAt: subscriptions.createdAt });
    if (!row) throw new Error('coverage fixture subscription missing');
    return { subscriptionId: row.id, createdAt: row.createdAt };
}

/** Inserts a provider payment for a subscription. */
export async function seedCoveragePayment(
    tx: DrizzleClient,
    input: { readonly subscriptionId: string; readonly status: string }
): Promise<void> {
    await tx.insert(payments).values({
        subscriptionId: input.subscriptionId,
        amount: 250000,
        currency: 'ARS',
        status: input.status,
        provider: 'fake',
        providerFactId: `coverage-${crypto.randomUUID()}`,
        factAt: new Date('2026-10-02T10:00:00.000Z')
    });
}

/** Inserts a registered manual payment for a subscription. */
export async function seedCoverageManualPayment(
    tx: DrizzleClient,
    input: { readonly subscriptionId: string; readonly registeredBy: string }
): Promise<void> {
    await tx.insert(manualPayments).values({
        subscriptionId: input.subscriptionId,
        periodStart: new Date('2026-10-01T00:00:00.000Z'),
        status: 'REGISTERED',
        registeredBy: input.registeredBy,
        registeredAt: new Date('2026-10-02T10:00:00.000Z')
    });
}

/** Inserts an addon with one version per requested shape. */
export async function seedCoverageAddon(
    tx: DrizzleClient,
    input: {
        readonly versions: readonly {
            readonly validity: 'FIXED_DAYS' | 'WHILE_SUBSCRIPTION_ALIVE';
            readonly scopeType: 'LISTING' | 'VERTICAL_SUBSCRIPTION' | 'USER' | 'GLOBAL';
        }[];
    }
): Promise<{ readonly addonId: string; readonly versionIds: string[] }> {
    const [addon] = await tx
        .insert(addons)
        .values({ slug: `coverage-${crypto.randomUUID()}`, name: 'Coverage addon' })
        .returning({ id: addons.id });
    if (!addon) throw new Error('coverage fixture addon missing');
    const versionIds: string[] = [];
    for (const version of input.versions) {
        const [row] = await tx
            .insert(addonVersions)
            .values({
                addonId: addon.id,
                validity: version.validity,
                validityDays: version.validity === 'FIXED_DAYS' ? 30 : null,
                scopeType: version.scopeType
            })
            .returning({ id: addonVersions.id });
        if (!row) throw new Error('coverage fixture addon version missing');
        versionIds.push(row.id);
    }
    return { addonId: addon.id, versionIds };
}

/** Inserts a one-time addon product pointing at one version of an addon. */
export async function seedCoverageAddonProduct(
    tx: DrizzleClient,
    input: {
        readonly addonId: string;
        readonly versionId: string;
        readonly compatibleVerticals: readonly string[];
    }
): Promise<{ readonly productId: string }> {
    const [product] = await tx
        .insert(addonProducts)
        .values({
            addonId: input.addonId,
            versionId: input.versionId,
            price: 10000,
            currency: 'ARS',
            chargeKind: 'UNA_VEZ',
            cycle: null,
            compatibleVerticals: [...input.compatibleVerticals]
        })
        .returning({ id: addonProducts.id });
    if (!product) throw new Error('coverage fixture addon product missing');
    return { productId: product.id };
}

/** Inserts an addon instance anchored to the given version. */
export async function seedCoverageAddonInstance(
    tx: DrizzleClient,
    input: {
        readonly productId: string;
        readonly addonVersionId: string;
        readonly ownerId: string;
        readonly status?: string;
        readonly targetId?: string | null;
        readonly startsAt?: Date | null;
        readonly endsAt?: Date | null;
        readonly createdAt?: Date;
    }
): Promise<{ readonly instanceId: string }> {
    const [instance] = await tx
        .insert(addonInstances)
        .values({
            productId: input.productId,
            addonVersionId: input.addonVersionId,
            ownerId: input.ownerId,
            status: input.status ?? 'ACTIVE',
            targetId: input.targetId ?? null,
            startsAt:
                input.startsAt === undefined
                    ? new Date('2026-10-03T10:00:00.000Z')
                    : input.startsAt,
            endsAt: input.endsAt ?? null,
            createdAt: input.createdAt ?? new Date('2026-10-03T09:00:00.000Z')
        })
        .returning({ id: addonInstances.id });
    if (!instance) throw new Error('coverage fixture addon instance missing');
    return { instanceId: instance.id };
}

/**
 * `políticaDeAddon` read from the seeded `addon_version` row through the
 * test transaction (the production reader would not see uncommitted rows).
 */
export function addonPolicyFromTx(tx: DrizzleClient): BillingCoveragePorts['addonPolicy'] {
    return async ({ addonVersionId }): Promise<AddonPolicyResponse> => {
        const [version] = await tx
            .select()
            .from(addonVersions)
            .where(eq(addonVersions.id, addonVersionId));
        if (!version) throw new Error(`addon version ${addonVersionId} not seeded`);
        return {
            addonId: version.addonId,
            validity: version.validity,
            validityDays: version.validityDays,
            scopeType: version.scopeType
        };
    };
}
