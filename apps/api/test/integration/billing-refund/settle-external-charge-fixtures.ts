import { eq, getDb, payments } from '@repo/db';
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

/** Seed an approved provider charge that has not been delivered to the receiver. */
export async function seedUnrecordedApprovedCharge() {
    injectPaymentProvider({ provider: chargeFake });
    const seeded = await seedCardRevocable({ fake: chargeFake, clock: chargeClock });
    const charge = await chargeFake.charge({
        authorizationId: seeded.authorizationId,
        amount: { amountMinor: 10000, currency: 'ARS' },
        reference: `b59-charge-${crypto.randomUUID()}`
    });
    await chargeFake.readCharge({ chargeId: charge.chargeId });
    return { ...seeded, chargeId: charge.chargeId };
}

/** Seed a rejected provider charge for the route's typed approval refusal. */
export async function seedUnrecordedRejectedCharge() {
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
