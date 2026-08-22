/**
 * @file cleared-payment-predicate.guard.test.ts
 * @description Static guard: every dispatch gate in `payment-logic.ts` that asks
 * "did this charge clear?" must route through the single canonical
 * `isClearedPaymentStatus` predicate — never a locally-declared set of payment
 * status literals.
 *
 * ## The defect class
 *
 * `processPaymentUpdated` is fed by three producers that spell a successful
 * charge differently: the live webhook forwards the qzpay-NORMALIZED status
 * (`'succeeded'`), the polling job builds a synthetic payload with MercadoPago's
 * RAW status (`'approved'`), and the dead-letter replay carries no status at all.
 *
 * `MP_APPROVED_STATUSES` (`{'approved', 'accredited'}`) knew only the raw
 * vocabulary. It therefore did not mean "the charge cleared" — it meant "this
 * event arrived by the polling job", and it was FALSE for every approved payment
 * the live webhook ever delivered. Three dispatches were gated on it and were
 * dormant on the primary path for their entire lifetime: the annual activation
 * (SPEC-141 D1), the plan-change upgrade commit (D7), and HOS-595's
 * `billing_payments` ledger entry for an add-on charge (HOS-756).
 *
 * HOS-742 hit the same wall from the other side and had to introduce a SECOND,
 * wider set (`CLEARED_PAYMENT_STATUSES`) scoped to its own branch so it would not
 * switch the other three on by accident. Two predicates answering one question in
 * one file IS the bug this guard exists to stop from growing back.
 *
 * ## Why a static guard rather than more unit tests
 *
 * The defect is "N gates each know the vocabulary themselves", so the assertion
 * has to be over the SET of gates, not over one gate's runtime behaviour. A unit
 * test for the annual dispatch would never have caught the identical blindness
 * sitting twelve lines below it in the plan-change dispatch — which is exactly
 * what happened.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAYMENT_LOGIC = resolve(
    __dirname,
    '../../../src/routes/webhooks/mercadopago/payment-logic.ts'
);

/**
 * Strips block comments (including JSDoc) and `//` line comments. The JSDoc on
 * the canonical predicate legitimately spells out the retired identifier and both
 * vocabularies in prose to explain WHY — scanning comments would make this guard
 * fail on its own documentation.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * An array or `Set` literal that enumerates payment statuses — i.e. someone
 * re-declaring the cleared-status vocabulary by hand. Deliberately not anchored
 * on `new Set(`: `['approved', 'succeeded'] as const`, `.includes([...])` and a
 * `Set` literal are the same bug written three ways.
 */
const STATUS_SET_LITERAL = /\[[^\]]*['"]approved['"][^\]]*\]/g;

/** A CALL of the canonical predicate (the `export function` declaration excluded). */
const PREDICATE_CALL = /(?<!function\s)isClearedPaymentStatus\s*\(/g;

describe('HOS-756 guard: payment-clearance gates use one canonical predicate', () => {
    const liveCode = stripComments(readFileSync(PAYMENT_LOGIC, 'utf-8'));

    it('declares exactly one cleared-payment status set', () => {
        const matches = [...liveCode.matchAll(STATUS_SET_LITERAL)];
        expect(
            matches.length,
            `payment-logic.ts declares ${matches.length} payment-status set literal(s) ` +
                `(${matches.map((m) => m[0]).join(' | ')}), expected exactly 1. ` +
                'Every "did this charge clear?" gate must call isClearedPaymentStatus(), ' +
                'which owns the only such set. A second one is how MP_APPROVED_STATUSES ' +
                'and CLEARED_PAYMENT_STATUSES came to answer the same question two ' +
                'different ways in one file (HOS-742 / HOS-756).'
        ).toBe(1);
    });

    it('retires MP_APPROVED_STATUSES entirely', () => {
        expect(
            liveCode,
            'payment-logic.ts still references MP_APPROVED_STATUSES. It held only ' +
                "MercadoPago's RAW spellings, so it was false for every live webhook — " +
                'it meant "arrived by polling", not "the charge cleared" (HOS-756).'
        ).not.toMatch(/MP_APPROVED_STATUSES/);
    });

    it('never treats `accredited` as a payment status', () => {
        expect(
            liveCode,
            "payment-logic.ts compares a payment status against 'accredited'. That is " +
                'not a payment status: MercadoPago publishes it under `status_detail`, ' +
                'and `extractPaymentInfo` reads that into a separate `statusDetail` ' +
                'field. It can never reach a `status` comparison from any producer ' +
                '(HOS-756).'
        ).not.toMatch(/['"]accredited['"]/);
    });

    it('routes every clearance gate through the canonical predicate', () => {
        const callCount = [...liveCode.matchAll(PREDICATE_CALL)].length;
        expect(
            callCount,
            `payment-logic.ts calls isClearedPaymentStatus() ${callCount} time(s), ` +
                'expected at least 4 — the annual activation (SPEC-141 D1), the ' +
                'plan-change upgrade commit (D7), the add-on confirmation gate ' +
                '(HOS-742) and the add-on ledger forward (HOS-595). A gate that stops ' +
                'calling it has gone back to knowing the vocabulary itself.'
        ).toBeGreaterThanOrEqual(4);
    });
});
