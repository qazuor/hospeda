import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { planCatalogModel } from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';
import { buildComplementPolicyPorts } from '../../utils/billing-complement-ports';
import { getClock } from '../../utils/clock';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../utils/payment-provider';

let testListing: VerticalsForBilling['listing'] | undefined;

/** Injects a listing contract response in route integration tests; reset after each test. */
export function injectAddonPurchaseListingForTests(input: {
    readonly listing?: VerticalsForBilling['listing'];
}): void {
    testListing = input.listing;
}

/** Builds the production A1/A2 ports at request time. */
export function buildAddonPurchasePorts() {
    const complements = buildComplementPolicyPorts();
    return {
        provider: getPaymentProvider(),
        clock: getClock().clock,
        addonPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).addonPolicy,
        listing: testListing ?? complements.listing,
        coverageNotices: getCoverageNotices()
    };
}
