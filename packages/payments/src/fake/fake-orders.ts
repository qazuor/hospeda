import type { Clock } from '@repo/billing-verticals-contract';
import type {
    OrderSearchInput,
    OrderSearchResult,
    OrderSnapshot
} from '../provider/payment-provider';
import type { FakeLedger } from './fake-ledger';
import { notFound, rejected } from './fake-support';

/** RP13 (EX-57): an order search spans at most 30 days of creation. */
export const FAKE_ORDER_SEARCH_MAX_MS = 30 * 24 * 60 * 60_000;

/**
 * The fake's one-time orders (TEST:B11:12 support). Orders are placed only by
 * the test-side handle `placeOrder` (the customer paying an order); no
 * capability creates one. Read by id; searched by exact reference inside a
 * bounded creation range (RP13, a rule: it never switches off).
 */
export class FakeOrders {
    private readonly orders = new Map<string, OrderSnapshot>();

    constructor(private readonly args: { readonly ledger: FakeLedger; readonly clock: Clock }) {}

    /** Test side: an order the customer placed, paid or not. */
    place(input: {
        readonly reference: string;
        readonly createdAt?: string;
        readonly paid: boolean;
    }): { readonly orderId: string } {
        const orderId = this.args.ledger.nextId({ prefix: 'order' });
        this.orders.set(orderId, {
            orderId,
            reference: input.reference,
            createdAt: input.createdAt ?? this.args.clock.now().toISOString(),
            hasApprovedPayment: input.paid
        });
        return { orderId };
    }

    /** One order by id, or `NOT_FOUND`. */
    read(input: { readonly orderId: string }): OrderSnapshot {
        const order = this.orders.get(input.orderId);
        if (!order) throw notFound({ capability: 'read', id: input.orderId });
        return structuredClone(order);
    }

    /**
     * Ids of the orders with exactly this reference created inside the range.
     * RP13: the range must be ordered and span at most 30 days, or `REJECTED`.
     */
    search(input: OrderSearchInput): OrderSearchResult {
        const from = Date.parse(input.createdFrom);
        const to = Date.parse(input.createdTo);
        if (to < from)
            throw rejected({
                capability: 'read',
                reason: 'the search range ends before it starts'
            });
        if (to - from > FAKE_ORDER_SEARCH_MAX_MS)
            throw rejected({ capability: 'read', reason: 'the search range exceeds 30 days' });
        const orders = [...this.orders.values()]
            .filter((order) => {
                const created = Date.parse(order.createdAt);
                return order.reference === input.reference && created >= from && created <= to;
            })
            .map(({ orderId, reference, createdAt }) => ({ orderId, reference, createdAt }));
        return { orders };
    }
}
