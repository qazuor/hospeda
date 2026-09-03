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
import { readCommerceCheckoutOptions } from '../../../src/routes/commerce/protected/start-subscription';

/** Minimal stand-in for the Hono context — only `req.json()` is read. */
function ctxWithBody(body: unknown, { throws = false } = {}) {
    return {
        req: {
            json: () => (throws ? Promise.reject(new Error('no body')) : Promise.resolve(body))
        }
    } as never;
}

describe('readCommerceCheckoutOptions (HOS-1008 + HOS-1119)', () => {
    it('returns {} when the request carries no body at all', async () => {
        await expect(
            readCommerceCheckoutOptions(ctxWithBody(null, { throws: true }))
        ).resolves.toEqual({});
    });

    it('returns {} for an empty JSON object', async () => {
        await expect(readCommerceCheckoutOptions(ctxWithBody({}))).resolves.toEqual({});
    });

    it('forwards a valid payer email', async () => {
        await expect(
            readCommerceCheckoutOptions(ctxWithBody({ payerEmail: 'owner@local.test' }))
        ).resolves.toEqual({ requestedPayerEmail: 'owner@local.test' });
    });

    it('omits the KEY rather than setting it to undefined', async () => {
        // The caller spreads this result under `exactOptionalPropertyTypes`,
        // where `{ requestedPayerEmail: undefined }` is not assignable to an
        // optional property. `toEqual({})` alone would not catch a present
        // key holding `undefined`.
        const result = await readCommerceCheckoutOptions(ctxWithBody({}));
        expect(Object.hasOwn(result, 'requestedPayerEmail')).toBe(false);
    });

    it('rejects a present-but-malformed payer email with a 400', async () => {
        // Silently ignoring it would send the owner to a checkout that only a
        // mistyped MercadoPago account could pay.
        await expect(
            readCommerceCheckoutOptions(ctxWithBody({ payerEmail: 'no-arroba' }))
        ).rejects.toBeInstanceOf(HTTPException);
    });

    // ── HOS-1119: the picked tier travels on the same body ──────────────────

    it('forwards a valid plan slug', async () => {
        await expect(
            readCommerceCheckoutOptions(ctxWithBody({ planSlug: 'gastronomy-pro' }))
        ).resolves.toEqual({ requestedPlanSlug: 'gastronomy-pro' });
    });

    it('forwards both fields together', async () => {
        await expect(
            readCommerceCheckoutOptions(
                ctxWithBody({ payerEmail: 'owner@local.test', planSlug: 'gastronomy-pro' })
            )
        ).resolves.toEqual({
            requestedPayerEmail: 'owner@local.test',
            requestedPlanSlug: 'gastronomy-pro'
        });
    });

    it('omits the planSlug KEY rather than setting it to undefined', async () => {
        // Same `exactOptionalPropertyTypes` hazard the payerEmail case covers:
        // `toEqual({})` alone passes on a present key holding `undefined`, and
        // the handler spreads this result into an optional property.
        const result = await readCommerceCheckoutOptions(
            ctxWithBody({ payerEmail: 'owner@local.test' })
        );
        expect(Object.hasOwn(result, 'requestedPlanSlug')).toBe(false);
    });

    it('rejects a present-but-malformed plan slug with a 400', async () => {
        // Uppercase and spaces are not a shape any plan slug uses. Letting it
        // through would reach `resolveCommercePlanSlug`, which refuses it too —
        // but as a vertical-membership failure, which is a different sentence
        // from "that is not a slug".
        await expect(
            readCommerceCheckoutOptions(ctxWithBody({ planSlug: 'Gastronomy Pro' }))
        ).rejects.toBeInstanceOf(HTTPException);
    });

    it('does NOT decide whether the slug belongs to a vertical', async () => {
        // The load-bearing negative. A well-formed slug from the OTHER vertical
        // passes this reader untouched: deciding vertical membership here would
        // make this a second place that maps a vertical to a set of plans, which
        // is exactly what HOS-688 AC-35 forbids. It is refused one layer down,
        // by `resolveCommercePlanSlug`.
        await expect(
            readCommerceCheckoutOptions(ctxWithBody({ planSlug: 'experience-basico' }))
        ).resolves.toEqual({ requestedPlanSlug: 'experience-basico' });
    });
});
