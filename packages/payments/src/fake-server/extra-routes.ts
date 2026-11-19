import type { IncomingHttpHeaders } from 'node:http';
import type { FakePaymentProvider } from '../fake/fake-payment-provider';
import { handleAuthorizedPaymentsRoute } from './authorized-payments-route';
import { handleOrdersRoute } from './orders-route';
import { handlePaymentPagesRoute } from './payment-pages-route';
import { handlePaymentsSearchRoute } from './payments-search-route';
import { handlePreapprovalSearchRoute } from './preapproval-search-route';
import { handleRefundsRoute } from './refunds-route';
import { type FakeProviderAccount, handleUsersMeRoute } from './users-me-route';

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
    readonly account?: FakeProviderAccount;
    readonly paymentScreenOrigin?: string;
}): Promise<ExtraRouteResult | null> {
    return (
        handleUsersMeRoute({ ...args, account: args.account ?? 'sandbox' }) ??
        (await handlePreapprovalSearchRoute(args)) ??
        (await handleOrdersRoute(args)) ??
        (await handlePaymentPagesRoute(args)) ??
        (await handleAuthorizedPaymentsRoute(args)) ??
        (await handlePaymentsSearchRoute(args)) ??
        handleRefundsRoute(args)
    );
}
