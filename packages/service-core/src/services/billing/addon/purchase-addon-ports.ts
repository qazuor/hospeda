import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import type { SubscriptionPayments } from '../subscription/subscription-billing-ports';
import type { LiveAnchorReader } from './addon-orphanhood-ports';
import type { AddonPurchasesFreezePort } from './addon-purchases-freeze';

/** External readers and provider for A1; optional readers use the production defaults. */
export interface PurchaseAddonPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly addonPolicy: VerticalsForBilling['addonPolicy'];
    readonly listing: VerticalsForBilling['listing'];
    readonly liveAnchors?: LiveAnchorReader;
    readonly payments?: SubscriptionPayments;
    readonly addonPurchasesFreeze?: AddonPurchasesFreezePort;
    /**
     * HOS-1883: the facts of an owner retry over an expired payment page (its activation, or
     * its abandonment). `addon_checkout_started` is NOT sent here: A1 returns it for the route.
     */
    readonly billingFacts?: BillingFactSink;
}
