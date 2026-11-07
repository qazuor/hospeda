import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import type { CancellationSeenAnnotator } from '../subscription/subscription-billing-ports.js';

/**
 * Dependencies used by permanent-grant acts.
 *
 * The services enforce ACC_2 authorization, including `revokePermanentGrant`
 * in `permanent-grant-revoke.ts` (AC:B9a:9). Revocation passes
 * `s21Cause: 'GRANT_REVOKED'` to A5 when it turns off covered addons.
 * Coverage notifications and provider ports handle post-commit effects.
 */
export interface PermanentGrantPorts {
    /** políticaDePlan de verticales: valida el piso; billing no resuelve la vigente. */
    readonly planPolicy: VerticalsForBilling['planPolicy'];
    readonly clock: Clock;
    readonly coverageNotices: CoverageNotices;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly provider: PaymentProvider;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}
