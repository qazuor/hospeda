import {
    readMercadoPagoChargeRecordExpiry,
    selectMercadoPagoChargeRecord
} from './mercadopago-charge-record-match';
import { readMercadoPagoChargeRecords } from './mercadopago-charges';
import type { MercadoPagoSend } from './mercadopago-http';

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
    const paymentCreatedAt = Date.parse(input.payment.createdAt);
    const selected = selectMercadoPagoChargeRecord({ records, payment: input.payment });
    if (selected === null) return null;
    if (selected.matchedBy === 'payment')
        return readMercadoPagoChargeRecordExpiry({ record: selected.record });
    const expiresAt = readMercadoPagoChargeRecordExpiry({ record: selected.record });
    if (expiresAt === null) return null;
    if (paymentCreatedAt >= Date.parse(expiresAt)) return null;
    return expiresAt;
}
