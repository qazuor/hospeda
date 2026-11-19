import type { Clock } from '@repo/billing-verticals-contract';
import { eq, getDb, payments, reconciliationPagePaymentModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PaymentProvider } from '@repo/payments';
import { ServiceError } from '../../../../types';
import { confirmOneTimePagePayment } from '../../addon/addon-instance-a2-one-time-page';
import { chargeNamedByMark } from '../../addon/one-time-page-charge-marks';
import type { CanChargeDeadlines } from '../../coverage/can-charge';
import type { CoverageNotices } from '../../payment/payment-ports';
import type { ComplementPolicyPorts } from '../../subscription/complement-ports';
import { reconciliationWindowSince } from './payment-window';

const logger = createLogger('billing-reconciliation-sweep');

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** The search window after the key, kept under the provider's 30-day search range (EX-57). */
const SEARCH_SPAN_MS = 29 * DAY_MS;

/** Ports of the page-payments check (HOS-2179 §5.10). */
export interface PagePaymentsCheckPorts {
    /** Called after each processed item so the owning sweep can renew its lease. */
    readonly heartbeat?: () => Promise<void>;
    /** The billing deadlines (PLAZO:18); defaults to the version in force. */
    readonly deadlines?: CanChargeDeadlines;
    /** The anchored addon policy and listing readers A2 runs with. */
    readonly complements: ComplementPolicyPorts;
    readonly coverageNotices?: CoverageNotices;
}

/** One instance the check could not decide on; `addonInstanceId` is null when the pass never started. */
export interface PagePaymentsCheckFailure {
    readonly addonInstanceId: string | null;
    readonly message: string;
}

/** What one run of the page-payments check did. */
export interface PagePaymentsCheckSummary {
    /** Purchases examined. */
    readonly examined: number;
    /** `COBRO_DUPLICADO` opened or accumulated: a second payment on the same page (§5.8). */
    readonly duplicateMarked: number;
    /** Mark 23 opened or accumulated: money on a purchase that closed with no payment (§5.9). */
    readonly lateMarked: number;
    /** `DIVERGENCIA_DE_MONTO` opened for a payment of another amount A2 had not seen (AC-8). */
    readonly divergenceMarked: number;
    readonly failures: readonly PagePaymentsCheckFailure[];
}

function errorMessage(error: unknown): string {
    if (error instanceof ServiceError && error.reason) return `${error.reason}: ${error.message}`;
    return error instanceof Error ? error.message : String(error);
}

/**
 * The page-payments check of the daily sweep (HOS-2179 §5.10), next to the paid-orders check it
 * replaces in T-7. Every one-time page purchase bought inside the PLAZO:18 window that no longer
 * waits (A3 owns a waiting one) has its payments searched by its reference, and each id
 * goes through A2, which re-reads it by id and decides (INV:D6, G17): the search never decides.
 * A2 opens `COBRO_DUPLICADO` for a second payment beside the one the purchase holds (paid twice)
 * and mark 23 for money on a purchase that closed with no payment (paid without a live instance).
 *
 * A payment a mark already names (open or lifted, of any of the three reasons) is skipped before
 * any read, so the same money never raises two marks: one that carries `DIVERGENCIA_DE_MONTO` is
 * never also a duplicate or a late payment, and a person's lift is never undone by the next run.
 * The payment the purchase holds is skipped too. It never creates, charges or refunds anything at
 * the provider and writes no instance or payment.
 *
 * @param input.correlationId - The sweep's correlation id, carried by every mark it opens
 * @param input.pageSize - Purchases per page
 * @param ports - The check's ports plus the sweep's provider and clock
 * @returns What the pass did
 */
