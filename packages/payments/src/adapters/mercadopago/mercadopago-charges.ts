import { z } from 'zod';
import { PaymentProviderError } from '../../provider/errors';
import type { ChargeListResult } from '../../provider/payment-provider';
import { type MercadoPagoSend, parseResponse, providerError } from './mercadopago-http';
import { nullAsAbsent } from './mercadopago-null-as-absent';
import { resolveUnnamedChargeRecords } from './mercadopago-unnamed-charges';

const ChargeSearchResponseSchema = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(
        z.object({
            // The reader requires this id; missing means MP may still be writing the record (HOS-1747).
            id: z.union([z.string(), z.number()]).nullish(),
            date_created: nullAsAbsent({ schema: z.string() }),
            expire_date: z.string().nullish(),
            external_reference: z.string().nullish(),
            // A null payment id is an unnamed record, exactly like an absent one.
            payment: z
                .object({ id: nullAsAbsent({ schema: z.union([z.string(), z.number()]) }) })
                .nullish()
        })
    )
});

/** A parsed Mercado Pago authorized payment record. */
export type MercadoPagoChargeRecord = z.infer<typeof ChargeSearchResponseSchema>['results'][number];

/** Delays used to reread an authorized-payment list while MP finishes writing a record. */
export const MERCADOPAGO_INCOMPLETE_RECORD_REREAD_DELAYS_MS = [500, 1000] as const;

/** Reads every paginated charge record for an authorization using the measured page size. */
export async function readMercadoPagoChargeRecords(input: {
    readonly authorizationId: string;
    readonly send: MercadoPagoSend;
    readonly sleep?: (ms: number) => Promise<void>;
}): Promise<readonly MercadoPagoChargeRecord[]> {
    for (let attempt = 0; ; attempt += 1) {
        const records = await readAllChargeRecords(input);
        const incompleteIndex = records.findIndex((record) => record.id == null);
        if (incompleteIndex === -1) return records;
        const delay = MERCADOPAGO_INCOMPLETE_RECORD_REREAD_DELAYS_MS[attempt];
        if (input.sleep && delay !== undefined) {
            await input.sleep(delay);
            continue;
        }
        throw new PaymentProviderError({
            code: 'UNAVAILABLE',
            capability: 'read',
            message: `Mercado Pago returned a charge record still being written at results.${incompleteIndex}.id`,
            incompleteRead: true
        });
    }
}

async function readAllChargeRecords(input: {
    readonly authorizationId: string;
    readonly send: MercadoPagoSend;
}): Promise<readonly MercadoPagoChargeRecord[]> {
    const records: MercadoPagoChargeRecord[] = [];
    let total = 0;
    for (let page = 0; page < 50; page += 1) {
        const offset = page * 10;
        const response = await input.send({
            capability: 'read',
            path: `/authorized_payments/search?preapproval_id=${encodeURIComponent(input.authorizationId)}&limit=10&offset=${offset}`,
            method: 'GET'
        });
        const parsed = await parseResponse(ChargeSearchResponseSchema, response, 'read');
        if (page === 0) total = parsed.paging.total;
        if (parsed.results.length === 0 && records.length < total)
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago returned an incomplete charge list'
            );
        records.push(...parsed.results);
        if (records.length >= total) break;
        if (page === 49)
            throw providerError(
                'UNAVAILABLE',
                'read',
                'Mercado Pago charge list exceeded the page limit'
            );
    }
    return records;
}

/** Lists payment identifiers from every measured charge record for an authorization. */
export async function listMercadoPagoCharges(input: {
    readonly authorizationId: string;
    readonly send: MercadoPagoSend;
    readonly sleep?: (ms: number) => Promise<void>;
}): Promise<ChargeListResult> {
    const records = await readMercadoPagoChargeRecords(input);
    const unnamed = await resolveUnnamedChargeRecords({ ...input, records });
    const withPayment = records.flatMap((record) => {
        const paymentId =
            record.payment?.id === undefined ? unnamed.get(record) : String(record.payment.id);
        return paymentId === undefined ? [] : [{ record, paymentId }];
    });
    if (
        withPayment.some(
            ({ record }) =>
                record.date_created === undefined ||
                !Number.isFinite(Date.parse(record.date_created))
        )
    )
        throw providerError(
            'UNAVAILABLE',
            'read',
            'Mercado Pago returned a charge without a valid creation date'
        );

    const ordered = withPayment
        .map((item, index) => ({ ...item, index }))
        .sort((left, right) => {
            return (
                Date.parse(left.record.date_created ?? '') -
                    Date.parse(right.record.date_created ?? '') || left.index - right.index
            );
        });
    return {
        chargeIds: ordered.map(({ paymentId }) => paymentId)
    };
}
