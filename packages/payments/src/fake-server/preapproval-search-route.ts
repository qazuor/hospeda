import type { IncomingHttpHeaders } from 'node:http';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';

/** Serves provider-shaped authorization search while deliberately ignoring reference. */
export async function handlePreapprovalSearchRoute(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly headers: IncomingHttpHeaders;
}): Promise<{ readonly status: number; readonly body: unknown } | null> {
    if (args.method !== 'GET' || args.url.pathname !== '/preapproval/search') return null;
    const statusMap = {
        pending: 'pending',
        active: 'authorized',
        paused: 'paused',
        cancelled: 'cancelled'
    } as const;
    const requestedStatus = args.url.searchParams.get('status');
    const status =
        requestedStatus === null
            ? undefined
            : Object.entries(statusMap).find(
                  ([, providerStatus]) => providerStatus === requestedStatus
              )?.[0];
    const found = await args.provider.searchAuthorizations({
        ...(args.url.searchParams.has('payer_email')
            ? { payerEmail: args.url.searchParams.get('payer_email') ?? '' }
            : {}),
        ...(status === undefined ? {} : { status: status as keyof typeof statusMap })
    });
    const limit = args.url.searchParams.has('limit')
        ? Number(args.url.searchParams.get('limit'))
        : 20;
    const offset = args.url.searchParams.has('offset')
        ? Number(args.url.searchParams.get('offset'))
        : 0;
    if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(offset) || offset < 0)
        return { status: 400, body: { message: 'Invalid paging parameters' } };
    return {
        status: 200,
        body: {
            paging: { total: found.authorizations.length, limit, offset },
            results: found.authorizations.slice(offset, offset + limit).map((item) => ({
                id: item.authorizationId,
                date_created: item.createdAt,
                external_reference: item.reference,
                status: statusMap[item.status]
            }))
        }
    };
}
