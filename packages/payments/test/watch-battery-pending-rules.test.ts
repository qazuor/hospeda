/**
 * HOS-1512 PR 2 (owner decision 2026-11-18): the two non-money preapproval rules. A pending
 * creation is non-money only while it carries no card token, no status and no plan; a cancel is
 * non-money only with the exact body `{status: 'cancelled'}`.
 */
import { describe, expect, it } from 'vitest';
import type { WatchSettings } from '../src/battery/types';
import { classifyOperation, PENDING_AMOUNTS_MINOR } from '../src/battery/watch-operations';
import { FAKE_AMOUNT_CEILING_MINOR, FAKE_AMOUNT_FLOOR_MINOR } from '../src/fake/fake-rules';

const PENDING = {
    reason: 'watch',
    external_reference: 'hospeda-watch-run-1',
    payer_email: 'watch-payer@hospeda.test',
    back_url: 'https://hospeda.test',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 15,
        currency_id: 'ARS'
    }
} as const;

const SETTINGS = { payerEmail: PENDING.payer_email, returnUrl: PENDING.back_url } as const;

const create = (body: unknown, settings: WatchSettings = SETTINGS) =>
    classifyOperation({
        request: { method: 'POST', path: '/preapproval', body: body as never },
        pathname: '/preapproval',
        settings
    });

const put = (body: unknown) =>
    classifyOperation({
        request: { method: 'PUT', path: '/preapproval/abc', body: body as never },
        pathname: '/preapproval/abc'
    });

describe('preapproval.create-pending', () => {
    it('classifies a no-token pending creation as non-money and creating', () => {
        expect(create(PENDING)).toMatchObject({
            rule: 'preapproval.create-pending',
            kind: 'non-money',
            creates: true
        });
    });

    it('accepts a first charge date', () => {
        const body = {
            ...PENDING,
            auto_recurring: { ...PENDING.auto_recurring, start_date: '2026-11-24T12:00:00.318Z' }
        };
        expect(create(body)?.rule).toBe('preapproval.create-pending');
    });

    it.each([
        ['a card token', { ...PENDING, card_token_id: 'tok' }],
        ['a status', { ...PENDING, status: 'authorized' }],
        ['a plan', { ...PENDING, preapproval_plan_id: 'plan-1' }],
        [
            'a free trial',
            {
                ...PENDING,
                auto_recurring: {
                    ...PENDING.auto_recurring,
                    free_trial: { frequency: 1, frequency_type: 'months' }
                }
            }
        ],
        [
            'a cadence in days',
            { ...PENDING, auto_recurring: { ...PENDING.auto_recurring, frequency_type: 'days' } }
        ]
    ])('is never non-money with %s', (_name, body) => {
        expect(create(body)?.kind).not.toBe('non-money');
    });

    it.each([
        ['USD', 'USD'],
        ['BRL', 'BRL'],
        ['a lowercase ars', 'ars']
    ])('is never non-money in %s', (_name, currency) => {
        const body = {
            ...PENDING,
            auto_recurring: { ...PENDING.auto_recurring, currency_id: currency }
        };
        expect(create(body)?.kind).not.toBe('non-money');
    });

    it.each([
        ['one peso above the floor', 16],
        ['a typical price', 25_000],
        ['the ceiling itself', 2_000_000],
        ['zero', 0]
    ])('is never non-money at %s', (_name, pesos) => {
        const body = {
            ...PENDING,
            auto_recurring: { ...PENDING.auto_recurring, transaction_amount: pesos }
        };
        expect(create(body)?.kind).not.toBe('non-money');
    });

    it('refuses a malformed amount outright (the charge rule cannot read it either)', () => {
        const body = {
            ...PENDING,
            auto_recurring: { ...PENDING.auto_recurring, transaction_amount: 15.005 }
        };
        expect(() => create(body)).toThrow(/CHARGE_MISMATCH|amount/i);
    });

    it('accepts exactly the floor and the two RP3 probes', () => {
        expect([...PENDING_AMOUNTS_MINOR].sort((a, b) => a - b)).toEqual([
            FAKE_AMOUNT_FLOOR_MINOR - 100,
            FAKE_AMOUNT_FLOOR_MINOR,
            FAKE_AMOUNT_CEILING_MINOR + 100
        ]);
        for (const minor of PENDING_AMOUNTS_MINOR) {
            const body = {
                ...PENDING,
                auto_recurring: { ...PENDING.auto_recurring, transaction_amount: minor / 100 }
            };
            expect(create(body)?.rule).toBe('preapproval.create-pending');
        }
    });

    it('is not pending without a payer email', () => {
        const { payer_email: _dropped, ...body } = PENDING;
        expect(create(body)?.rule).not.toBe('preapproval.create-pending');
    });

    // Review of #4538 (L2): the link sends its payer back to OUR site and names OUR payer.
    it.each([
        ['another back_url', { ...PENDING, back_url: 'https://elsewhere.test' }],
        ['another payer email', { ...PENDING, payer_email: 'someone@elsewhere.test' }]
    ])('is never non-money with %s than the settings', (_name, body) => {
        expect(create(body)?.kind).not.toBe('non-money');
    });

    it.each([
        ['no return URL', { payerEmail: PENDING.payer_email }],
        ['no payer email', { returnUrl: PENDING.back_url }],
        ['no settings', {}]
    ])('is never non-money with %s set', (_name, settings) => {
        expect(create(PENDING, settings)?.kind).not.toBe('non-money');
    });
});

describe('preapproval.cancel', () => {
    it('is non-money and targets the id with the exact cancel body', () => {
        expect(put({ status: 'cancelled' })).toMatchObject({
            rule: 'preapproval.cancel',
            kind: 'non-money',
            targetId: 'abc',
            creates: false
        });
    });

    it.each([
        ['a resume', { status: 'authorized' }],
        ['a cancel with more fields', { status: 'cancelled', reason: 'x' }]
    ])('never matches %s', (_name, body) => {
        expect(put(body)?.rule).not.toBe('preapproval.cancel');
    });
});
