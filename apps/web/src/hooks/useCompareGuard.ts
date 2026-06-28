/**
 * @file useCompareGuard.ts
 * @description Client-side entitlement + limit enforcement for accommodation
 * comparison (SPEC-288).
 *
 * Combines the global {@link useCompareStore} selection state with the user's
 * plan entitlements ({@link useMyEntitlements}) so the UI can:
 * - know whether comparison is available at all (`canCompare`), and
 * - block adding a new accommodation once the per-plan cap is reached.
 *
 * The core decision is exposed as a pure function ({@link evaluateCompareAdd})
 * so it can be unit-tested per plan without React or network mocking. The hook
 * is a thin wrapper that feeds live store + entitlement values into it.
 *
 * This is a UX guard only. The server re-validates the same limit in the
 * POST /protected/accommodations/compare handler (D-3 defence-in-depth).
 *
 * @module hooks/useCompareGuard
 */

import {
    addToCompare,
    isInCompare,
    removeFromCompare,
    useCompareStore
} from '@/store/compare-store';
import { useCallback } from 'react';
import { useMyEntitlements } from './useMyEntitlements';

// ---------------------------------------------------------------------------
// Keys (must match @repo/billing EntitlementKey / LimitKey string values)
// ---------------------------------------------------------------------------

/** Entitlement key gating the comparison feature. */
export const COMPARE_ENTITLEMENT_KEY = 'can_compare_accommodations' as const;
/** Limit key holding the per-plan maximum number of comparable items. */
export const COMPARE_LIMIT_KEY = 'max_compare_items' as const;

// ---------------------------------------------------------------------------
// Pure guard logic
// ---------------------------------------------------------------------------

/**
 * Why a comparison add was denied.
 * - `'upsell'`: the plan lacks the comparison entitlement (free / anonymous).
 * - `'limit'`: the entitlement is present but the per-plan cap is reached.
 */
export type CompareDenyReason = 'upsell' | 'limit';

/** Result of evaluating whether an accommodation may be added to compare. */
export interface CompareAddEvaluation {
    /** Whether the add is allowed. */
    readonly allowed: boolean;
    /** Denial reason when `allowed` is false; `null` otherwise. */
    readonly reason: CompareDenyReason | null;
}

/** Inputs for {@link evaluateCompareAdd}. */
export interface EvaluateCompareAddParams {
    /** Whether the current plan includes the comparison entitlement. */
    readonly canCompare: boolean;
    /** Per-plan maximum number of comparable items (from `limit()`). */
    readonly maxItems: number;
    /** How many accommodations are already selected. */
    readonly currentCount: number;
}

/**
 * Decide whether one more accommodation can be added to the comparison list.
 *
 * Order of checks:
 * 1. No entitlement (free, anonymous, or still loading — entitlements
 *    fail-closed) -> `'upsell'`.
 * 2. A non-finite or non-positive `maxItems` is treated defensively as "no
 *    room". The comparison matrix cannot render an unbounded set, so the
 *    `-1` (unlimited) sentinel, `0`, and `NaN` all deny with `'limit'` rather
 *    than allowing infinite columns. Every plan that ships the entitlement has
 *    a finite cap (Plus=2, VIP=4 per SPEC-288 D-1), so this path only triggers
 *    on a misconfiguration.
 * 3. At or above the cap -> `'limit'`.
 *
 * @param params - {@link EvaluateCompareAddParams}.
 * @returns {@link CompareAddEvaluation}.
 */
export function evaluateCompareAdd({
    canCompare,
    maxItems,
    currentCount
}: EvaluateCompareAddParams): CompareAddEvaluation {
    if (!canCompare) {
        return { allowed: false, reason: 'upsell' };
    }
    if (!Number.isFinite(maxItems) || maxItems < 1) {
        return { allowed: false, reason: 'limit' };
    }
    if (currentCount >= maxItems) {
        return { allowed: false, reason: 'limit' };
    }
    return { allowed: true, reason: null };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Outcome of a {@link UseCompareGuardReturn.toggle} call. */
export interface CompareToggleResult {
    /** What happened: item added, item removed, or add blocked by the guard. */
    readonly action: 'added' | 'removed' | 'blocked';
    /** Denial reason when `action` is `'blocked'`; `null` otherwise. */
    readonly reason: CompareDenyReason | null;
}

/** Return shape of {@link useCompareGuard}. */
export interface UseCompareGuardReturn {
    /** Currently selected accommodation IDs (compare-store snapshot). */
    readonly ids: readonly string[];
    /** Number of selected accommodations. */
    readonly count: number;
    /** Whether the current plan includes the comparison entitlement. */
    readonly canCompare: boolean;
    /** Per-plan maximum number of comparable items. */
    readonly maxItems: number;
    /** Whether the selection is at the per-plan cap (no more adds allowed). */
    readonly isFull: boolean;
    /** Whether entitlements are still loading (UI should defer upsell/limit). */
    readonly isLoading: boolean;
    /** Whether a given accommodation is currently in the comparison list. */
    readonly isInList: (id: string) => boolean;
    /**
     * Toggle an accommodation in the comparison list.
     * Removal is always allowed; adding is subject to {@link evaluateCompareAdd}.
     */
    readonly toggle: (id: string) => CompareToggleResult;
}

/**
 * React hook combining compare-store selection with plan entitlements to
 * enforce the comparison feature gate and per-plan item cap client-side.
 *
 * @returns {@link UseCompareGuardReturn}.
 *
 * @example
 * ```tsx
 * const { toggle, isInList, canCompare } = useCompareGuard();
 * const result = toggle(accommodationId);
 * if (result.action === 'blocked') {
 *   showMessage(result.reason === 'upsell' ? upsellCopy : limitCopy);
 * }
 * ```
 */
export function useCompareGuard(): UseCompareGuardReturn {
    const { ids } = useCompareStore();
    const { has, limit, isLoading } = useMyEntitlements();

    const canCompare = has(COMPARE_ENTITLEMENT_KEY);
    const maxItems = limit(COMPARE_LIMIT_KEY);
    const count = ids.length;
    const isFull = canCompare && Number.isFinite(maxItems) && maxItems >= 1 && count >= maxItems;

    const toggle = useCallback(
        (id: string): CompareToggleResult => {
            if (isInCompare(id)) {
                removeFromCompare(id);
                return { action: 'removed', reason: null };
            }
            const evaluation = evaluateCompareAdd({
                canCompare,
                maxItems,
                currentCount: count
            });
            if (!evaluation.allowed) {
                return { action: 'blocked', reason: evaluation.reason };
            }
            addToCompare(id);
            return { action: 'added', reason: null };
        },
        [canCompare, maxItems, count]
    );

    const isInListFn = useCallback((id: string) => ids.includes(id), [ids]);

    return {
        ids,
        count,
        canCompare,
        maxItems,
        isFull,
        isLoading,
        isInList: isInListFn,
        toggle
    };
}
