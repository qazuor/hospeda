/**
 * Unit tests for filterAccommodationListByOwnerEntitlements (SPEC-291 Phase 3b).
 *
 * This is a pure synchronous function — no mocks required. Tests verify the
 * gate rules described in the JSDoc:
 *   - Owner HAS HAS_VERIFICATION_BADGE + isVerified=true → isVerified stays true.
 *   - Owner LACKS HAS_VERIFICATION_BADGE + isVerified=true → isVerified forced false.
 *   - isVerified=false regardless of owner entitlements → stays false.
 *   - Owner absent from map + isVerified=true → isVerified forced false (fail-closed).
 *   - Item has no ownerId + isVerified=true → isVerified forced false (fail-closed).
 *
 * All assertions are UNCONDITIONAL — no conditional guards around expects.
 *
 * @module test/utils/entitlement-filter-owner-batch
 */

import { EntitlementKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';
import { filterAccommodationListByOwnerEntitlements } from '../../src/utils/entitlement-filter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER_WITH_BADGE = 'aaaa0001-0000-4000-8000-000000000001';
const OWNER_WITHOUT_BADGE = 'aaaa0002-0000-4000-8000-000000000002';

/** Build a minimal AccommodationData-compatible object. */
function makeItem(
    overrides: Partial<{
        id: string;
        ownerId: string;
        isVerified: boolean;
    }>
): Record<string, unknown> {
    return {
        id: 'item-default',
        ownerId: OWNER_WITH_BADGE,
        isVerified: false,
        name: 'Test Accommodation',
        ...overrides
    };
}

/** Map with OWNER_WITH_BADGE having the badge and OWNER_WITHOUT_BADGE not. */
function makeEntitlementMap(): Map<string, readonly EntitlementKey[]> {
    return new Map([
        [OWNER_WITH_BADGE, [EntitlementKey.HAS_VERIFICATION_BADGE]],
        [OWNER_WITHOUT_BADGE, []]
    ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('filterAccommodationListByOwnerEntitlements', () => {
    it('preserves isVerified=true when owner HAS HAS_VERIFICATION_BADGE', () => {
        const items = [makeItem({ id: 'acc-1', ownerId: OWNER_WITH_BADGE, isVerified: true })];
        const entMap = makeEntitlementMap();

        const result = filterAccommodationListByOwnerEntitlements(
            items as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.isVerified).toBe(true);
    });

    it('forces isVerified=false when owner LACKS HAS_VERIFICATION_BADGE', () => {
        const items = [makeItem({ id: 'acc-2', ownerId: OWNER_WITHOUT_BADGE, isVerified: true })];
        const entMap = makeEntitlementMap();

        const result = filterAccommodationListByOwnerEntitlements(
            items as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.isVerified).toBe(false);
    });

    it('leaves isVerified=false unchanged regardless of owner entitlements', () => {
        const items = [makeItem({ id: 'acc-3', ownerId: OWNER_WITH_BADGE, isVerified: false })];
        const entMap = makeEntitlementMap();

        const result = filterAccommodationListByOwnerEntitlements(
            items as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.isVerified).toBe(false);
    });

    it('forces isVerified=false when owner is ABSENT from the entitlements map (fail-closed)', () => {
        const items = [
            makeItem({ id: 'acc-4', ownerId: 'unknown-owner-not-in-map', isVerified: true })
        ];
        const entMap = makeEntitlementMap(); // does not contain 'unknown-owner-not-in-map'

        const result = filterAccommodationListByOwnerEntitlements(
            items as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.isVerified).toBe(false);
    });

    it('forces isVerified=false when item has no ownerId field (fail-closed)', () => {
        const item = { id: 'acc-5', isVerified: true, name: 'No owner' };
        const entMap = makeEntitlementMap();

        const result = filterAccommodationListByOwnerEntitlements(
            [item] as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        expect(result).toHaveLength(1);
        expect(result[0]?.isVerified).toBe(false);
    });

    it('handles a mixed list correctly — each item gated independently', () => {
        const items = [
            makeItem({ id: 'acc-a', ownerId: OWNER_WITH_BADGE, isVerified: true }),
            makeItem({ id: 'acc-b', ownerId: OWNER_WITHOUT_BADGE, isVerified: true }),
            makeItem({ id: 'acc-c', ownerId: OWNER_WITH_BADGE, isVerified: false }),
            makeItem({ id: 'acc-d', ownerId: 'absent-owner', isVerified: true })
        ];
        const entMap = makeEntitlementMap();

        const result = filterAccommodationListByOwnerEntitlements(
            items as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        expect(result).toHaveLength(4);
        // Owner A has badge + verified → stays true
        expect(result[0]?.isVerified).toBe(true);
        // Owner B lacks badge + verified → forced false
        expect(result[1]?.isVerified).toBe(false);
        // Owner A has badge but not verified → stays false
        expect(result[2]?.isVerified).toBe(false);
        // Owner absent from map + verified → forced false
        expect(result[3]?.isVerified).toBe(false);
    });

    it('returns an empty array when given an empty input', () => {
        const result = filterAccommodationListByOwnerEntitlements([], new Map());
        expect(result).toHaveLength(0);
    });

    it('does NOT mutate the input items', () => {
        const originalItem = makeItem({
            id: 'acc-m',
            ownerId: OWNER_WITHOUT_BADGE,
            isVerified: true
        });
        const items = [originalItem];
        const entMap = makeEntitlementMap();

        filterAccommodationListByOwnerEntitlements(
            items as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        // Original object was not mutated — still has isVerified=true
        expect(originalItem.isVerified).toBe(true);
    });

    it('returns the same reference for items already isVerified=false (no unnecessary allocation)', () => {
        const originalItem = makeItem({
            id: 'acc-ref',
            ownerId: OWNER_WITH_BADGE,
            isVerified: false
        });
        const items = [originalItem];
        const entMap = makeEntitlementMap();

        const result = filterAccommodationListByOwnerEntitlements(
            items as Parameters<typeof filterAccommodationListByOwnerEntitlements>[0],
            entMap
        );

        // The same object reference is returned when isVerified is already false
        expect(result[0]).toBe(originalItem);
    });
});
