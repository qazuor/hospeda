import { coveredPeriods, eq, payments, receipts } from '@repo/db';
import { getServiceTestDb } from '../helpers.js';
import { cleanUpCoverageNoticeRows } from './coverage-notice-fixtures.js';
import { paymentFixture } from './payment-fixtures.js';

const userIds: string[] = [];

/** Seeds an approved fake-provider charge that has no corresponding payment fact. */
export async function unrecordedApprovedCharge(
    options: { readonly withCardValidation?: boolean } = {}
) {
    const fixture = await paymentFixture({ withoutRP12: !options.withCardValidation });
    userIds.push(fixture.user.id);
    const createdAt = fixture.clock.now();
    const charge = await fixture.provider.charge({
        authorizationId: fixture.started.authorizationId,
        amount: { amountMinor: 250000, currency: 'ARS' },
        reference: fixture.started.subscriptionId
    });
    return { fixture, chargeId: charge.chargeId, createdAt };
}

/** Inserts the exact PENDING fact shape written by `recordChargeFact`. */
export async function insertPendingChargeFact(input: {
    readonly subscriptionId: string;
    readonly provider: string;
    readonly chargeId: string;
    readonly amount: number;
    readonly factAt: Date;
}) {
    const [row] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: input.subscriptionId,
            amount: input.amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: input.provider,
            providerFactId: input.chargeId,
            factAt: input.factAt
        })
        .returning();
    if (!row) throw new Error('Pending charge fact missing');
    return row;
}

/** Finds payment facts for one provider charge id. */
export function paymentFactsOf(chargeId: string) {
    return getServiceTestDb().select().from(payments).where(eq(payments.providerFactId, chargeId));
}

/** Reads coverage rows for one payment. */
export function coverageOfPayment(paymentId: string) {
    return getServiceTestDb()
        .select()
        .from(coveredPeriods)
        .where(eq(coveredPeriods.paymentId, paymentId));
}

/** Reads receipts for one payment. */
export function receiptsOfPayment(paymentId: string) {
    return getServiceTestDb().select().from(receipts).where(eq(receipts.paymentId, paymentId));
}

/** Cleans only the fixtures seeded by this file's tests. */
export async function retireChargeSettlementRows() {
    const ownedUsers = userIds.splice(0);
    await cleanUpCoverageNoticeRows({ userIds: ownedUsers, promoCodeIds: [] });
}
