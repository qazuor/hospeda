import { planCatalogModel } from '@repo/db';
import {
    createPaymentReconciliationMarkPayments,
    createProviderNoticeMirrorDelegates,
    creditedPaymentsFromLedger,
    providerLinkCancellationSeen
} from '@repo/service-core';
import { createPlanCatalogInverse } from '@repo/verticals';
import { getClock } from '../../utils/clock';
import { getCoverageNotices } from '../../utils/listing-access/coverage-notices';
import { getPaymentProvider } from '../../utils/payment-provider';
import { beforeCancelNotice } from '../billing-subscription/before-cancel-notice';
import { touristVipInheritance } from '../billing-subscription/tourist-vip-inheritance';

/**
 * Builds the real receiver ports; B4/B5/B7 add their own ports here.
 * `coverageNotices` is the process-wide registry (HOS-1533), so the notices the
 * receiver's transitions emit after their commit reach the verticals listeners.
 * `touristVipInheritance` feeds S7's Tourist VIP clause (AC:B7:31).
 * `cancellationSeen` is the real annotator backed by `provider_link`
 * (AC:B4:11, HOS-1534): the handler's and S16's re-reads write
 * `cancelled_seen_at` when they see the preapproval `cancelled` and clear it
 * when a newer re-read sees it alive, which is what `canCharge` reads.
 *
 * HOS-1676 (AC:1676:6) registers, with the SAME provider, clock, notice and
 * listeners as every other port:
 * - `markPayments`: the ledger port the sweep cron also uses
 *   (`createPaymentReconciliationMarkPayments`), so a mark the receiver opens with
 *   a payment (the unknown handler's `PAGO_TARDIO_RECHAZADO`, a divergence of the
 *   closed-row delegate, our cancellation retry) hangs it instead of failing as
 *   "not registered". S5/S7, the credit and the receipt tombstone already
 *   defaulted to this same port, so their conduct does not change.
 * - `delegates`: `createProviderNoticeMirrorDelegates`, which registers the grid
 *   cells `CANCELLED_ON_GRACE` (branch 5, HOS-1561 H7) and `PROVIDER_PAUSE_IS_ARREARS` (B7.3, HOS-1559),
 *   `LIVE_PREAPPROVAL_ON_CLOSED_ROW` (H-7). The unknown preapproval is not a grid
 *   cell: the receiver itself hands it to `handleUnknownAuthorization`.
 *
 * NOT registered (H-1, H-14): `RESUME_MIRROR`, `CANCELLED_ON_PAUSE` and
 * `CANCELLED_WHILE_PENDING` keep throwing `MIRROR_PAIR_NOT_REGISTERED`; there is no `successionCloser`: S18 does not exist yet (B8b), so
 * the receiver and the delegates keep `unimplementedSuccessionCloser`.
 */
export function buildMercadoPagoNoticePorts() {
    const provider = getPaymentProvider();
    const clock = getClock().clock;
    const coverageNotices = getCoverageNotices();
    const markPayments = createPaymentReconciliationMarkPayments(clock);
    const planPolicy = createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy;
    return {
        provider,
        clock,
        beforeCancelNotice,
        planPolicy,
        payments: creditedPaymentsFromLedger,
        coverageNotices,
        // AC:B7:31: S7, reached through the charge notice, cancels a paid Tourist VIP the plan grants again.
        touristVipInheritance,
        cancellationSeen: providerLinkCancellationSeen,
        markPayments,
        delegates: createProviderNoticeMirrorDelegates({
            provider,
            clock,
            beforeCancelNotice,
            planPolicy,
            payments: creditedPaymentsFromLedger,
            coverageNotices,
            markPayments
        })
    };
}
