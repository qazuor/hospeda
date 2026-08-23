/**
 * @file cleared-payment-predicate.guard.test.ts
 * @description Static guard: in `payment-logic.ts`, no branch may reach a
 * payment's amount or currency without having passed the "did this charge
 * clear?" gate.
 *
 * ## The defect class
 *
 * `processPaymentUpdated` is fed by producers that once spelled a successful
 * charge differently, and `MP_APPROVED_STATUSES` (`{'approved','accredited'}`)
 * knew only MercadoPago's RAW vocabulary. It therefore did not mean "the charge
 * cleared" — it meant "this event arrived by the polling job", and it was FALSE
 * for every approved payment the live webhook ever delivered. Four dispatches
 * were gated on it and were dormant on the primary path for their entire
 * lifetime: the annual activation (SPEC-141 D1), the plan-change upgrade commit
 * (D7), HOS-595's `billing_payments` ledger entry for an add-on charge, and the
 * customer-facing payment notifications.
 *
 * HOS-742 hit the same wall from the other side and had to introduce a SECOND,
 * wider set scoped to its own branch. HOS-756 collapsed both into one canonical
 * predicate. HOS-757 removed the raw vocabulary at its last producer and
 * collapsed the predicate to a SINGLE call site — the `settled` binding — that
 * every money branch reads.
 *
 * ## What this guard asserts, and why it changed shape (HOS-757)
 *
 * The previous version anchored on a FUNCTION NAME: it counted calls to
 * `isClearedPaymentStatus` and demanded at least four. That anchor dies at the
 * first rename, and worse, it dies silently in the very PR that does the
 * renaming — the change that removes the protection is the one that stops the
 * guard from being able to see it. It also asserted the wrong thing: "four
 * gates each ask the question" is a proxy for the property, not the property.
 *
 * The property is: **an ungated amount must not be reachable.** So this guard
 * anchors on the token the property cannot exist without — `extractPaymentInfo`,
 * the only reader of the payload's money in this module — and asserts that the
 * value it returns is never read for `.amount` / `.currency`, under whatever
 * name it is bound to. Rename the binding and the guard follows it; delete the
 * gate and the guard fails.
 *
 * ## The second invariant: one vocabulary
 *
 * `RAW_MP_STATUS_LITERALS` asserts that no raw MercadoPago status spelling
 * survives in live code. This became assertable only once HOS-763 (#2979) routed
 * the two notification gates through the canonical predicates and HOS-757
 * removed the raw vocabulary at its last producer — before that, `'approved'`,
 * `'rejected'` and `'cancelled'` were legitimately present and the assertion
 * would have needed an exemption list for them. It deliberately carries none:
 * an exemption is exactly where the next regression would sit.
 *
 * Comments are stripped first, so the prose above those constants may keep
 * naming the retired spellings to explain why they are retired.
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
 * the canonical predicate legitimately spells out the retired identifier and
 * both vocabularies in prose to explain WHY — scanning comments would make this
 * guard fail on its own documentation.
 *
 * @param source - Raw module source.
 * @returns The same source with every comment removed.
 */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Raw MercadoPago status spellings that no producer can emit any more, because
 * the qzpay adapter rewrites them before this module is reached. See the file
 * header for the three that are deliberately absent from this list until #2979.
 */
const RAW_MP_STATUS_LITERALS = [
    'approved',
    'accredited',
    'rejected',
    'cancelled',
    'in_process',
    'in_mediation',
    'charged_back',
    'authorized'
] as const;

/**
 * An array or `Set` literal enumerating cleared payment statuses — i.e. someone
 * re-declaring the vocabulary by hand. Anchored on the cleared token itself,
 * not on `new Set(`: `['succeeded'] as const`, a `Set` literal and
 * `.includes([...])` are the same bug written three ways.
 */
