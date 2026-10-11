import { describe, expect, it } from 'vitest';
import type { SubscribeDestinationResponse } from '@/lib/api/endpoints-protected';
import type { ApiResult } from '@/lib/api/types';
import { resolveSubscribeButtonView } from '@/lib/publish/subscribe-button';

const base = { locale: 'es' as const, vertical: 'accommodation' as const };

describe('resolveSubscribeButtonView (TEST:V8a:3 / TEST:V8a:4)', () => {
    it('publishes with locale-prefixed trailing slash and trial days', () => {
        expect(
            resolveSubscribeButtonView({
                ...base,
                result: { ok: true, data: { destination: 'PUBLISH', trialDays: 14 } }
            })
        ).toEqual({ kind: 'publish', href: '/es/publicar/', trialDays: 14 });
    });
    it('maps checkout', () =>
        expect(
            resolveSubscribeButtonView({
                ...base,
                result: {
                    ok: true,
                    data: { destination: 'CHECKOUT', reason: 'TRIAL_DAYS_NOT_POSITIVE' }
                }
            })
        ).toEqual({ kind: 'checkout' }));
    it('maps covered', () =>
        expect(
            resolveSubscribeButtonView({
                ...base,
                result: { ok: true, data: { destination: 'COVERED' } }
            })
        ).toEqual({ kind: 'covered' }));
    it('maps no plans', () =>
        expect(
            resolveSubscribeButtonView({
                ...base,
                result: { ok: true, data: { destination: 'NO_PLANS_AVAILABLE' } }
            })
        ).toEqual({ kind: 'noPlans' }));
    it('sends an anonymous visitor to signup with the publish return URL', () =>
        expect(
            resolveSubscribeButtonView({
                ...base,
                result: { ok: false, error: { status: 401, message: 'unauthorized' } }
            })
        ).toEqual({ kind: 'signedOut', href: '/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2F' }));
    it.each([0, 503])('hides failed API responses (%s)', (status) =>
        expect(
            resolveSubscribeButtonView({
                ...base,
                result: { ok: false, error: { status, message: 'failure' } }
            })
        ).toEqual({ kind: 'hidden' }));
    it('hides an unexpected API response shape', () =>
        expect(
            resolveSubscribeButtonView({
                ...base,
                result: {
                    ok: true,
                    data: { destination: 'UNKNOWN' }
                } as unknown as ApiResult<SubscribeDestinationResponse>
            })
        ).toEqual({ kind: 'hidden' }));
});
