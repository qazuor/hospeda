import { planCatalogModel } from '@repo/db';
import { creditedPaymentsFromLedger, providerLinkCancellationSeen } from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { getClock } from '../../utils/clock';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../utils/payment-provider';
import { beforeCancelNotice } from '../billing-subscription/before-cancel-notice';

/**
 * Builds the real receiver ports; B4/B5/B7 add their own ports here.
 * `coverageNotices` is the process-wide registry (HOS-1533), so the notices the
 * receiver's transitions emit after their commit reach the verticals listeners.
 * `cancellationSeen` is the real annotator backed by `provider_link`
 * (AC:B4:11, HOS-1534): the handler's and S16's re-reads write
 * `cancelled_seen_at` when they see the preapproval `cancelled` and clear it
 * when a newer re-read sees it alive, which is what `canCharge` reads.
 */
export function buildMercadoPagoNoticePorts() {
    return {
        provider: getPaymentProvider(),
        clock: getClock().clock,
        beforeCancelNotice,
        planPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy,
        payments: creditedPaymentsFromLedger,
        coverageNotices: getCoverageNotices(),
        cancellationSeen: providerLinkCancellationSeen
    };
}
