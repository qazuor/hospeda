import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { eq, getDb, manualPaymentModel, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { emitBillingFact } from '../facts/billing-fact-sink';
import { creditedPaymentsFromLedger } from '../payment/payment-ledger';
import { enterManualGraceInTx } from './manual-grace-entry';
import {
    enqueueManualInstallmentUnpaidNotice,
    type ManualInstallmentNoticeRecipients
} from './manual-installment-unpaid-notice';

const logger = createLogger('open-manual-installment');
const inputSchema = z.strictObject({ pageSize: z.number().int().positive().max(1000) });
const DAY_MS = 86_400_000;

/** Dependencies of the due manual installment clock. */
export interface OpenDueManualInstallmentsPorts {
    readonly clock: Clock;
    readonly planPolicy?: VerticalsForBilling['planPolicy'];
    readonly billingFacts?: BillingFactSink;
    readonly recipients?: ManualInstallmentNoticeRecipients;
}

/** Opens each due manual installment in its own transaction and applies manual S4. */
export async function openDueManualInstallments(
    input: { readonly pageSize: number },
    ports: OpenDueManualInstallmentsPorts
): Promise<{ opened: number; alreadyOpen: number; skipped: number; errors: number }> {
    const { pageSize } = inputSchema.parse(input);
    const now = ports.clock.now();
    const candidates = await manualPaymentModel.findDueManualSubscriptions({
        now,
        limit: pageSize
    });
    const summary = { opened: 0, alreadyOpen: 0, skipped: 0, errors: 0 };
    for (const candidate of candidates) {
        try {
            if (!ports.planPolicy)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Plan policy is not registered for grace entry',
                    undefined,
                    'PLAN_POLICY_NOT_REGISTERED'
                );
            if (!candidate.planVersionId)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Principal subscription has no plan version for grace policy',
                    undefined,
                    'SUBSCRIPTION_PLAN_VERSION_MISSING'
                );
            const { graceDays } = await ports.planPolicy({
                planVersionId: candidate.planVersionId
            });
            const result = await getDb().transaction(async (tx) => {
                const [row] = await tx
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, candidate.id))
                    .for('update');
                if (
                    !row ||
                    row.status !== 'ACTIVE' ||
                    row.paymentMethod !== 'MANUAL' ||
                    row.class !== 'PRINCIPAL' ||
                    !row.nextChargeAt ||
                    row.nextChargeAt > now
                )
                    return { outcome: 'SKIPPED' as const };
                const periodStart = row.nextChargeAt;
                if (
                    await manualPaymentModel.hasInstallmentForPeriod({
                        subscriptionId: row.id,
                        periodStart,
                        tx
                    })
                )
                    return { outcome: 'ALREADY_OPEN' as const };
                const manualPayment = await manualPaymentModel.insertAwaitingInstallment({
                    subscriptionId: row.id,
                    periodStart,
                    tx
                });
                const credited = await creditedPaymentsFromLedger.hasCreditedPayment({
                    subscriptionId: row.id,
                    tx
                });
                const enteredGrace = credited
                    ? await enterManualGraceInTx({ tx, subscriptionId: row.id, now, graceDays })
                    : false;
                if (!credited)
                    logger.error(
                        { subscriptionId: row.id },
                        'Manual installment opened without credited payment'
                    );
                await enqueueManualInstallmentUnpaidNotice(
                    {
                        tx,
                        manualPaymentId: manualPayment.id,
                        subscriptionId: row.id,
                        vertical: row.vertical ?? '',
                        periodStart,
                        openedAt: now,
                        firstInstallment: false
                    },
                    { recipients: ports.recipients }
                );
                return { outcome: 'OPENED' as const, row, enteredGrace };
            });
            if (result.outcome === 'SKIPPED') summary.skipped++;
            else if (result.outcome === 'ALREADY_OPEN') summary.alreadyOpen++;
            else {
                summary.opened++;
                if (!result.enteredGrace) summary.skipped++;
                if (result.enteredGrace && result.row.userId) {
                    const vertical = VerticalEnumSchema.safeParse(result.row.vertical);
                    if (vertical.success)
                        emitBillingFact({
                            sink: ports.billingFacts,
                            fact: {
                                kind: 'GRACE_STARTED',
                                userId: result.row.userId,
                                vertical: vertical.data,
                                subscriptionId: result.row.id,
                                subscriptionClass: 'PRINCIPAL',
                                actorKind: 'SYSTEM',
                                occurredAt: now,
                                graceStartedAt: now,
                                graceEndsAt: new Date(now.getTime() + graceDays * DAY_MS),
                                daysOfGrace: graceDays
                            }
                        });
                }
            }
        } catch (error) {
            summary.errors++;
            logger.error(
                { subscriptionId: candidate.id, error },
                'Manual installment opening failed'
            );
        }
    }
    return summary;
}
