import { providerLinkCancellationSeen } from '@repo/service-core';
import { getAnalyticsFactSink } from '../../utils/analytics/analytics-facts';
import { getClock } from '../../utils/clock';
import { buildBillingCoveragePorts } from '../../utils/listing-access/billing-coverage';
import { createBootstrapCoverageReader } from '../../utils/listing-access/bootstrap-coverage-reader';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../utils/payment-provider';
import { beforeCancelNotice } from './before-cancel-notice';

/** Build production S11 and S23/S24 ports for one self-cancellation request. */
export function buildSelfCancellationPorts() {
    const { addonPolicy, listing } = buildBillingCoveragePorts({
        reader: createBootstrapCoverageReader()
    }).ports;
    return {
        provider: getPaymentProvider(),
        clock: getClock().clock,
        beforeCancelNotice,
        coverageNotices: getCoverageNotices(),
        billingFacts: getAnalyticsFactSink(),
        complements: { addonPolicy, listing },
        orphanhood: { addonPolicy, listing },
        cancellationSeen: providerLinkCancellationSeen
    };
}
