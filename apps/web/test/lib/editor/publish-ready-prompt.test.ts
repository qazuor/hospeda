/**
 * @file publish-ready-prompt.test.ts
 * @description The post-save "your listing is ready" prompt (HOS-1183, second
 * owner request).
 *
 * The rule is a transition, so every test names both sides of it. A suite that
 * only varied the AFTER state would pass with the BEFORE check deleted — and
 * that check is the entire "only once" guarantee.
 */

import type { AccommodationPublishReadinessInput } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { shouldPromptPublishReady } from '@/lib/editor/publish-ready-prompt';

/** A listing meeting every blocking requirement. */
const READY: AccommodationPublishReadinessInput = {
    capacity: 4,
    minNights: 1,
    bedrooms: 2,
    bathrooms: 1,
    hasMainImage: true
};

/** The same listing, one requirement short. */
const MISSING_BATHROOMS: AccommodationPublishReadinessInput = { ...READY, bathrooms: null };
const MISSING_PHOTO: AccommodationPublishReadinessInput = { ...READY, hasMainImage: false };

/** Everything true except what a test varies. */
function input(overrides: Partial<Parameters<typeof shouldPromptPublishReady>[0]> = {}) {
    return {
        before: MISSING_BATHROOMS,
        after: READY,
        isDraft: true,
        canPublish: true,
        ...overrides
    };
}

describe('shouldPromptPublishReady', () => {
    it('prompts on the save that completes the last missing requirement', () => {
        expect(shouldPromptPublishReady(input())).toBe(true);
    });

    it('prompts when the last missing requirement was the main photo', () => {
        // The realistic ending: hosts fill text first and upload photos last,
        // so this transition happens in the photo flow rather than a form save.
        expect(shouldPromptPublishReady(input({ before: MISSING_PHOTO, after: READY }))).toBe(true);
    });

    describe('it fires once, because a line is crossed once', () => {
        it('does not prompt again on a later save of an already-complete draft', () => {
            // The whole "only the first time" guarantee, and the assertion that
            // fails if the BEFORE check is dropped.
            expect(shouldPromptPublishReady(input({ before: READY, after: READY }))).toBe(false);
        });

        it('does not prompt on a save that leaves the listing still incomplete', () => {
            // Offering "Publicar ahora" here would open a dialog promising the
            // listing goes live and fail on confirm — H-99, one screen over.
            expect(
                shouldPromptPublishReady(input({ before: MISSING_PHOTO, after: MISSING_PHOTO }))
            ).toBe(false);
        });

        it('does not prompt on a save that BREAKS readiness', () => {
            // Clearing bathrooms on a complete draft. `after` decides, so the
            // direction of travel cannot be read backwards.
            expect(
                shouldPromptPublishReady(input({ before: READY, after: MISSING_BATHROOMS }))
            ).toBe(false);
        });
    });

    describe('states with nothing to offer', () => {
        it('does not prompt on a listing that is already live', () => {
            expect(shouldPromptPublishReady(input({ isDraft: false }))).toBe(false);
        });

        it('does not prompt when the server would refuse the publish', () => {
            // `subscription_required`. The issue asks for a dialog offering the
            // publish CTA, and here there is none to offer; the card already
            // links to the plans page.
            expect(shouldPromptPublishReady(input({ canPublish: false }))).toBe(false);
        });

        it('needs BOTH gates, not either', () => {
            // Guards against a future `||` where the `&&` belongs: each gate
            // alone must still suppress the prompt.
            expect(shouldPromptPublishReady(input({ isDraft: false, canPublish: true }))).toBe(
                false
            );
            expect(shouldPromptPublishReady(input({ isDraft: true, canPublish: false }))).toBe(
                false
            );
        });
    });

    it('treats a zero as an answered requirement, not a missing one', () => {
        // A studio with `bathrooms: 0` is a real answer. If readiness were
        // computed by truthiness this transition would never complete and the
        // prompt would never fire for them — the same class of bug as H-94,
        // where a filled field was reported missing.
        const studioBefore = { ...READY, bathrooms: null, minNights: 0 };
        const studioAfter = { ...READY, bathrooms: 0, minNights: 0 };
        expect(shouldPromptPublishReady(input({ before: studioBefore, after: studioAfter }))).toBe(
            true
        );
    });
});
