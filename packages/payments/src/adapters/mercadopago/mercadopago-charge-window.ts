import type { MercadoPagoChargeRecord } from './mercadopago-charges';
import { readMercadoPagoChargeRecords } from './mercadopago-charges';
import { type MercadoPagoSend, providerError } from './mercadopago-http';

/**
 * Reads the selected authorized-payment window: prefer the unique record naming the payment;
 * otherwise use the uniquely newest record created at or before it. This avoids containment
 * and arbitrary-last-record selection because measured windows overlap and record order is not
 * a reliable identity signal.
 */
export async function readMercadoPagoChargeWindow(input: {
    readonly authorizationId: string;
    readonly payment: { readonly id: string; readonly createdAt: string };
    readonly send: MercadoPagoSend;
}): Promise<string | null> {
    const records = await readMercadoPagoChargeRecords(input);
    const named = records.filter((record) => String(record.payment?.id) === input.payment.id);
    if (named.length > 1)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Multiple Mercado Pago records name this payment'
        );
    const namedRecord = named[0];
    if (namedRecord !== undefined) return readExpiry({ record: namedRecord });

    const paymentCreatedAt = Date.parse(input.payment.createdAt);
    const dated = records.map((record) => {
        if (record.date_created === undefined || !Number.isFinite(Date.parse(record.date_created)))
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago charge has an invalid creation date'
            );
        return { record, createdAt: Date.parse(record.date_created) };
    });
    const eligible = dated.filter(({ createdAt }) => createdAt <= paymentCreatedAt);
    if (eligible.length === 0) return null;
    const latest = Math.max(...eligible.map(({ createdAt }) => createdAt));
    const winners = eligible.filter(({ createdAt }) => createdAt === latest);
    if (winners.length > 1)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago charge records have tied creation dates'
        );
    const winner = winners[0];
    if (!winner) return null;
    const expiresAt = readExpiry({ record: winner.record });
    if (expiresAt === null) return null;
    if (paymentCreatedAt >= Date.parse(expiresAt)) return null;
    return expiresAt;
}

function readExpiry(input: { readonly record: MercadoPagoChargeRecord }): string | null {
    const { expire_date: expiresAt } = input.record;
    if (expiresAt === undefined || expiresAt === null) return null;
    if (!Number.isFinite(Date.parse(expiresAt)))
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago charge has an invalid expiry date'
        );
    return expiresAt;
}
