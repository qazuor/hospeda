/**
 * The ports of billing's real `coverage()` (contract §5.2, §7.1): what the
 * billing half needs from outside to answer `cobertura(user, vertical)`.
 *
 * This module never imports `@repo/verticals` (G14): the trial and BASE
 * resolution of verticals enters as an injected port, and the composition
 * root of `apps/api` is the only place that joins the two halves.
 */
import type {
    Clock,
    CoverageArgs,
    CoverageResponse,
    VerticalsForBilling
} from '@repo/billing-verticals-contract';
import type { SubscriptionPayments } from '../subscription/subscription-billing-ports';

/**
 * Everything the real coverage reads from outside billing's own tables.
 */
export interface BillingCoveragePorts {
    /** The injected clock: an `until` date already past is not emitted (contract §2.6). */
    readonly clock: Clock;
    /** `cobrada`: whether a subscription row has at least one credited payment (contract §2.1). */
    readonly payments: SubscriptionPayments;
    /** `políticaDeAddon`: the scope type and validity of an addon version (contract §4.1). */
    readonly addonPolicy: VerticalsForBilling['addonPolicy'];
    /** `ficha`: the vertical of the listing a `LISTING` addon targets (contract §4.1). */
    readonly listing: VerticalsForBilling['listing'];
    /**
     * The trial and BASE resolution of verticals, which runs in both
     * implementations (contract §6.3). Its `sources` are joined with billing's.
     */
    readonly trialAndBase: (args: CoverageArgs) => Promise<CoverageResponse>;
}
