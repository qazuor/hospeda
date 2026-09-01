/**
 * @file read-confirmed-payer-email.test.ts
 * @description Covers the request-body contract HOS-1008 added to the commerce
 * owner self-checkout.
 *
 * The endpoint shipped with NO request body, and both the web client (whenever
 * `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` is off, which is production today)
 * and several existing tests still call it that way. Declaring a `requestBody`
 * on the route factory would have made every one of those bodyless POSTs parse
 * a body that is not there — which is precisely why the body is read by hand.
 *
 * So the load-bearing assertion here is the boring one: **an absent body is
 * not an error.**
 */

import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';
import { readConfirmedPayerEmail } from '../../../src/routes/commerce/protected/start-subscription';

/** Minimal stand-in for the Hono context — only `req.json()` is read. */
function ctxWithBody(body: unknown, { throws = false } = {}) {
    return {
        req: {
            json: () => (throws ? Promise.reject(new Error('no body')) : Promise.resolve(body))
        }
    } as never;
}

describe('readConfirmedPayerEmail (HOS-1008)', () => {
    it('returns {} when the request carries no body at all', async () => {
        await expect(readConfirmedPayerEmail(ctxWithBody(null, { throws: true }))).resolves.toEqual(
            {}
        );
    });

    it('returns {} for an empty JSON object', async () => {
        await expect(readConfirmedPayerEmail(ctxWithBody({}))).resolves.toEqual({});
    });

    it('forwards a valid payer email', async () => {
        await expect(
            readConfirmedPayerEmail(ctxWithBody({ payerEmail: 'owner@local.test' }))
        ).resolves.toEqual({ requestedPayerEmail: 'owner@local.test' });
    });

    it('omits the KEY rather than setting it to undefined', async () => {
        // The caller spreads this result under `exactOptionalPropertyTypes`,
        // where `{ requestedPayerEmail: undefined }` is not assignable to an
        // optional property. `toEqual({})` alone would not catch a present
        // key holding `undefined`.
        const result = await readConfirmedPayerEmail(ctxWithBody({}));
        expect(Object.hasOwn(result, 'requestedPayerEmail')).toBe(false);
    });

    it('rejects a present-but-malformed payer email with a 400', async () => {
        // Silently ignoring it would send the owner to a checkout that only a
        // mistyped MercadoPago account could pay.
        await expect(
            readConfirmedPayerEmail(ctxWithBody({ payerEmail: 'no-arroba' }))
        ).rejects.toBeInstanceOf(HTTPException);
    });
});
