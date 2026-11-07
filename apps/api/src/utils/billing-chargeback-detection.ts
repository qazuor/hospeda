import {
    type ChargebackDetection,
    createChargebackDetection,
    createChargebackSuspension,
    providerLinkCancellationSeen,
    type ReconciliationMarkPayments
} from '@repo/service-core';
import { beforeCancelNotice } from '../routes/billing-subscription/before-cancel-notice';
import { getClock } from './clock';
import { buildBillingCoveragePorts } from './listing-access/billing-coverage';
import { createBootstrapCoverageReader } from './listing-access/bootstrap-coverage-reader';
import { getCoverageNotices } from './listing-access/coverage-notices';
import { getPaymentProvider } from './payment-provider';

/**
 * The ONE place where `apps/api` assembles the complete chargeback detection
 * (AC:B7:10, AC:B7:33, AC:B7:27). Every production root that can read
 * `charged_back` — the provider notice receiver, the credited-payments check,
 * the grace-expiry settlement of a charged period, and the refund confirmation —
 * passes the object this function returns in its `chargebacks` port, always with
 * the same S14 port and the same S6 charger.
 *
 * S6 runs with the production provider, clock, before-cancel notice, coverage
 * registry, addon orphanhood and complement policy, plus the cancellation-seen
 * annotator of `provider_link`. There is no `billingFacts`: the chargeback emits
 * no analytics fact (HOS-1878).
 *
 * The `CANCEL_SCHEDULED` branch (S12 by its second event, AC:B8a:7) is added by
 * HOS-1633 right here, in the same detection; it must not be assembled anywhere else.
 *
 * @param input.markPayments - The reconciliation mark port the root already builds
 * @returns The complete chargeback detection of the API
 */
export function buildChargebackDetection(input: {
    readonly markPayments: ReconciliationMarkPayments;
}): ChargebackDetection {
    const { addonPolicy, listing } = buildBillingCoveragePorts({
        reader: createBootstrapCoverageReader()
    }).ports;
    return createChargebackDetection({
        markPayments: input.markPayments,
        suspension: createChargebackSuspension({
            provider: getPaymentProvider(),
            clock: getClock().clock,
            beforeCancelNotice,
            coverageNotices: getCoverageNotices(),
            orphanhood: { addonPolicy, listing },
            complements: { addonPolicy, listing },
            cancellationSeen: providerLinkCancellationSeen
        })
    });
}
