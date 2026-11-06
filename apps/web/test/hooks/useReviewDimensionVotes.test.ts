/**
 * @file useReviewDimensionVotes.test.ts
 * @description Unit tests for the optional dimension vote state (HOS-1866 /
 * 6.6, AC:6:10). A vote is a toggle, and `reset` clears the whole map so a
 * reopened dialog never carries a stale value.
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useReviewDimensionVotes } from '@/hooks/useReviewDimensionVotes';

describe('useReviewDimensionVotes', () => {
    it('starts with no votes', () => {
        const { result } = renderHook(() => useReviewDimensionVotes());

        expect(result.current.votes).toEqual({});
    });

    it('sets a vote for one dimension', () => {
        const { result } = renderHook(() => useReviewDimensionVotes());

        act(() => result.current.setVote('service', 4));

        expect(result.current.votes).toEqual({ service: 4 });
    });

    it('toggles the current vote off instead of getting stuck', () => {
        const { result } = renderHook(() => useReviewDimensionVotes());

        act(() => result.current.setVote('service', 4));
        act(() => result.current.setVote('service', 4));

        expect(result.current.votes).toEqual({});
    });

    it('replaces one dimension without touching the others', () => {
        const { result } = renderHook(() => useReviewDimensionVotes());

        act(() => result.current.setVote('service', 4));
        act(() => result.current.setVote('ambiance', 3));
        act(() => result.current.setVote('service', 2));

        expect(result.current.votes).toEqual({ service: 2, ambiance: 3 });
    });

    it('resets every vote', () => {
        const { result } = renderHook(() => useReviewDimensionVotes());

        act(() => result.current.setVote('service', 4));
        act(() => result.current.setVote('ambiance', 3));
        act(() => result.current.reset());

        expect(result.current.votes).toEqual({});
    });
});
