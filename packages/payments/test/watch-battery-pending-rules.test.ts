/**
 * HOS-1512 PR 2 (owner decision 2026-11-18): the two non-money preapproval rules. A pending
 * creation is non-money only while it carries no card token, no status and no plan; a cancel is
 * non-money only with the exact body `{status: 'cancelled'}`.
 */
import { describe, expect, it } from 'vitest';
import { classifyOperation } from '../src/battery/watch-operations';

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

const create = (body: unknown) =>
    classifyOperation({
        request: { method: 'POST', path: '/preapproval', body: body as never },
        pathname: '/preapproval'
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

    it('is not pending without a payer email', () => {
        const { payer_email: _dropped, ...body } = PENDING;
        expect(create(body)?.rule).not.toBe('preapproval.create-pending');
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
