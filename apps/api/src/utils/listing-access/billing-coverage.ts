/**
 * Billing's real answers to verticals as composed by `apps/api` (contract §4.1,
 * §5.2, §7.1; AC:B4:1, HOS-1532 I-1; AC:B4:4, AC:B4:5, AC:B4:6, HOS-1534). The
 * composition root is the only place that joins the two halves: billing's own
 * sources (`SUBSCRIPTION`, `ADDON`), `retentionStopped` and `canCharge` come
 * from `@repo/service-core`, the trial and BASE resolution from
 * `@repo/verticals`.
 *
 * Everything composed here is real, and so is the coverage-changed registry
 * `onCoverageChanged`/`emitCoverageChanged` composed beside it in `ports.ts`
 * (B4.2, HOS-1533, from `coverage-notices.ts`): no bootstrap answer for billing
 * reaches production (contract §6.3, G13).
 * `ficha` is the real query of verticals over the listing tables, registered here
 * by V6.13 (AC:V6:26, HOS-1483), replacing the port that failed visibly (decision X-1).
 */

import type { Clock } from '@repo/billing-verticals-contract';
import { planCatalogModel } from '@repo/db';
import {
    type BillingCoveragePorts,
    createBillingCanCharge,
    createBillingCoverage,
    createBillingRetentionStopped,
    creditedPaymentsFromLedger
} from '@repo/service-core';
import {
    type BootstrapCoverageReader,
    createPlanCatalogInverse,
    resolveTrialAndBaseSources
} from '@repo/verticals';
import { getClock } from '../clock';
import { createApiListingInverse } from '../listing-publication/listing-inverse';

/**
 * The clock of billing's real answers, read on EVERY call (`getClock()` inside
 * `now()`), never when the ports are built: the listing access ports are
 * memoized, and some callers build them before the composition root injects
 * the clock.
 */
const lazyApiClock: Clock = { now: () => getClock().clock.now() };

/**
 * Builds the ports of billing's real coverage for production.
 *
 * The clock is read on EVERY call (`getClock()` inside `now()`), never when the
 * ports are built: the listing access ports are memoized, and some callers build
 * them before the composition root injects the clock.
 *
 * @param args.reader - The trial/BASE reader (`createBootstrapCoverageReader()` in production)
 * @returns `{ ports }`
 */
export function buildBillingCoveragePorts(args: { readonly reader: BootstrapCoverageReader }): {
    readonly ports: BillingCoveragePorts;
} {
    const { reader } = args;
    return {
        ports: {
            clock: { now: () => getClock().clock.now() },
            payments: creditedPaymentsFromLedger,
            addonPolicy: createPlanCatalogInverse({ reader: planCatalogModel }).addonPolicy,
            listing: createApiListingInverse().listing,
            trialAndBase: (input) => resolveTrialAndBaseSources({ reader, input })
        }
    };
}

/**
 * Billing's real `coverage()` for production, over {@link buildBillingCoveragePorts}.
 *
 * @param args.reader - The trial/BASE reader (`createBootstrapCoverageReader()` in production)
 * @returns `{ coverage }`
 */
export function createApiBillingCoverage(args: {
    readonly reader: BootstrapCoverageReader;
}): ReturnType<typeof createBillingCoverage> {
    return createBillingCoverage({ ports: buildBillingCoveragePorts(args).ports });
}

/**
 * Billing's real `canCharge()` for production (contract §4.1; AC:B4:5, AC:B4:6),
 * the answer action 24 waits on. The 16th deadline is the version in force when
 * asked (`getCurrentBillingDeadlines()`, the factory's default).
 *
 * @returns `{ canCharge }`
 */
export function createApiBillingCanCharge(): ReturnType<typeof createBillingCanCharge> {
    return createBillingCanCharge({ ports: { clock: lazyApiClock } });
}

/**
 * Billing's real `retentionStopped()` for production (contract §4.1; AC:B4:4),
 * read by the PB5 archiving and the coverage reconciler.
 *
 * @returns `{ retentionStopped }`
 */
export function createApiBillingRetentionStopped(): ReturnType<
    typeof createBillingRetentionStopped
> {
    return createBillingRetentionStopped({ ports: { clock: lazyApiClock } });
}