export async function runPagePaymentsCheck(
    input: { readonly correlationId: string; readonly pageSize: number },
    ports: PagePaymentsCheckPorts & {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
    }
): Promise<PagePaymentsCheckSummary> {
    const failures: PagePaymentsCheckFailure[] = [];
    const tally = { examined: 0, duplicateMarked: 0, lateMarked: 0, divergenceMarked: 0 };
    let since: Date;
    try {
        since = await reconciliationWindowSince({ clock: ports.clock, deadlines: ports.deadlines });
    } catch (error) {
        const message = errorMessage(error);
        logger.error({ error: message }, 'Page payments check could not read its window');
        return { ...tally, failures: [{ addonInstanceId: null, message }] };
    }

    let afterInstanceId: string | undefined;
    for (;;) {
        const page =
            await reconciliationPagePaymentModel.listSettledOneTimePagePurchasesInWindowPage({
                since,
                afterInstanceId,
                limit: input.pageSize
            });
        for (const { instance } of page) {
            // Per item, before any provider call: a lost lease stops the pass here.
            await ports.heartbeat?.();
            tally.examined++;
            try {
                const undecided = await checkPurchase(
                    { instance, correlationId: input.correlationId, tally },
                    ports
                );
                if (undecided.length > 0)
                    failures.push({
                        addonInstanceId: instance.id,
                        message: `undecided charges: ${undecided.join(', ')}`
                    });
            } catch (error) {
                const message = errorMessage(error);
                failures.push({ addonInstanceId: instance.id, message });
                logger.error(
                    { addonInstanceId: instance.id, error: message },
                    'Page payment check failed'
                );
            }
        }
        await ports.heartbeat?.();
        if (page.length < input.pageSize) break;
        afterInstanceId = page.at(-1)?.instance.id;
    }
    return { ...tally, failures };
}

/**
 * Searches one purchase's payments by its reference and hands each new id to A2.
 *
 * @returns The charge ids A2 could not decide this run
 */
async function checkPurchase(
    input: {
        readonly instance: {
            readonly id: string;
            readonly orderRequestId: string | null;
            readonly createdAt: Date;
        };
        readonly correlationId: string;
        readonly tally: { duplicateMarked: number; lateMarked: number; divergenceMarked: number };
    },
    ports: PagePaymentsCheckPorts & { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<readonly string[]> {
    const { instance } = input;
    if (instance.orderRequestId === null) throw new Error('The page key has no reference');
    // From an hour before the purchase (provider clock skew, as A3 does) to now, capped.
    const createdFrom = instance.createdAt.getTime() - HOUR_MS;
    const createdTo = Math.min(ports.clock.now().getTime(), createdFrom + SEARCH_SPAN_MS);
    const { chargeIds } = await ports.provider.searchCharges({
        reference: instance.orderRequestId,
        createdFrom: new Date(createdFrom).toISOString(),
        createdTo: new Date(createdTo).toISOString()
    });
    const held = new Set(
        (
            await getDb()
                .select({ providerFactId: payments.providerFactId })
                .from(payments)
                .where(eq(payments.addonInstanceId, instance.id))
        ).map(({ providerFactId }) => providerFactId)
    );
    const undecided: string[] = [];
    for (const chargeId of chargeIds) {
        if (held.has(chargeId)) continue;
        if (
            await chargeNamedByMark({
                instanceId: instance.id,
                chargeId
            })
        )
            continue;
        const result = await confirmOneTimePagePayment(
            {
                instanceId: instance.id,
                chargeId,
                trigger: { actor: 'job', correlationId: input.correlationId }
            },
            {
                provider: ports.provider,
                clock: ports.clock,
                addonPolicy: ports.complements.addonPolicy,
                listing: ports.complements.listing,
                ...(ports.coverageNotices === undefined
                    ? {}
                    : { coverageNotices: ports.coverageNotices })
            }
        );
        if (result.outcome === 'DUPLICATE_PAYMENT') input.tally.duplicateMarked++;
        else if (result.outcome === 'LATE_PAYMENT') input.tally.lateMarked++;
        else if (result.outcome === 'AMOUNT_MISMATCH') input.tally.divergenceMarked++;
        else if (result.outcome === 'UNKNOWN' || result.outcome === 'NOT_APPLICABLE')
            undecided.push(chargeId);
    }
    return undecided;
}
