import { billingDeadlineVersions, eq, getDb, payments } from '@repo/db';
import type { BillingDeadlineValues } from '@repo/schemas';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import {
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedCardRevocable
} from '../billing-subscription/revocation-route-fixtures';

export const CHARGE_TEST_NOW = new Date('2026-10-05T12:00:00.000Z');
export const chargeClock = routeClock(CHARGE_TEST_NOW);
export const chargeFake = routeFake(chargeClock);

/**
 * Version 1 of the billing deadlines, which `startSubscription` reads. The
 * table is wiped by `testDb.clean()` and by `billing-deadlines.test.ts`, and
 * every `hospeda-api` integration file shares one database in series, so these
 * seeds cannot rely on another file having left the row in place. Same values
 * and idempotent insert as `billing-subscription/start.test.ts`.
 */
const billingDeadlineVersion1Values = {
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
} satisfies BillingDeadlineValues;

async function ensureBillingDeadlineVersion1(): Promise<void> {
    await getDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: billingDeadlineVersion1Values })
        .onConflictDoNothing();
}

/** Seed an approved provider charge that has not been delivered to the receiver. */
export async function seedUnrecordedApprovedCharge() {
    await ensureBillingDeadlineVersion1();
    injectPaymentProvider({ provider: chargeFake });
    const seeded = await seedCardRevocable({ fake: chargeFake, clock: chargeClock });
    const charge = await chargeFake.charge({
        authorizationId: seeded.authorizationId,
        amount: { amountMinor: 10000, currency: 'ARS' },
        reference: `b59-charge-${crypto.randomUUID()}`
    });
    chargeClock.set(new Date(chargeClock.now().getTime() + 60 * 60 * 1000));
    await chargeFake.readCharge({ chargeId: charge.chargeId });
    return { ...seeded, chargeId: charge.chargeId };
}

/** Seed a rejected provider charge for the route's typed approval refusal. */
export async function seedUnrecordedRejectedCharge() {
    await ensureBillingDeadlineVersion1();
    injectPaymentProvider({ provider: chargeFake });
    const seeded = await seedCardRevocable({ fake: chargeFake, clock: chargeClock });
    const charge = await chargeFake.declineCharge({
        authorizationId: seeded.authorizationId,
        declineReason: 'card declined'
    });
    await chargeFake.readCharge({ chargeId: charge.chargeId });
    return { ...seeded, chargeId: charge.chargeId };
}

/** Read payments created for this provider charge only. */
export function paymentsForCharge(chargeId: string) {
    return getDb().select().from(payments).where(eq(payments.providerFactId, chargeId));
}

/** Remove exactly the rows this fixture's subscription seeder registered. */
export async function cleanupExternalChargeRows() {
    await retireRevocationRouteRows();
}
