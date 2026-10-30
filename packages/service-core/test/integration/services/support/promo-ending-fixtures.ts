import {
    and,
    asc,
    billingDeadlineVersions,
    billingOptions,
    type DrizzleClient,
    emailOutbox,
    eq,
    promoCodes,
    promoRedemptions,
    sql,
    subscriptions,
    users
} from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import { seedCoveragePlanVersion, seedCoverageUser } from './coverage-fixtures';

const baseValues: BillingDeadlineValues = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
};

export function promoEndingInstant(day: string, hour = '12'): Date {
    return new Date(`${day}T${hour}:00:00.000Z`);
}

export async function insertDeadlineVersion(
    tx: DrizzleClient,
    input: {
        readonly version: number;
        readonly createdAt: Date;
        readonly daysBefore: number;
    }
): Promise<void> {
    await tx.insert(billingDeadlineVersions).values({
        version: input.version,
        createdAt: input.createdAt,
        values: { ...baseValues, '14': { daysBefore: input.daysBefore } }
    });
}

export async function seedPromoEndingCase(
    tx: DrizzleClient,
    input: {
        readonly nextChargeAt: Date;
        readonly redeemedAt: Date;
        readonly remainingCharges?: number | null;
        readonly durationKind?: 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER';
        readonly status?: string;
        readonly class?: 'PRINCIPAL' | 'COMPLEMENTO';
        readonly paymentMethod?: 'CARD' | 'MANUAL';
        readonly discountKind?: 'PERCENTAGE' | 'FIXED';
        readonly value?: number;
        readonly listAmountMinor?: number;
    }
): Promise<{ subscriptionId: string; redemptionId: string; userId: string; email: string }> {
    const { userId } = await seedCoverageUser(tx);
    const [user] = await tx.select({ email: users.email }).from(users).where(eq(users.id, userId));
    const { planVersionId, billingOptionId } = await seedCoveragePlanVersion(tx, 'accommodation');
    if (input.listAmountMinor !== undefined) {
        await tx
            .update(billingOptions)
            .set({ amount: input.listAmountMinor })
            .where(eq(billingOptions.id, billingOptionId));
    }
    const [subscription] = await tx
        .insert(subscriptions)
        .values({
            userId,
            vertical: 'accommodation',
            planVersionId,
            billingOptionId,
            status: input.status ?? 'ACTIVE',
            class: input.class ?? 'PRINCIPAL',
            paymentMethod: input.paymentMethod ?? 'CARD',
            nextChargeAt: input.nextChargeAt,
            createdAt: promoEndingInstant('2098-01-01'),
            updatedAt: promoEndingInstant('2098-01-01')
        })
        .returning({ id: subscriptions.id });
    const durationKind = input.durationKind ?? 'N_CHARGES';
    const [code] = await tx
        .insert(promoCodes)
        .values({
            code: `PROMO-END-${crypto.randomUUID()}`,
            effectKind: 'DISCOUNT',
            discountKind: input.discountKind ?? 'PERCENTAGE',
            value: input.value ?? 20,
            allVerticals: true,
            verticals: null,
            totalQuota: null,
            validFrom: promoEndingInstant('2090-01-01'),
            validUntil: null,
            stackable: true,
            usableWithAnotherActive: true,
            durationKind,
            durationCharges: durationKind === 'N_CHARGES' ? 2 : null
        })
        .returning({ id: promoCodes.id });
    const [redemption] = await tx
        .insert(promoRedemptions)
        .values({
            promoCodeId: code!.id,
            userId,
            subscriptionId: subscription!.id,
            redeemedAt: input.redeemedAt,
            remainingCharges: input.remainingCharges === undefined ? 1 : input.remainingCharges
        })
        .returning({ id: promoRedemptions.id });
    if (!user || !code || !subscription || !redemption)
        throw new Error('Promo ending fixture insert failed');
    return {
        subscriptionId: subscription.id,
        redemptionId: redemption.id,
        userId,
        email: user.email
    };
}

export async function addPromoToSubscription(
    tx: DrizzleClient,
    input: {
        readonly subscriptionId: string;
        readonly userId: string;
        readonly value: number;
        readonly discountKind: 'PERCENTAGE' | 'FIXED';
        readonly redeemedAt: Date;
    }
): Promise<void> {
    const [code] = await tx
        .insert(promoCodes)
        .values({
            code: `PROMO-LIVE-${crypto.randomUUID()}`,
            effectKind: 'DISCOUNT',
            discountKind: input.discountKind,
            value: input.value,
            allVerticals: true,
            verticals: null,
            totalQuota: null,
            validFrom: promoEndingInstant('2090-01-01'),
            validUntil: null,
            stackable: true,
            usableWithAnotherActive: true,
            durationKind: 'N_CHARGES',
            durationCharges: 2
        })
        .returning({ id: promoCodes.id });
    await tx.insert(promoRedemptions).values({
        promoCodeId: code!.id,
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        redeemedAt: input.redeemedAt,
        remainingCharges: 2
    });
}

export async function readPromoEndingOutbox(tx: DrizzleClient, subscriptionId: string) {
    return tx
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, 'billing.promo-ending'),
                sql`${emailOutbox.payload}->>'subscriptionId' = ${subscriptionId}`
            )
        )
        .orderBy(asc(emailOutbox.dedupKey));
}