const CLEARED_SET_LITERAL = /\[[^\]]*['"]succeeded['"][^\]]*\]/g;

/**
 * The identifier the ungated payment is bound to, read out of the source rather
 * than hard-coded, so a rename cannot quietly take the guard with it.
 *
 * @param source - Comment-stripped module source.
 * @returns The binding name (e.g. `paymentInfo`).
 * @throws If the module no longer binds `extractPaymentInfo()` to a named
 *   const, which would leave every assertion below matching nothing.
 */
function ungatedPaymentBinding(source: string): string {
    const match = source.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*extractPaymentInfo\s*\(/);
    if (!match?.[1]) {
        throw new Error(
            'payment-logic.ts no longer binds the result of extractPaymentInfo() to a ' +
                'named const. This guard reads that name to check nothing reads an ' +
                'ungated amount off it; if the shape changed, the guard must be ' +
                'rewritten deliberately rather than left passing vacuously (HOS-757).'
        );
    }
    return match[1];
}

describe('HOS-757 guard: no branch reaches an ungated payment amount', () => {
    const liveCode = stripComments(readFileSync(PAYMENT_LOGIC, 'utf-8'));

    it('retires MP_APPROVED_STATUSES entirely', () => {
        expect(
            liveCode,
            'payment-logic.ts still references MP_APPROVED_STATUSES. It held only ' +
                "MercadoPago's RAW spellings, so it was false for every live webhook — " +
                'it meant "arrived by polling", not "the charge cleared" (HOS-756).'
        ).not.toMatch(/MP_APPROVED_STATUSES/);
    });

    it.each(RAW_MP_STATUS_LITERALS)('never compares a payment status against `%s`', (raw) => {
        expect(
            liveCode,
            `payment-logic.ts contains the raw MercadoPago status literal '${raw}'. ` +
                'The qzpay adapter rewrites every status before this module sees it, so ' +
                'no producer can emit that spelling — a comparison against it is dead ' +
                "code that reads as a working gate. ('accredited' is not even a status: " +
                'MercadoPago publishes it under `status_detail`, which ' +
                '`extractPaymentInfo` reads into a separate field.)'
        ).not.toMatch(new RegExp(`['"]${raw}['"]`));
    });

    it('declares exactly one cleared-payment status set', () => {
        const matches = [...liveCode.matchAll(CLEARED_SET_LITERAL)];
        expect(
            matches.length,
            `payment-logic.ts declares ${matches.length} cleared-status set literal(s) ` +
                `(${matches.map((m) => m[0]).join(' | ')}), expected exactly 1. ` +
                'A second one is how MP_APPROVED_STATUSES and CLEARED_PAYMENT_STATUSES ' +
                'came to answer the same question two different ways in one file ' +
                '(HOS-742 / HOS-756).'
        ).toBe(1);
    });

    it('never reads .amount or .currency off the ungated payment', () => {
        const binding = ungatedPaymentBinding(liveCode);
        const ungatedReads = [
            ...liveCode.matchAll(new RegExp(`\\b${binding}\\s*\\??\\.(amount|currency)\\b`, 'g'))
        ];
        expect(
            ungatedReads.map((m) => m[0]),
            `payment-logic.ts reads money field(s) straight off \`${binding}\`, which is ` +
                'the payment BEFORE the clearance gate. Every branch that spends or ' +
                'books money must read `settled.*` instead — that binding is the single ' +
                'place the cleared-status predicate is applied, and routing through it ' +
                'is what makes an ungated figure unreachable rather than merely ' +
                'discouraged (HOS-757).'
        ).toEqual([]);
    });

    it('never destructures a bare `amount` or `currency` off the ungated payment', () => {
        const binding = ungatedPaymentBinding(liveCode);
        const destructures = [
            ...liveCode.matchAll(new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*${binding}\\s*;`, 'g'))
        ];

        const offenders = destructures
            .flatMap((m) => (m[1] ?? '').split(','))
            .map((part) => part.trim())
            .filter((part) => part === 'amount' || part === 'currency');

        expect(
            offenders,
            `payment-logic.ts destructures ${offenders.join(' and ')} straight off ` +
                `\`${binding}\`. A bare \`amount\` in the same scope as \`settled\` is an ` +
                'ungated figure that looks exactly like a gated one, so a new line inside ' +
                'a money branch would compile and be wrong. The notification branches ' +
                'that legitimately need the attempted figures bind them as ' +
                '`attemptedAmount` / `attemptedCurrency`, which is the whole point of the ' +
                'naming (HOS-757).'
        ).toEqual([]);
    });
});
