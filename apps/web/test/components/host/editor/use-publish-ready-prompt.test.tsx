/**
 * @file use-publish-ready-prompt.test.tsx
 * @description The editor's post-save publish prompt reads the server's publish
 * decision (`subscribe-destination`) and opens only when publishing would
 * succeed (HOS-1668).
 *
 * The local transition is made to pass with real `shouldPromptPublishReady`
 * fixtures (a draft whose last missing requirement was just filled), so every
 * case below varies only the destination the server answers.
 */

import type { AccommodationPublishReadinessInput } from '@repo/schemas';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublishReadyPrompt } from '@/components/host/editor/use-publish-ready-prompt';

const subscribeDestination = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({ publishApi: { subscribeDestination } }));

/** A listing meeting every blocking requirement. */
const READY: AccommodationPublishReadinessInput = {
    description: 'A real accommodation description with enough detail.',
    capacity: 4,
    minNights: 1,
    bedrooms: 2,
    bathrooms: 1,
    hasMainImage: true
};

/** The same listing, one requirement short. */
const MISSING_BATHROOMS: AccommodationPublishReadinessInput = { ...READY, bathrooms: null };

/** Renders the hook and evaluates the save that completes the listing. */
async function evaluateCompletingSave() {
    const { result } = renderHook(() => usePublishReadyPrompt());
    await act(async () => {
        await result.current.evaluate({ before: MISSING_BATHROOMS, after: READY, isDraft: true });
    });
    return result;
}

beforeEach(() => vi.clearAllMocks());

describe('usePublishReadyPrompt (HOS-1668)', () => {
    // HOS-1668 C-1: PUBLISH publishes and starts the trial, so the dialog opens
    // and announces it.
    it('opens with startsTrial when the destination is PUBLISH', async () => {
        subscribeDestination.mockResolvedValue({
            ok: true,
            data: { destination: 'PUBLISH', trialDays: 14 }
        });

        const result = await evaluateCompletingSave();

        expect(subscribeDestination).toHaveBeenCalledWith({ vertical: 'accommodation' });
        expect(result.current.isOpen).toBe(true);
        expect(result.current.startsTrial).toBe(true);
    });

    // HOS-1668 C-1: COVERED publishes without a trial.
    it('opens without startsTrial when the destination is COVERED', async () => {
        subscribeDestination.mockResolvedValue({ ok: true, data: { destination: 'COVERED' } });

        const result = await evaluateCompletingSave();

        expect(result.current.isOpen).toBe(true);
        expect(result.current.startsTrial).toBe(false);
    });

    // HOS-1668 C-1: CHECKOUT and NO_PLANS_AVAILABLE are rejected by the server,
    // so the dialog never offers to publish.
    it.each([
        { destination: 'CHECKOUT', reason: 'TRIAL_DAYS_NOT_POSITIVE' },
        { destination: 'NO_PLANS_AVAILABLE' }
    ])('does not open when the destination is $destination', async (data) => {
        subscribeDestination.mockResolvedValue({ ok: true, data });

        const result = await evaluateCompletingSave();

        expect(result.current.isOpen).toBe(false);
        expect(result.current.startsTrial).toBe(false);
    });

    // HOS-1668 C-2: a failed read never opens the dialog.
    it('does not open when the destination read fails', async () => {
        subscribeDestination.mockResolvedValue({
            ok: false,
            error: { status: 500, message: 'failure' }
        });

        const result = await evaluateCompletingSave();

        expect(subscribeDestination).toHaveBeenCalledTimes(1);
        expect(result.current.isOpen).toBe(false);
        expect(result.current.startsTrial).toBe(false);
    });

    // The local half short-circuits before any request.
    it('does not read the destination when the save does not complete the listing', async () => {
        const { result } = renderHook(() => usePublishReadyPrompt());
        await act(async () => {
            await result.current.evaluate({ before: READY, after: READY, isDraft: true });
        });

        expect(subscribeDestination).not.toHaveBeenCalled();
        expect(result.current.isOpen).toBe(false);
    });
});
