import type { Clock } from '@repo/billing-verticals-contract';
import { type ReconciliationMarkReason, reconciliationPaidOrderModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceError } from '../../../../types';
import type { CanChargeDeadlines } from '../../coverage/can-charge';
import { openReconciliationMark } from '../open-reconciliation-mark.service';
import { reconciliationWindowSince } from './payment-window';

const logger = createLogger('billing-reconciliation-sweep');

/** Reason 23: a one-time order was paid and its instance never became active (MOT:23). */
const PAID_ORDER_REASON = 'ORDEN_PAGADA_SIN_INSTANCIA' as const satisfies ReconciliationMarkReason;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** The search window after the key: under the provider's 30 days (EX-57, RP13). */
const SEARCH_SPAN_MS = 29 * DAY_MS;

/** Ports of the paid-orders check (AC:B11:13). */
export interface PaidOrdersCheckPorts {
    /** The billing deadlines (PLAZO:18); defaults to the version in force. */
    readonly deadlines?: CanChargeDeadlines;
}

/** One instance the check could not decide on; `addonInstanceId` is null when the pass never started. */
export interface PaidOrdersCheckFailure {
    readonly addonInstanceId: string | null;
    readonly message: string;
}

/** What one run of the paid-orders check did. */
export interface PaidOrdersCheckSummary {
    /** Instances examined. */
    readonly examined: number;
    /** Reason-23 marks opened. */
    readonly marked: number;
    readonly failures: readonly PaidOrdersCheckFailure[];
}

function errorMessage(error: unknown): string {
    if (error instanceof ServiceError && error.reason) return `${error.reason}: ${error.message}`;
    return error instanceof Error ? error.message : String(error);
}

/**
 * The paid-orders check of the daily sweep (AC:B11:13): every `ABANDONED`
 * one-time instance with an order key inside the PLAZO:18 window has its order
 * re-read by id: by its stored order id, or, without one, by the ids a search by
 * the request identifier yields (EX-57). The search is never the decision
 * (INV:D6, G17): an order read by id with an approved payment opens reason 23
 * on the instance, with no payment hung (none exists for that order). It never
 * creates, re-sends, charges or refunds anything at the provider and writes no
 * instance, payment or refund. The population at the cut is zero until B10
 * writes order keys; the test seeds it.
 *
 * @param input.correlationId - The sweep's correlation id
 * @param input.pageSize - Instances per page
 * @param ports - The check's ports plus the sweep's provider and clock
 * @returns What the pass did
 */
export async function runPaidOrdersCheck(
    input: { readonly correlationId: string; readonly pageSize: number },
    ports: PaidOrdersCheckPorts & {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
    }
): Promise<PaidOrdersCheckSummary> {
    const failures: PaidOrdersCheckFailure[] = [];
    let examined = 0;
    let marked = 0;
    let since: Date;
    try {
        since = await reconciliationWindowSince({ clock: ports.clock, deadlines: ports.deadlines });
    } catch (error) {
        const message = errorMessage(error);
        logger.error({ error: message }, 'Paid orders check could not read its window');
        return { examined, marked, failures: [{ addonInstanceId: null, message }] };
    }

    let afterInstanceId: string | undefined;
    for (;;) {
        const page = await reconciliationPaidOrderModel.listAbandonedOneTimeOrdersInWindowPage({
            since,
            afterInstanceId,
            limit: input.pageSize
        });
        for (const { instance, orderKeyCreatedAt } of page) {
            try {
                examined++;
                const orderIds = await orderIdsOf({ instance, orderKeyCreatedAt }, ports);
                for (const orderId of orderIds) {
                    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                    actStartInstant({ act });
                    const read = await ports.provider.readOrder({ orderId });
                    const { snapshot } = assertFreshForAct({ read, act });
                    if (!snapshot.hasApprovedPayment) continue;
                    await openReconciliationMark({
                        subject: { kind: 'ADDON_INSTANCE', addonInstanceId: instance.id },
                        reason: 'ORDEN_PAGADA_SIN_INSTANCIA' satisfies typeof PAID_ORDER_REASON,
                        actor: { type: 'job' },
                        correlationId: input.correlationId
                    });
                    marked++;
                    break;
                }
            } catch (error) {
                const message = errorMessage(error);
                failures.push({ addonInstanceId: instance.id, message });
                logger.error(
                    { addonInstanceId: instance.id, error: message },
                    'Paid order check failed'
                );
            }
        }
        if (page.length < input.pageSize) break;
        afterInstanceId = page.at(-1)?.instance.id;
    }
    return { examined, marked, failures };
}

/**
 * The order ids to re-read: the stored one, or the ones a search by the request
 * identifier yields with exactly that reference, from an hour before the key to
 * 29 days after (EX-57, RP13).
 */
async function orderIdsOf(
    input: {
        readonly instance: {
            readonly providerOrderId: string | null;
            readonly orderRequestId: string | null;
        };
        readonly orderKeyCreatedAt: Date;
    },
    ports: { readonly provider: PaymentProvider }
): Promise<readonly string[]> {
    const { providerOrderId, orderRequestId } = input.instance;
    if (providerOrderId !== null) return [providerOrderId];
    if (orderRequestId === null) throw new Error('The order key has no request identifier');
    const createdFrom = input.orderKeyCreatedAt.getTime() - HOUR_MS;
    const found = await ports.provider.searchOrders({
        reference: orderRequestId,
        createdFrom: new Date(createdFrom).toISOString(),
        createdTo: new Date(createdFrom + SEARCH_SPAN_MS).toISOString()
    });
    return found.orders
        .filter((order) => order.reference === orderRequestId)
        .map((order) => order.orderId);
}
