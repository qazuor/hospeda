import { billingDeadlineVersions, type DrizzleClient, desc, eq, subscriptions } from '@repo/db';
import {
    type BillingDeadlineValues,
    BillingDeadlineValuesSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '../../../types/index.js';
import { stampRenewalNoticeClock } from './renewal-notice.js';

/** Reads PLAZO:15 from the predecessor's locked cycle snapshot, stamping a new cycle once. */
export async function readCycleDeadlines(input: {
    readonly tx: DrizzleClient;
    readonly subscriptionId: string;
}): Promise<{
    readonly version: number;
    readonly values: BillingDeadlineValues;
    readonly stamped: boolean;
}> {
    // Lock first, then re-read the joined snapshot under READ COMMITTED. A joined row
    // selected before a lock wait can still carry the prior deadline version.
    const [locked] = await input.tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1)
        .for('update');
    if (!locked)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Subscription not found',
            undefined,
            'SUBSCRIPTION_NOT_FOUND'
        );
    const [row] = await input.tx
        .select({
            status: subscriptions.status,
            nextChargeAt: subscriptions.nextChargeAt,
            paymentMethod: subscriptions.paymentMethod,
            noticeVersion: subscriptions.renewalNoticeDeadlineVersion,
            noticeChargeAt: subscriptions.renewalNoticeChargeAt,
            storedValues: billingDeadlineVersions.values
        })
        .from(subscriptions)
        .leftJoin(
            billingDeadlineVersions,
            eq(billingDeadlineVersions.version, subscriptions.renewalNoticeDeadlineVersion)
        )
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Subscription not found',
            undefined,
            'SUBSCRIPTION_NOT_FOUND'
        );
    if (
        row.nextChargeAt &&
        row.noticeChargeAt?.getTime() === row.nextChargeAt.getTime() &&
        row.noticeVersion !== null &&
        row.storedValues !== null
    )
        return {
            version: row.noticeVersion,
            values: BillingDeadlineValuesSchema.parse(row.storedValues),
            stamped: false
        };
    const [current] = await input.tx
        .select({
            version: billingDeadlineVersions.version,
            values: billingDeadlineVersions.values
        })
        .from(billingDeadlineVersions)
        .orderBy(desc(billingDeadlineVersions.version))
        .limit(1);
    if (!current)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Billing deadlines are missing'
        );
    const values = BillingDeadlineValuesSchema.parse(current.values);
    if (row.status === 'ACTIVE' && row.nextChargeAt) {
        await stampRenewalNoticeClock({
            tx: input.tx,
            subscriptionId: input.subscriptionId,
            version: current.version,
            chargeAt: row.nextChargeAt,
            now: new Date()
        });
        return { version: current.version, values, stamped: true };
    }
    return { version: current.version, values, stamped: false };
}
