import { describe, expect, it } from 'vitest';
import type { SubscribeDestinationResponse } from '@/lib/api/endpoints-protected';
import type { ApiResult } from '@/lib/api/types';
import {
    resolvePublishAffordance,
    resolveSubscribeButtonView,
    resolveTrialEligibility,
    UNKNOWN_PUBLISH_AFFORDANCE
} from '@/lib/publish/subscribe-button';

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

describe('resolvePublishAffordance (HOS-1668)', () => {
    const unknown = { kind: 'unknown', canPublish: false, startsTrial: false, trialDays: null };

    // HOS-1668 C-1: PUBLISH means the server publishes and starts the trial.
    it('maps PUBLISH to a publish affordance that starts the trial', () =>
        expect(
            resolvePublishAffordance({
                result: { ok: true, data: { destination: 'PUBLISH', trialDays: 14 } }
            })
        ).toEqual({ kind: 'publish', canPublish: true, startsTrial: true, trialDays: 14 }));

    // HOS-1668 C-1: COVERED means the server publishes without a trial.
    it('maps COVERED to a covered affordance without a trial', () =>
        expect(
            resolvePublishAffordance({
                result: { ok: true, data: { destination: 'COVERED' } }
            })
        ).toEqual({ kind: 'covered', canPublish: true, startsTrial: false, trialDays: null }));

    // HOS-1668 C-1: CHECKOUT means the server rejects the publish.
    it('maps CHECKOUT to a checkout affordance that cannot publish', () =>
        expect(
            resolvePublishAffordance({
                result: {
                    ok: true,
                    data: { destination: 'CHECKOUT', reason: 'TRIAL_DAYS_NOT_POSITIVE' }
                }
            })
        ).toEqual({ kind: 'checkout', canPublish: false, startsTrial: false, trialDays: null }));

    // HOS-1668 C-1: NO_PLANS_AVAILABLE means the server rejects with no_plans_available.
    it('maps NO_PLANS_AVAILABLE to a no-plans affordance that cannot publish', () =>
        expect(
            resolvePublishAffordance({
                result: { ok: true, data: { destination: 'NO_PLANS_AVAILABLE' } }
            })
        ).toEqual({ kind: 'noPlans', canPublish: false, startsTrial: false, trialDays: null }));

    // HOS-1668 C-2: a PUBLISH without a positive trial length is not trusted.
    it('fails closed on a PUBLISH with zero trial days', () =>
        expect(
            resolvePublishAffordance({
                result: { ok: true, data: { destination: 'PUBLISH', trialDays: 0 } }
            })
        ).toEqual(unknown));

    // HOS-1668 C-2: a failed read never leaves the button enabled.
    it.each([500, 401])('fails closed on a failed read (%s)', (status) =>
        expect(
            resolvePublishAffordance({
                result: { ok: false, error: { status, message: 'failure' } }
            })
        ).toEqual(unknown));

    // HOS-1668 C-2: an unrecognised destination never leaves the button enabled.
    it('fails closed on an unknown destination', () =>
        expect(
            resolvePublishAffordance({
                result: {
                    ok: true,
                    data: { destination: 'UNKNOWN' }
                } as unknown as ApiResult<SubscribeDestinationResponse>
            })
        ).toEqual(unknown));

    // HOS-1668 C-2: the exported default is the fail-closed affordance.
    it('exports the unknown affordance as the default', () =>
        expect(UNKNOWN_PUBLISH_AFFORDANCE).toEqual(unknown));
});

describe('resolveTrialEligibility (HOS-1668)', () => {
    // HOS-1668 C-2: an unresolved read stays unresolved for the /publicar/ callout.
    it('returns null for the unknown affordance', () =>
        expect(resolveTrialEligibility({ affordance: UNKNOWN_PUBLISH_AFFORDANCE })).toBeNull());

    // HOS-1668 C-1: PUBLISH starts the trial.
    it('returns true for a publish affordance', () =>
        expect(
            resolveTrialEligibility({
                affordance: { kind: 'publish', canPublish: true, startsTrial: true, trialDays: 14 }
            })
        ).toBe(true));

    // HOS-1668 C-1: COVERED does not start a trial.
    it('returns false for a covered affordance', () =>
        expect(
            resolveTrialEligibility({
                affordance: {
                    kind: 'covered',
                    canPublish: true,
                    startsTrial: false,
                    trialDays: null
                }
            })
        ).toBe(false));
});
