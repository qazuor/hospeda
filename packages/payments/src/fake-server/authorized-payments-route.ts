import type { IncomingHttpHeaders } from 'node:http';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import { PaymentProviderError } from '../provider/errors';

/** Serves the measured paginated list of charge records for one authorization. */
export async function handleAuthorizedPaymentsRoute(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly headers: IncomingHttpHeaders;
}): Promise<{ readonly status: number; readonly body: unknown } | null> {
    if (args.method !== 'GET' || args.url.pathname !== '/authorized_payments/search') return null;
    const authorizationId = args.url.searchParams.get('preapproval_id');
    if (!authorizationId)
        return { status: 400, body: { message: 'Search parameters are required' } };
    const rawLimit = args.url.searchParams.get('limit');
    const limit = rawLimit === null ? 10 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10)
        return { status: 400, body: { message: 'Invalid value for limit' } };
    const rawOffset = args.url.searchParams.get('offset');
    const offset = rawOffset === null ? 0 : Number(rawOffset);
    if (!Number.isInteger(offset) || offset < 0)
        return { status: 400, body: { message: 'Invalid value for offset' } };
    let chargeIds: readonly string[];
    try {
        chargeIds = (await args.provider.listCharges({ authorizationId })).chargeIds;
    } catch (error) {
        if (!(error instanceof PaymentProviderError) || error.code !== 'NOT_FOUND') throw error;
        return { status: 200, body: { paging: { total: 0, limit, offset }, results: [] } };
    }
    const records = await Promise.all(
        chargeIds.map(async (chargeId) => {
            const { snapshot } = await args.provider.readCharge({ chargeId });
            return {
                id: `ap-${chargeId}`,
                preapproval_id: snapshot.authorizationId,
                external_reference: snapshot.reference,
                date_created: snapshot.createdAt,
                ...(snapshot.expiresAt === null ? {} : { expire_date: snapshot.expiresAt }),
                status: snapshot.status === 'pending' ? 'scheduled' : 'processed',
                retry_attempt: 1,
                transaction_amount: snapshot.amount.amountMinor / 100,
                currency_id: snapshot.amount.currency,
                payment: {
                    id: chargeId,
                    status: snapshot.status,
                    status_detail: snapshot.declineReason
                }
            };
        })
    );
    return {
        status: 200,
        body: {
            paging: { total: records.length, limit, offset },
            results: records.slice(offset, offset + limit)
        }
    };
}
