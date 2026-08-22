/**
 * MercadoPago webhook metadata: the VALUE type of a numeric metadata field is
 * as load-bearing as its key spelling.
 *
 * ## Why this file exists
 *
 * HOS-743 fixed the metadata *keys* (`normalizeMercadoPagoMetadata` translates
 * MercadoPago's snake_case wire spelling once, at the border). It does not
 * touch *values* — and MercadoPago stringifies numeric metadata values on the
 * round-trip, so `targetTransactionAmountMajor: 12345` can come back as
 * `'12345'`.
 *
 * `extractPlanChangeUpgradeMetadata` is the plan-change dispatch discriminator:
 * returning `null` there is silent, exactly like the add-on case. The customer
 * pays the prorated upgrade delta, the webhook falls through to the next
 * branch, and the plan change is never committed. A strict `typeof === 'number'`
 * guard on an amount MercadoPago may hand back as a string is therefore a paid
 * upgrade that never lands.
 *
 * The mirror hazard is over-permissiveness: a guard that coerces anything would
 * forward `NaN` to `paymentAdapter.subscriptions.update` as the new recurring
 * amount. The guard has to stay fail-closed, so every non-numeric shape below
 * must still return `null`.
 *
 * @module test/webhooks/mercadopago-metadata-amount-type
 */

import { describe, expect, it } from 'vitest';
import { extractPlanChangeUpgradeMetadata } from '../../src/routes/webhooks/mercadopago/utils';

/**
 * The four string fields `initiatePaidPlanUpgrade` stamps alongside the amount.
 * Held constant so each case below varies ONLY the amount.
 */
const BASE_METADATA = {
    planChangeUpgradeId: 'sub-uuid-1',
    oldPlanId: 'plan-basic',
    newPlanId: 'plan-pro',
    newPriceId: 'price-uuid-1'
} as const;

/**
 * The expected extraction result for {@link BASE_METADATA} at 12345 ARS.
 * Asserted with `toEqual` (exact shape) rather than `objectContaining`, which
 * is blind to a field that goes missing.
 */
const EXPECTED = {
    planChangeUpgradeId: 'sub-uuid-1',
    oldPlanId: 'plan-basic',
    newPlanId: 'plan-pro',
    newPriceId: 'price-uuid-1',
    targetTransactionAmountMajor: 12345
};

describe('extractPlanChangeUpgradeMetadata — amount value type', () => {
    describe('accepts a real amount in either carrier shape', () => {
        it('accepts a plain number (the polling fallback / synthetic payload)', () => {
            expect(
                extractPlanChangeUpgradeMetadata({
                    ...BASE_METADATA,
                    targetTransactionAmountMajor: 12345
                })
            ).toEqual(EXPECTED);
        });

        it('accepts a numeric STRING (what MercadoPago hands back)', () => {
            // The defect: a `typeof !== 'number'` guard returns null here, and
            // the paid plan change is dropped without an error or a log.
            expect(
                extractPlanChangeUpgradeMetadata({
                    ...BASE_METADATA,
                    targetTransactionAmountMajor: '12345'
                })
            ).toEqual(EXPECTED);
        });

        it('accepts a numeric string in the snake_case wire spelling', () => {
            // Both hazards at once: the key MercadoPago rewrote AND the value
            // it stringified. This is the shape a real payment.updated carries.
            expect(
                extractPlanChangeUpgradeMetadata({
                    plan_change_upgrade_id: 'sub-uuid-1',
                    old_plan_id: 'plan-basic',
                    new_plan_id: 'plan-pro',
                    new_price_id: 'price-uuid-1',
                    target_transaction_amount_major: '12345',
                    delta_centavos: '500'
                })
            ).toEqual(EXPECTED);
        });

        it('accepts a fractional amount in both shapes and returns a number', () => {
            expect(
                extractPlanChangeUpgradeMetadata({
                    ...BASE_METADATA,
                    targetTransactionAmountMajor: 8999.99
                })?.targetTransactionAmountMajor
            ).toBe(8999.99);

            expect(
                extractPlanChangeUpgradeMetadata({
                    ...BASE_METADATA,
                    targetTransactionAmountMajor: '8999.99'
                })?.targetTransactionAmountMajor
            ).toBe(8999.99);
        });

        it('tolerates the surrounding whitespace a wire value may carry', () => {
            expect(
                extractPlanChangeUpgradeMetadata({
                    ...BASE_METADATA,
                    targetTransactionAmountMajor: ' 12345 '
                })
            ).toEqual(EXPECTED);
        });
    });

    describe('stays fail-closed: nothing that is not an amount may pass', () => {
        // Each entry is [label, value]. A tuple list rather than a bare value
        // list so a failure names the shape that leaked through.
        const REJECTED: ReadonlyArray<readonly [string, unknown]> = [
            ['empty string', ''],
            ['whitespace-only string', '  '],
            ['non-numeric string', 'abc'],
            // parseFloat('12abc') === 12 — a trailing-garbage string must NOT
            // be silently truncated into a plausible amount.
            ['trailing-garbage string', '12abc'],
            ['leading-garbage string', 'abc12'],
            ['NaN', Number.NaN],
            ['the string "NaN"', 'NaN'],
            ['Infinity', Number.POSITIVE_INFINITY],
            ['-Infinity', Number.NEGATIVE_INFINITY],
            ['the string "Infinity"', 'Infinity'],
            // Exponent notation is never what a JSON round-trip of an ARS plan
            // price produces, so accepting it would only widen the surface.
            ['exponent-notation string', '1e5'],
            ['hex string', '0x10'],
            ['null', null],
            ['undefined', undefined],
            ['missing key', Symbol.for('omit')],
            ['boolean true', true],
            ['boolean false', false],
            ['an object', { amount: 12345 }],
            ['an array', [12345]]
        ];

        for (const [label, value] of REJECTED) {
            it(`returns null for ${label}`, () => {
                const metadata: Record<string, unknown> =
                    value === Symbol.for('omit')
                        ? { ...BASE_METADATA }
                        : { ...BASE_METADATA, targetTransactionAmountMajor: value };

                expect(extractPlanChangeUpgradeMetadata(metadata)).toBeNull();
            });
        }

        it('still returns null when a string field is missing but the amount is valid', () => {
            expect(
                extractPlanChangeUpgradeMetadata({
                    planChangeUpgradeId: 'sub-uuid-1',
                    oldPlanId: 'plan-basic',
                    targetTransactionAmountMajor: '12345'
                })
            ).toBeNull();
        });
    });
});
