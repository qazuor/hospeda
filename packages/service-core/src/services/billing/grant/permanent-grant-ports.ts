import type { Clock } from '@repo/billing-verticals-contract';
import type { PaymentProvider } from '@repo/payments';
import type { AddonOrphanhoodPorts } from '../addon/addon-orphanhood-ports.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import type { BeforeCancelNotice } from '../subscription/start-subscription.service.js';
import type { CancellationSeenAnnotator } from '../subscription/subscription-billing-ports.js';

/**
 * Dependencies used by permanent-grant acts.
 *
 * The service enforces the ACC_2 authorization inherited by the future
 * revocation service (AC:B9a:9); revocation must pass
 * `s21Cause: 'GRANT_REVOKED'` to orphanhood when it turns off covered addons.
 * Coverage notifications and provider ports handle post-commit effects.
 */
export interface PermanentGrantPorts {
    readonly clock: Clock;
    readonly coverageNotices: CoverageNotices;
    readonly orphanhood: AddonOrphanhoodPorts;
    readonly provider: PaymentProvider;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly cancellationSeen?: CancellationSeenAnnotator;
}
