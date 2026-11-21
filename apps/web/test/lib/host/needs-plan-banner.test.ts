import { describe, expect, it } from 'vitest';
import { resolveNeedsPlanBannerView } from '../../../src/lib/host/needs-plan-banner';
import {
    type PublishAffordance,
    UNKNOWN_PUBLISH_AFFORDANCE
} from '../../../src/lib/publish/subscribe-button';

const trial: PublishAffordance = {
    kind: 'publish',
    canPublish: true,
    startsTrial: true,
    trialDays: 21
};
const covered: PublishAffordance = {
    kind: 'covered',
    canPublish: true,
    startsTrial: false,
    trialDays: null
};
const checkout: PublishAffordance = {
    kind: 'checkout',
    canPublish: false,
    startsTrial: false,
    trialDays: null
};
const noPlans: PublishAffordance = {
    kind: 'noPlans',
    canPublish: false,
    startsTrial: false,
    trialDays: null
};

describe('TEST:HOS-2425 needs plan banner view', () => {
    const base = {
        isEmpty: false,
        fetchError: false,
        effectiveSetReadOk: true,
        hasDraftProperty: true,
        hasOwnerPlan: false,
        publishAffordance: checkout
    };

    it('without a plan and no trial left: asks for a plan', () => {
        expect(resolveNeedsPlanBannerView(base)).toEqual({ kind: 'needsPlan' });
    });

    it('without a plan but publishing starts the trial: never says a plan is required', () => {
        // Regression: this state used to render "you need an active plan to publish".
        expect(resolveNeedsPlanBannerView({ ...base, publishAffordance: trial })).toEqual({
            kind: 'trialAvailable',
            trialDays: 21
        });
    });

    it('with the trial running (covered): hidden', () => {
        expect(resolveNeedsPlanBannerView({ ...base, publishAffordance: covered })).toEqual({
            kind: 'hidden'
        });
    });

    it('with a real owner plan: hidden whatever the destination says', () => {
        expect(
            resolveNeedsPlanBannerView({ ...base, hasOwnerPlan: true, publishAffordance: trial })
        ).toEqual({ kind: 'hidden' });
    });

    it('does not assert plan absence when the protected read failed', () => {
        expect(resolveNeedsPlanBannerView({ ...base, effectiveSetReadOk: false })).toEqual({
            kind: 'hidden'
        });
    });

    it('fails closed on an unresolved destination and on a vertical with no plans', () => {
        expect(
            resolveNeedsPlanBannerView({ ...base, publishAffordance: UNKNOWN_PUBLISH_AFFORDANCE })
        ).toEqual({ kind: 'hidden' });
        expect(resolveNeedsPlanBannerView({ ...base, publishAffordance: noPlans })).toEqual({
            kind: 'hidden'
        });
    });

    it('hides without a draft, when empty or on fetch error', () => {
        expect(resolveNeedsPlanBannerView({ ...base, hasDraftProperty: false })).toEqual({
            kind: 'hidden'
        });
        expect(resolveNeedsPlanBannerView({ ...base, isEmpty: true })).toEqual({ kind: 'hidden' });
        expect(resolveNeedsPlanBannerView({ ...base, fetchError: true })).toEqual({
            kind: 'hidden'
        });
    });
});
