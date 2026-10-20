import type { MercadoPagoChargeRecord } from './mercadopago-charges';
import { providerError } from './mercadopago-http';

/** Selects the uniquely named record, or the uniquely latest record created at or before a payment. */
export function selectMercadoPagoChargeRecord(input: {
    readonly records: readonly MercadoPagoChargeRecord[];
    readonly payment: { readonly id: string; readonly createdAt: string };
}): { readonly record: MercadoPagoChargeRecord; readonly matchedBy: 'payment' | 'date' } | null {
    const named = input.records.filter((record) => String(record.payment?.id) === input.payment.id);
    if (named.length > 1)
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Multiple Mercado Pago records name this payment'
        );
    if (named[0] !== undefined) return { record: named[0], matchedBy: 'payment' };
    const paymentCreatedAt = Date.parse(input.payment.createdAt);
    const dated = input.records.map((record) => {
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
    return winner === undefined ? null : { record: winner.record, matchedBy: 'date' };
}

/** Reads and validates a charge record expiry when one is present. */
export function readMercadoPagoChargeRecordExpiry(input: {
    readonly record: MercadoPagoChargeRecord;
}): string | null {
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
