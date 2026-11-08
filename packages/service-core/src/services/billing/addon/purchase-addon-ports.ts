import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import type { SubscriptionPayments } from '../subscription/subscription-billing-ports';
import type { LiveAnchorReader } from './addon-orphanhood-ports';

/** External readers and provider for A1; optional readers use the production defaults. */
export interface PurchaseAddonPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly addonPolicy: VerticalsForBilling['addonPolicy'];
    readonly listing: VerticalsForBilling['listing'];
    readonly liveAnchors?: LiveAnchorReader;
    readonly payments?: SubscriptionPayments;
}
