/**
 * @file publish-trial-callout.test.ts
 * @description The hero trial callout on `/publicar/` (HOS-1183 F-6).
 *
 * F-6 is a three-way state read through one boolean, so the tests are organised
 * by OWNER rather than by input: the bug was invisible to every
 * expiry-shaped assertion, because `isExpired` is `false` for the owner it
 * affected.
 */

import { describe, expect, it } from 'vitest';
import { shouldShowPublishTrialCallout } from '@/lib/host/publish-trial-callout';

describe('shouldShowPublishTrialCallout', () => {
    it('shows the callout to a signed-out visitor (AC-18)', () => {
        // The page's largest audience, and the callout is its main draw.
        // Unresolved eligibility must not read as "not eligible".
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: false, trialEligibility: null })
        ).toBe(true);
    });

    it('shows the callout to an owner who would actually get a trial', () => {
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: false, trialEligibility: true })
        ).toBe(true);
    });

    it('hides the callout from an owner on an active paid plan (AC-17)', () => {
        // THE F-6 case. `isExpired` is false for this owner — they never had a
        // trial expire — so every expiry-shaped assertion passes while the bug
        // is present. Measured live: this owner saw "Probá Hospeda gratis por
        // 30 días" directly above "Llegaste al límite de tu plan".
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: false, trialEligibility: false })
        ).toBe(false);
    });

    it('hides the callout from an owner whose trial converted', () => {
        // Same shape as the paid-plan owner and reached differently: they DID
        // have a trial, it just never expired — it became a subscription.
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: false, trialEligibility: false })
        ).toBe(false);
    });

    it('leaves the expired-trial branch untouched (AC-19)', () => {
        // An expired trial has its own block on the page. F-6 is about the
        // state that fell through NEITHER branch, so this one must not move.
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: true, trialEligibility: null })
        ).toBe(false);
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: true, trialEligibility: true })
        ).toBe(false);
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: true, trialEligibility: false })
        ).toBe(false);
    });

    it('lets expiry win over eligibility, never the other way round', () => {
        // The one combination that pins the precedence: an expired trial plus a
        // (contradictory) eligible verdict must still render the expired block,
        // not two competing offers.
        expect(
            shouldShowPublishTrialCallout({ isTrialExpired: true, trialEligibility: true })
        ).toBe(false);
    });
});
