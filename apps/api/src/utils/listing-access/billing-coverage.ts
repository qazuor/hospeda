/**
 * Billing's real `coverage()` as composed by `apps/api` (contract §5.2, §7.1;
 * AC:B4:1, HOS-1532 I-1). The composition root is the only place that joins the
 * two halves: billing's own sources (`SUBSCRIPTION`, `ADDON`) come from
 * `@repo/service-core`, the trial and BASE resolution from `@repo/verticals`.
 *
 * What is real today: `coverage()` itself — trial, BASE, `SUBSCRIPTION` (with
 * `cobrada` from the payment ledger) and `ADDON` (with `políticaDeAddon` from the
 * plan catalog). What is still bootstrap, composed beside it in `ports.ts`:
 * `retentionStopped` and `canCharge` (B4.3, HOS-1534) and the coverage-changed
 * registry `onCoverageChanged`/`emitCoverageChanged` (B4.2, HOS-1533).
 * `CORTESÍA` and `GRANT` answer "none" until B9a, and `ficha` fails visibly
 * until V6.13 registers it (decision X-1).
 */
import { planCatalogModel } from '@repo/db';
import {
    type BillingCoveragePorts,
    createBillingCoverage,
    creditedPaymentsFromLedger,
    unregisteredListingQuery
} from '@repo/service-core';
import {
    type BootstrapCoverageReader,
    createPlanCatalogInverse,
    resolveTrialAndBaseSources
} from '@repo/verticals';
import { getClock } from '../clock';

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
            listing: unregisteredListingQuery.listing,
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
