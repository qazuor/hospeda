import {
    readMercadoPagoChargeRecordExpiry,
    selectMercadoPagoChargeRecord
} from './mercadopago-charge-record-match';
import type { MercadoPagoChargeRecord } from './mercadopago-charges';
import { type MercadoPagoSend, providerError } from './mercadopago-http';
import { readMercadoPagoAuthorizationLink } from './mercadopago-payment-link';
import { searchMercadoPagoPaymentsByReference } from './mercadopago-payment-search';

/** Resolves records whose failed cycle does not name its payment; RC-5 counts charge records. */
export async function resolveUnnamedChargeRecords(input: {
    readonly authorizationId: string;
    readonly records: readonly MercadoPagoChargeRecord[];
    readonly send: MercadoPagoSend;
}): Promise<ReadonlyMap<MercadoPagoChargeRecord, string>> {
    const unnamed = input.records.filter((record) => record.payment?.id === undefined);
    const references = [
        ...new Set(
            unnamed.flatMap((record) => {
                const reference = record.external_reference;
                return typeof reference === 'string' && reference.length > 0 ? [reference] : [];
            })
        )
    ];
    const resolved = new Map<MercadoPagoChargeRecord, string>();
    const byRecord = new Map<MercadoPagoChargeRecord, string[]>();
    const namedIds = new Set(
        input.records.flatMap((record) =>
            record.payment?.id === undefined ? [] : [String(record.payment.id)]
        )
    );
    for (const reference of references) {
        const payments = await searchMercadoPagoPaymentsByReference({
            reference,
            send: input.send
        });
        const seen = new Set<string>();
        for (const payment of payments) {
            if (seen.has(payment.id)) continue;
            seen.add(payment.id);
            if (namedIds.has(payment.id)) continue;
            if (readMercadoPagoAuthorizationLink(payment) !== input.authorizationId) continue;
            const selected = selectMercadoPagoChargeRecord({
                records: input.records,
                payment: { id: payment.id, createdAt: payment.date_created }
            });
            if (selected === null || selected.record.payment?.id !== undefined) continue;
            const recordReference = selected.record.external_reference;
            if (typeof recordReference !== 'string' || recordReference.length === 0) continue;
            const expiresAt = readMercadoPagoChargeRecordExpiry({ record: selected.record });
            if (expiresAt !== null && Date.parse(payment.date_created) >= Date.parse(expiresAt))
                continue;
            const candidates = byRecord.get(selected.record) ?? [];
            candidates.push(payment.id);
            byRecord.set(selected.record, candidates);
        }
    }
    for (const [record, candidates] of byRecord) {
        if (candidates.length > 1)
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Multiple Mercado Pago payments match one charge record'
            );
        if (candidates[0] !== undefined) resolved.set(record, candidates[0]);
    }
    return resolved;
}
