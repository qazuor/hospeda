/**
 * @file useReviewDimensionVotes.ts
 * @description Optional per-dimension votes for the venue review form
 * (HOS-1866 / 6.6, AC:6:10).
 *
 * A vote is a toggle: tapping the star already chosen clears that dimension, so
 * an optional dimension can never get stuck on a value the visitor no longer
 * wants to give. Unvoted dimensions are absent from `votes`, which is exactly
 * what `buildReviewRatingPayload` and the server schema expect (DEC-FAC-071).
 */

import { useCallback, useState } from 'react';
import type { ReviewDimensionVotes } from '@/lib/venue/review-dimensions-view';

/** State and actions returned by {@link useReviewDimensionVotes}. */
export interface ReviewDimensionVotesState {
    /** Current votes, keyed by dimension id. An absent key means no vote. */
    readonly votes: ReviewDimensionVotes;
    /**
     * Toggles one dimension: sets `value`, or clears it when it is already the
     * current vote.
     */
    readonly setVote: (dimensionId: string, value: number) => void;
    /** Clears every vote (the form calls this when it closes). */
    readonly reset: () => void;
}

/**
 * Tracks the optional dimension votes of one review form.
 *
 * @returns The current votes plus the toggle and reset actions.
 */
export function useReviewDimensionVotes(): ReviewDimensionVotesState {
    const [votes, setVotes] = useState<ReviewDimensionVotes>({});

    const setVote = useCallback((dimensionId: string, value: number) => {
        setVotes((current) => {
            if (current[dimensionId] === value) {
                const next: Record<string, number> = { ...current };
                delete next[dimensionId];
                return next;
            }
            return { ...current, [dimensionId]: value };
        });
    }, []);

    const reset = useCallback(() => setVotes({}), []);

    return { votes, setVote, reset };
}
