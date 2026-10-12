import { randomUUID } from 'node:crypto';
import { recalculateCoverage } from './coverage-recalculation';
import type { ReconcilerPorts, ReconcilerSummary } from './coverage-reconciler-types';

/** Stable monitor slug shared with the daily cron registration. */
export const DAILY_COVERAGE_RECONCILER_JOB = 'listing-coverage-reconciler';
/** Number of owner and vertical pairs read per page. */
export const RECONCILER_PAGE_SIZE = 200;

/** Reconciles missed coverage notices and stale Partner presence cache entries. */
export async function runDailyCoverageReconciler(args: {
    readonly ports: ReconcilerPorts;
}): Promise<ReconcilerSummary> {
    let pairsRead = 0;
    let ran = 0;
    let lowered = 0;
    let restored = 0;
    let partnerChecked = 0;
    let partnerInvalidated = 0;
    const failures: {
        userId: string;
        vertical?: ReconcilerSummary['failures'][number]['vertical'];
        error: unknown;
    }[] = [];
    let after: {
        readonly userId: string;
        readonly vertical: import('./publication-types').PublicationVertical;
    } | null = null;
    do {
        const page = await args.ports.population.listOwnerVerticals({
            after,
            limit: RECONCILER_PAGE_SIZE
        });
        for (const pair of page.items) {
            pairsRead += 1;
            try {
                const summary = await args.ports.reader.summarize(pair);
                const coverage = await args.ports.billing.coverage(pair);
                const limit = await args.ports.liveLimit(pair);
                const shouldRun =
                    (!coverage.covered && summary.published > 0) ||
                    (coverage.covered && limit !== null && summary.published > limit) ||
                    (coverage.covered &&
                        limit !== null &&
                        summary.published < limit &&
                        summary.unpublishedByBilling > 0) ||
                    (coverage.covered &&
                        limit !== null &&
                        summary.published < limit &&
                        summary.archivedReturnable > 0);
                if (!shouldRun) continue;
                const result = await recalculateCoverage({
                    ...args.ports,
                    ...pair,
                    correlationId: randomUUID(),
                    liveLimit: args.ports.liveLimit
                });
                ran += 1;
                lowered += result.lowered.length;
                restored += result.restored.length;
            } catch (error) {
                failures.push({ ...pair, error });
            }
        }
        after = page.next;
    } while (after !== null);
    let partnerAfter: string | null = null;
    do {
        const page = await args.ports.population.listPartnerUsers({
            after: partnerAfter,
            limit: RECONCILER_PAGE_SIZE
        });
        for (const userId of page.items) {
            partnerChecked += 1;
            try {
                const cached = await args.ports.presence.cachedKeys({ userId });
                if (cached === null) continue;
                const live = await args.ports.presence.liveKeys({ userId });
                if (!sameKeys(cached, live)) {
                    await args.ports.presence.invalidate({ userId });
                    partnerInvalidated += 1;
                }
            } catch (error) {
                failures.push({ userId, error });
            }
        }
        partnerAfter = page.next;
    } while (partnerAfter !== null);
    const complete = failures.length === 0;
    let pinged = false;
    if (complete) {
        try {
            await args.ports.monitor.ping({ job: DAILY_COVERAGE_RECONCILER_JOB });
            pinged = true;
        } catch {
            pinged = false;
        }
    }
    return {
        pairsRead,
        ran,
        lowered,
        restored,
        partnerChecked,
        partnerInvalidated,
        failures,
        complete,
        pinged
    };
}

function sameKeys(left: readonly string[], right: readonly string[]): boolean {
    return left.length === right.length && left.every((key) => right.includes(key));
}
