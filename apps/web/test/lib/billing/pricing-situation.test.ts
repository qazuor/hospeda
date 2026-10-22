import type { PricingSituationResponse } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    PLAN_CHANGE_UNAVAILABLE_KEY,
    PRICING_PLAN_CHANGE_NOTICE,
    resolvePlanCardCta
} from '../../../src/lib/billing/pricing-situation';

const plan = {
    planVersionId: 'version-a',
    billingOptions: { monthly: 'monthly-a', annual: 'annual-a' }
};
const resolve = (data: PricingSituationResponse, version = plan.planVersionId) =>
    resolvePlanCardCta({
        locale: 'es',
        vertical: 'accommodation',
        plan: { ...plan, planVersionId: version },
        result: { ok: true, data }
    });

describe('TEST:1621:5 pricing card CTA situation resolver', () => {
    it.each([
        [{ situation: 'CHECKOUT' }, 'checkout'],
        [{ situation: 'TRIAL' }, 'checkout'],
        [{ situation: 'FIRST_USE', trialDays: 14 }, 'none'],
        [{ situation: 'NO_PLANS' }, 'none'],
        [{ situation: 'COVERED' }, 'none'],
        [{ situation: 'TOURIST_VIP_INHERITED' }, 'vipInherited']
    ] as const)('maps %s to %s', (raw, kind) => {
        expect(resolve(raw as PricingSituationResponse).kind).toBe(kind);
    });

    it.each([
        'ACTIVE',
        'GRACE_PERIOD',
        'PAUSED',
        'SUSPENDED',
        'CANCEL_SCHEDULED'
    ] as const)('maps the anchored plan in %s to current', (status) => {
        const result = resolve({
            situation: 'SUBSCRIBED',
            status,
            planVersionId: plan.planVersionId,
            billingOptionId: 'monthly-a'
        });
        expect(result.kind).toBe('current');
        if (result.kind === 'current')
            expect(result.showsPlanChangeNotice).toBe(status === 'ACTIVE');
    });

    it('TEST:1735:14 offers all checkout options during a pending authorization', () => {
        const pending: PricingSituationResponse = {
            situation: 'SUBSCRIBED',
            status: 'PENDING_AUTHORIZATION',
            planVersionId: 'version-a',
            billingOptionId: 'annual-a'
        };
        expect(resolve(pending)).toEqual({
            kind: 'checkout',
            links: [
                {
                    cycle: 'monthly',
                    href: '/es/suscriptores/checkout/?opcion=monthly-a',
                    resumes: false
                },
                {
                    cycle: 'annual',
                    href: '/es/suscriptores/checkout/?opcion=annual-a',
                    resumes: true
                }
            ]
        });
        expect(resolve(pending, 'version-b')).toEqual({
            kind: 'checkout',
            links: [
                {
                    cycle: 'monthly',
                    href: '/es/suscriptores/checkout/?opcion=monthly-a',
                    resumes: false
                },
                {
                    cycle: 'annual',
                    href: '/es/suscriptores/checkout/?opcion=annual-a',
                    resumes: false
                }
            ]
        });
        const active: PricingSituationResponse = {
            situation: 'SUBSCRIBED',
            status: 'ACTIVE',
            planVersionId: 'version-a',
            billingOptionId: 'monthly-a'
        };
        expect(resolve(active, 'version-b').kind).toBe('planChangeUnavailable');
        const mismatchedCard = resolvePlanCardCta({
            locale: 'es',
            vertical: 'accommodation',
            plan: {
                planVersionId: 'version-b',
                billingOptions: { monthly: 'monthly-a', annual: null }
            },
            result: { ok: true, data: active }
        });
        expect(mismatchedCard.kind).toBe('planChangeUnavailable');
    });

    it('builds monthly and annual checkout links from their exact option ids', () => {
        const result = resolve({ situation: 'CHECKOUT' });
        expect(result).toEqual({
            kind: 'checkout',
            links: [
                {
                    cycle: 'monthly',
                    href: '/es/suscriptores/checkout/?opcion=monthly-a',
                    resumes: false
                },
                {
                    cycle: 'annual',
                    href: '/es/suscriptores/checkout/?opcion=annual-a',
                    resumes: false
                }
            ]
        });
    });

    it('fails closed for read errors, except a tourist guest can enter checkout', () => {
        const error = { ok: false as const, error: { status: 500, message: 'failed' } };
        expect(
            resolvePlanCardCta({ locale: 'es', vertical: 'accommodation', plan, result: error })
        ).toEqual({ kind: 'none' });
        expect(
            resolvePlanCardCta({
                locale: 'es',
                vertical: 'tourist',
                plan,
                result: { ok: false, error: { status: 401, message: 'guest' } }
            }).kind
        ).toBe('checkout');
        expect(
            resolvePlanCardCta({
                locale: 'es',
                vertical: 'accommodation',
                plan,
                result: { ok: false, error: { status: 401, message: 'guest' } }
            }).kind
        ).toBe('none');
    });

    it('shows the AU notice only for ACTIVE', () => {
        expect(
            Object.entries(PRICING_PLAN_CHANGE_NOTICE)
                .filter(([, value]) => value)
                .map(([key]) => key)
        ).toEqual(['ACTIVE']);
        expect(PLAN_CHANGE_UNAVAILABLE_KEY).toBe('account.subscription.mine.planChangeUnavailable');
    });
});
