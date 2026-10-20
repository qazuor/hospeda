import type { IncomingHttpHeaders } from 'node:http';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import { handleAuthorizedPaymentsRoute } from './authorized-payments-route';
import { handleOrdersRoute } from './orders-route';
import { handlePaymentsSearchRoute } from './payments-search-route';
import { handlePreapprovalSearchRoute } from './preapproval-search-route';
import { handleRefundsRoute } from './refunds-route';

/** An HTTP response handled by an additive fake provider route. */
export type ExtraRouteResult = { readonly status: number; readonly body?: unknown };

/** Dispatches routes added independently from the fake server's core routes. */
export async function handleExtraRoutes(args: {
    readonly provider: FakePaymentProvider;
    readonly method: string;
    readonly url: URL;
    readonly headers: IncomingHttpHeaders;
    readonly body: unknown;
    readonly refundAmounts: Map<string, number>;
    readonly now: Date;
}): Promise<ExtraRouteResult | null> {
    return (
        (await handlePreapprovalSearchRoute(args)) ??
        (await handleOrdersRoute(args)) ??
        (await handleAuthorizedPaymentsRoute(args)) ??
        (await handlePaymentsSearchRoute(args)) ??
        handleRefundsRoute(args)
    );
}
