import { randomUUID } from 'node:crypto';
import {
    billingOptions,
    eq,
    getDb,
    partners,
    payments,
    plans,
    planVersionEntitlements,
    planVersions,
    subscriptions
} from '@repo/db';
import { EntitlementKeyEnum, VerticalEnum } from '@repo/schemas';
import { createOwner } from '../listing-publication/publication-routes.helpers';

const db = getDb;
export const createdUserIds: string[] = [];
export const createdPartnerIds: string[] = [];
type Tier = 'GOLD' | 'SILVER';
type Owner = Awaited<ReturnType<typeof createOwner>>;
const keySet: Record<Tier, EntitlementKeyEnum[]> = {
    GOLD: [EntitlementKeyEnum.PARTNER_PUBLIC_PAGE, EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE],
    SILVER: [EntitlementKeyEnum.PARTNER_CAROUSEL_PRESENCE]
};

/** Seeds one immutable Partner plan version with the V7 presence keys. */
export async function seedPlan(tier: Tier): Promise<{ versionId: string; optionId: string }> {
    const connection = db();
    const [plan] = await connection
        .insert(plans)
        .values({
            vertical: VerticalEnum.PARTNER,
            slug: `v7-${tier.toLowerCase()}-${randomUUID()}`,
            name: `V7 ${tier}`
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Expected Partner plan');
    const versionId = await connection.transaction(async (tx) => {
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: VerticalEnum.PARTNER,
                rank: Math.floor(Math.random() * 100000) + 1000,
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Expected Partner plan version');
        await tx.insert(planVersionEntitlements).values(
            keySet[tier].map((key) => ({
                planVersionId: version.id,
                key,
                planQuota: null,
                trialQuota: null
            }))
        );
        return version.id;
    });
    const [option] = await connection
        .insert(billingOptions)
        .values({
            planVersionId: versionId,
            cycle: 'monthly',
            amount: tier === 'GOLD' ? 50000 : 25000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Expected billing option');
    return { versionId, optionId: option.id };
}

/** Seed one owner, Partner, principal subscription, and succeeded payment. */
/** Seeds a Partner, owner, subscription, and payment fixture for V7 presence routes. */
export async function seedPartner(args: {
    readonly owner?: Owner;
    readonly tier?: Tier;
    readonly gold: { readonly versionId: string; readonly optionId: string };
    readonly silver: { readonly versionId: string; readonly optionId: string };
    readonly moderated?: boolean;
    readonly revoked?: boolean;
}): Promise<{
    owner: Owner | null;
    partner: typeof partners.$inferSelect;
    subscriptionId: string;
}> {
    const connection = db();
    const owner = args.owner ?? (await createOwner());
    if (args.owner === undefined) createdUserIds.push(owner.id);
    const tier = args.tier ?? 'GOLD';
    const selected = tier === 'GOLD' ? args.gold : args.silver;
    const [partner] = await connection
        .insert(partners)
        .values({
            slug: `v7-${randomUUID()}`,
            name: 'V7 public partner',
            type: 'business',
            description: 'Partner content retained during presence moderation',
            ownerUserId: owner.id,
            revokedAt: args.revoked ? new Date('2026-01-01T00:00:00.000Z') : null
        })
        .returning();
    if (!partner) throw new Error('Expected Partner row');
    createdPartnerIds.push(partner.id);
    if (args.moderated) {
        // The moderation route is corrida 2; here the bit is seeded directly.
        await connection
            .update(partners)
            .set({ presenceModerated: true })
            .where(eq(partners.id, partner.id));
    }
    const [subscription] = await connection
        .insert(subscriptions)
        .values({
            userId: owner.id,
            vertical: VerticalEnum.PARTNER,
            planVersionId: selected.versionId,
            billingOptionId: selected.optionId,
            paymentMethod: 'CARD',
            status: 'ACTIVE',
            class: 'PRINCIPAL'
        })
        .returning({ id: subscriptions.id });
    if (!subscription) throw new Error('Expected subscription');
    await connection.insert(payments).values({
        subscriptionId: subscription.id,
        amount: tier === 'GOLD' ? 50000 : 25000,
        currency: 'ARS',
        status: 'SUCCEEDED',
        provider: 'fake',
        providerFactId: `v7-${randomUUID()}`,
        factAt: new Date('2026-10-12T10:00:00.000Z')
    });
    return { owner, partner, subscriptionId: subscription.id };
}
