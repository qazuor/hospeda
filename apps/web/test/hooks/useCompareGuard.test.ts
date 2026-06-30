/**
 * @file useCompareGuard.test.ts
 * @description Tests for the compare entitlement + limit guard (SPEC-288 T-007).
 *
 * Two layers:
 * 1. {@link evaluateCompareAdd} — pure guard logic across free / Plus(2) /
 *    VIP(4) plus defensive handling of non-finite / non-positive limits.
 * 2. {@link useCompareGuard} — the hook wiring (store + entitlements) with
 *    `useMyEntitlements` mocked so no network is touched.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    COMPARE_ENTITLEMENT_KEY,
    COMPARE_LIMIT_KEY,
    type EvaluateCompareAddParams,
    evaluateCompareAdd,
    useCompareGuard
} from '../../src/hooks/useCompareGuard';
import { clearCompare, getSnapshot } from '../../src/store/compare-store';

// ---------------------------------------------------------------------------
// Mock useMyEntitlements (mutable per-test value, hoist-safe)
// ---------------------------------------------------------------------------

const mockEntitlements = vi.hoisted(() => ({
    value: {
        has: (_key: string) => false,
        limit: (_key: string) => -1,
        plan: null,
        isLoading: false,
        error: null as Error | null
    }
}));

vi.mock('../../src/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => mockEntitlements.value
}));

/** Build a fake entitlements return for a plan with a given compare cap. */
function asPlan(maxItems: number, isLoading = false) {
    mockEntitlements.value = {
        has: (key: string) => key === COMPARE_ENTITLEMENT_KEY,
        limit: (key: string) => (key === COMPARE_LIMIT_KEY ? maxItems : -1),
        plan: null,
        isLoading,
        error: null
    };
}

/** Build a fake entitlements return for a user without the comparison gate. */
function asFree(isLoading = false) {
    mockEntitlements.value = {
        has: (_key: string) => false,
        limit: (_key: string) => -1,
        plan: null,
        isLoading,
        error: null
    };
}

// ---------------------------------------------------------------------------
// Pure logic: evaluateCompareAdd
// ---------------------------------------------------------------------------

describe('evaluateCompareAdd', () => {
    const base: EvaluateCompareAddParams = {
        canCompare: true,
        maxItems: 2,
        currentCount: 0
    };

    it('denies with upsell when the plan lacks the entitlement (free)', () => {
        // Arrange / Act
        const result = evaluateCompareAdd({ ...base, canCompare: false });

        // Assert
        expect(result).toEqual({ allowed: false, reason: 'upsell' });
    });

    it('allows adds below the Plus cap (2)', () => {
        expect(evaluateCompareAdd({ canCompare: true, maxItems: 2, currentCount: 0 })).toEqual({
            allowed: true,
            reason: null
        });
        expect(evaluateCompareAdd({ canCompare: true, maxItems: 2, currentCount: 1 })).toEqual({
            allowed: true,
            reason: null
        });
    });

    it('denies with limit at the Plus cap (2)', () => {
        expect(evaluateCompareAdd({ canCompare: true, maxItems: 2, currentCount: 2 })).toEqual({
            allowed: false,
            reason: 'limit'
        });
    });

    it('allows up to the VIP cap (4) and denies at it', () => {
        expect(evaluateCompareAdd({ canCompare: true, maxItems: 4, currentCount: 3 })).toEqual({
            allowed: true,
            reason: null
        });
        expect(evaluateCompareAdd({ canCompare: true, maxItems: 4, currentCount: 4 })).toEqual({
            allowed: false,
            reason: 'limit'
        });
    });

    it('treats -1 (unlimited sentinel) defensively as limit', () => {
        expect(evaluateCompareAdd({ canCompare: true, maxItems: -1, currentCount: 0 })).toEqual({
            allowed: false,
            reason: 'limit'
        });
    });

    it('treats 0 and NaN limits defensively as limit', () => {
        expect(evaluateCompareAdd({ canCompare: true, maxItems: 0, currentCount: 0 })).toEqual({
            allowed: false,
            reason: 'limit'
        });
        expect(
            evaluateCompareAdd({ canCompare: true, maxItems: Number.NaN, currentCount: 0 })
        ).toEqual({ allowed: false, reason: 'limit' });
    });
});

// ---------------------------------------------------------------------------
// Hook: useCompareGuard
// ---------------------------------------------------------------------------

describe('useCompareGuard', () => {
    beforeEach(() => {
        clearCompare();
        localStorage.clear();
        asFree();
    });

    afterEach(() => {
        // Wrap in act(): clearCompare emits to any still-mounted hook subscriber.
        act(() => {
            clearCompare();
        });
        localStorage.clear();
    });

    it('free user: toggle is blocked with upsell and store stays empty', () => {
        // Arrange
        asFree();
        const { result } = renderHook(() => useCompareGuard());

        // Act
        let outcome: ReturnType<typeof result.current.toggle> | undefined;
        act(() => {
            outcome = result.current.toggle('acc-1');
        });

        // Assert
        expect(outcome).toEqual({ action: 'blocked', reason: 'upsell' });
        expect(getSnapshot().ids).toEqual([]);
        expect(result.current.canCompare).toBe(false);
    });

    it('Plus(2): adds two, blocks the third with limit, reports isFull', async () => {
        // Arrange
        asPlan(2);
        const { result } = renderHook(() => useCompareGuard());

        // Act — first two adds succeed (one re-render per mutation)
        let first: ReturnType<typeof result.current.toggle> | undefined;
        let second: ReturnType<typeof result.current.toggle> | undefined;
        let third: ReturnType<typeof result.current.toggle> | undefined;
        await act(async () => {
            first = result.current.toggle('acc-1');
        });
        await act(async () => {
            second = result.current.toggle('acc-2');
        });
        await act(async () => {
            third = result.current.toggle('acc-3');
        });

        // Assert
        expect(first?.action).toBe('added');
        expect(second?.action).toBe('added');
        expect(third).toEqual({ action: 'blocked', reason: 'limit' });
        expect(result.current.count).toBe(2);
        expect(result.current.isFull).toBe(true);
        expect(getSnapshot().ids).toEqual(['acc-1', 'acc-2']);
    });

    it('VIP(4): allows four and blocks the fifth with limit', async () => {
        // Arrange
        asPlan(4);
        const { result } = renderHook(() => useCompareGuard());

        // Act — add four, one re-render per mutation so `count` stays fresh
        for (const id of ['a', 'b', 'c', 'd']) {
            await act(async () => {
                result.current.toggle(id);
            });
        }
        let fifth: ReturnType<typeof result.current.toggle> | undefined;
        await act(async () => {
            fifth = result.current.toggle('e');
        });

        // Assert
        expect(result.current.count).toBe(4);
        expect(fifth).toEqual({ action: 'blocked', reason: 'limit' });
        expect(result.current.isFull).toBe(true);
    });

    it('toggle removes an already-selected item (always allowed)', () => {
        // Arrange
        asPlan(2);
        const { result } = renderHook(() => useCompareGuard());
        act(() => {
            result.current.toggle('acc-1');
        });
        expect(result.current.isInList('acc-1')).toBe(true);

        // Act — toggle again removes it
        let removed: ReturnType<typeof result.current.toggle> | undefined;
        act(() => {
            removed = result.current.toggle('acc-1');
        });

        // Assert
        expect(removed).toEqual({ action: 'removed', reason: null });
        expect(getSnapshot().ids).toEqual([]);
    });
});
