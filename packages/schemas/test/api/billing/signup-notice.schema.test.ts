import { describe, expect, it } from 'vitest';
import { SignupNoticeResponseSchema } from '../../../src/api/billing/signup-notice.schema.js';

describe('TEST:B13a:21b AC:B13a:5 and AC:1735:8 the signup notice contract', () => {
    it.each([
        [
            'running trial',
            {
                plan: { name: 'Plan test', amount: 1500000, currency: 'ARS', cycle: 'monthly' },
                pendingAttempt: null,
                vertical: 'accommodation',
                touristVip: { status: 'NOT_AFFECTED' },
                trial: {
                    status: 'RUNNING',
                    endsAt: '2026-10-20T08:00:00.000Z',
                    daysLeft: 11
                }
            }
        ],
        [
            'no running trial',
            {
                plan: { name: 'Plan test', amount: 1500000, currency: 'ARS', cycle: 'annual' },
                pendingAttempt: null,
                vertical: 'venue',
                touristVip: { status: 'CANCELLED_ON_RETURN' },
                trial: { status: 'NOT_RUNNING' }
            }
        ]
    ])('accepts %s', (_label, value) => {
        expect(SignupNoticeResponseSchema.parse(value)).toEqual(value);
    });

    it('accepts an inherited Tourist VIP cancelled on activation with a paid-until date or null', () => {
        const base = {
            plan: { name: 'Owner', amount: 1500000, currency: 'ARS', cycle: 'monthly' },
            pendingAttempt: null,
            vertical: 'accommodation',
            trial: { status: 'NOT_RUNNING' }
        };
        const paidUntil = '2026-11-01T12:00:00.000Z';
        expect(
            SignupNoticeResponseSchema.parse({
                ...base,
                touristVip: { status: 'CANCELLED_ON_ACTIVATION', paidUntil }
            }).touristVip
        ).toEqual({ status: 'CANCELLED_ON_ACTIVATION', paidUntil });
        expect(
            SignupNoticeResponseSchema.parse({
                ...base,
                touristVip: { status: 'CANCELLED_ON_ACTIVATION', paidUntil: null }
            }).touristVip
        ).toEqual({ status: 'CANCELLED_ON_ACTIVATION', paidUntil: null });
    });

    it.each([
        [
            'running without endsAt',
            {
                vertical: 'accommodation',
                trial: { status: 'RUNNING', daysLeft: 1 }
            }
        ],
        [
            'zero remaining days',
            {
                vertical: 'accommodation',
                trial: {
                    status: 'RUNNING',
                    endsAt: '2026-10-20T08:00:00.000Z',
                    daysLeft: 0
                }
            }
        ],
        ['unknown vertical', { vertical: 'unknown', trial: { status: 'NOT_RUNNING' } }],
        [
            'invalid plan amount and cycle',
            {
                plan: { name: 'Plan', amount: -1, currency: 'ARS', cycle: 'weekly' },
                vertical: 'accommodation',
                touristVip: { status: 'NOT_AFFECTED' },
                trial: { status: 'NOT_RUNNING' }
            }
        ],
        ['missing Tourist VIP status', { vertical: 'tourist', trial: { status: 'NOT_RUNNING' } }],
        [
            'unknown Tourist VIP status',
            {
                vertical: 'tourist',
                touristVip: { status: 'ACTIVE' },
                trial: { status: 'NOT_RUNNING' }
            }
        ]
    ])('rejects %s', (_label, value) => {
        expect(() => SignupNoticeResponseSchema.parse(value)).toThrow();
    });
});

describe('TEST:1759:1 the signup notice plan slug', () => {
    const value = {
        plan: {
            slug: 'owner-basico',
            name: 'Basic',
            amount: 1500000,
            currency: 'ARS',
            cycle: 'monthly'
        },
        pendingAttempt: {
            subscriptionId: '123e4567-e89b-42d3-a456-426614174001',
            plan: {
                slug: 'owner-basico',
                name: 'Basic',
                amount: 1500000,
                currency: 'ARS',
                cycle: 'monthly'
            },
            checkoutUrl: 'https://payments.example/continue',
            authorizationWindowEndsAt: '2026-10-13T02:30:00.000Z'
        },
        vertical: 'accommodation',
        touristVip: { status: 'NOT_AFFECTED' },
        trial: { status: 'NOT_RUNNING' }
    };

    it('preserves slug on plan and pending attempt', () => {
        expect(SignupNoticeResponseSchema.parse(value)).toEqual(value);
    });

    it('continues to parse without either slug', () => {
        const { slug: _planSlug, ...plan } = value.plan;
        const { slug: _attemptSlug, ...attemptPlan } = value.pendingAttempt.plan;
        expect(
            SignupNoticeResponseSchema.parse({
                ...value,
                plan,
                pendingAttempt: { ...value.pendingAttempt, plan: attemptPlan }
            })
        ).toEqual({
            ...value,
            plan,
            pendingAttempt: { ...value.pendingAttempt, plan: attemptPlan }
        });
    });

    it('rejects an empty plan slug', () => {
        expect(
            SignupNoticeResponseSchema.safeParse({ ...value, plan: { ...value.plan, slug: '' } })
                .success
        ).toBe(false);
    });

    it('rejects an empty pending attempt plan slug', () => {
        expect(
            SignupNoticeResponseSchema.safeParse({
                ...value,
                pendingAttempt: {
                    ...value.pendingAttempt,
                    plan: { ...value.pendingAttempt.plan, slug: '' }
                }
            }).success
        ).toBe(false);
    });
});
