import { planCatalogModel } from '@repo/db';
import { providerLinkCancellationSeen } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { getClock } from '../../utils/clock';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../utils/payment-provider';
import { beforeCancelNotice } from '../billing-subscription/before-cancel-notice';
import { buildAddonPurchasePorts } from './purchase-ports';

/** Builds A5 and provider ports for one owner withdrawal at request time. */
export function buildAddonWithdrawalPorts() {
    const purchase = buildAddonPurchasePorts();
    const { addonPolicy } = createPlanCatalogInverse({ reader: planCatalogModel });
    return {
        orphanhood: { addonPolicy, listing: purchase.listing },
        provider: getPaymentProvider(),
        clock: getClock().clock,
        coverageNotices: getCoverageNotices(),
        beforeCancelNotice,
        cancellationSeen: providerLinkCancellationSeen
    };
}
