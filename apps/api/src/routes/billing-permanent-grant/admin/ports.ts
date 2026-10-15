import { type PermanentGrantPorts, providerLinkCancellationSeen } from '@repo/service-core';
import { getClock } from '../../../utils/clock.js';
import { buildBillingCoveragePorts } from '../../../utils/listing-access/billing-coverage.js';
import { createBootstrapCoverageReader } from '../../../utils/listing-access/bootstrap-coverage-reader.js';
import { getCoverageNotices } from '../../../utils/listing-access/coverage-notices.js';
import { getPaymentProvider } from '../../../utils/payment-provider.js';
import { beforeCancelNotice } from '../../billing-subscription/before-cancel-notice.js';

/** Build production grant integrations per request so provider injection remains observable. */
export function buildPermanentGrantPorts(): PermanentGrantPorts {
    const { addonPolicy, listing } = buildBillingCoveragePorts({
        reader: createBootstrapCoverageReader()
    }).ports;
    return {
        clock: getClock().clock,
        coverageNotices: getCoverageNotices(),
        orphanhood: { addonPolicy, listing },
        provider: getPaymentProvider(),
        beforeCancelNotice,
        cancellationSeen: providerLinkCancellationSeen
    };
}
