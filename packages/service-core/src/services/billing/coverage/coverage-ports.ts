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
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
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

/**
 * Fails visibly until `ficha` exists in production. V6.13 (AC:V6:26) builds
 * the real `ficha(idDeFicha)` and replaces this port at the composition root
 * (HOS-1532 decision X-1). Safe meanwhile because no `LISTING` addon instance
 * exists until B10 sells one, and B10 lands after V6.
 */
export const unregisteredListingQuery: Pick<VerticalsForBilling, 'listing'> = {
    async listing() {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Listing query (ficha) is not registered',
            undefined,
            'LISTING_QUERY_NOT_REGISTERED'
        );
    }
};
