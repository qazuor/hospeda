import { z } from 'zod';
import type { OrderSearchResult, OrderSnapshot } from '../../provider/payment-provider';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';
import { nullAsAbsent } from './mercadopago-null-as-absent';

// A null creation date reads as absent, so `createdAt` can fall back or fail closed.
const OrderSchema = z.object({
    id: z.union([z.string(), z.number()]).transform(String),
    status: z.string(),
    external_reference: z.string().nullish(),
    created_date: nullAsAbsent({ schema: z.string() }),
    date_created: nullAsAbsent({ schema: z.string() })
});
const OrderSearchSchema = z.object({
    data: z.array(
        z.object({
            id: z.union([z.string(), z.number()]).transform(String),
            external_reference: z.string().nullish(),
            created_date: nullAsAbsent({ schema: z.string() }),
            date_created: nullAsAbsent({ schema: z.string() })
        })
    ),
    paging: z.object({ total: z.number().int().nonnegative() })
});

function hasApprovedPayment(status: string): boolean {
    if (status === 'processed' || status === 'partially_refunded') return true;
    if (
        ['failed', 'refunded', 'canceled', 'expired', 'created', 'action_required'].includes(status)
    )
        return false;
    throw providerError('UNAVAILABLE', 'read', 'Mercado Pago returned an unsupported order status');
}

function createdAt(order: {
    readonly created_date?: string;
    readonly date_created?: string;
}): string {
    const value = order.created_date ?? order.date_created;
    if (value === undefined)
        throw providerError('UNAVAILABLE', 'read', 'Mercado Pago order has no creation date');
    return value;
}

/** Reads an order by id and stamps the provider snapshot with the injected clock. */
export async function readMercadoPagoOrder(args: {
    readonly orderId: string;
    readonly send: MercadoPagoSend;
}) {
    const response = await args.send({
        capability: 'read',
        path: `/v1/orders/${encodeURIComponent(args.orderId)}`,
        method: 'GET'
    });
    const parsed = await parseResponse(OrderSchema, response, 'read');
    const snapshot: OrderSnapshot = {
        orderId: parsed.id,
        reference: parsed.external_reference ?? '',
        createdAt: createdAt(parsed),
        hasApprovedPayment: hasApprovedPayment(parsed.status)
    };
    return snapshot;
}

/** Searches exact order references inside the provider's bounded creation window. */
export async function searchMercadoPagoOrders(args: {
    readonly input: {
        readonly createdFrom: string;
        readonly createdTo: string;
        readonly reference: string;
    };
    readonly send: MercadoPagoSend;
}): Promise<OrderSearchResult> {
    const params = new URLSearchParams({
        begin_date: args.input.createdFrom,
        end_date: args.input.createdTo,
        external_reference: args.input.reference
    });
    const response = await args.send({
        capability: 'read',
        path: `/v1/orders?${params}`,
        method: 'GET'
    });
    const parsed = await parseResponse(OrderSearchSchema, response, 'read');
    if (parsed.paging.total > parsed.data.length)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago returned an incomplete order search'
        );
    return {
        orders: parsed.data.map((order) => ({
            orderId: order.id,
            reference: order.external_reference ?? '',
            createdAt: createdAt(order)
        }))
    };
}
