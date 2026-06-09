/**
 * @file usage-badge.test.ts
 * @description Unit tests for the host usage-badge helpers.
 *
 * Covers two production regressions:
 *  - Bug 1 (envelope): the API wraps responses in `{ success, data }`. The old
 *    code read `response.maxAllowed` (always undefined), making the badge dead.
 *    Fixed by reading `response.data.maxAllowed`.
 *  - Bug 2 (limit-key casing): the API validates the path param against
 *    `z.nativeEnum(LimitKey)` which accepts only the enum VALUE ('max_accommodations'),
 *    not the enum NAME ('MAX_ACCOMMODATIONS'). The old code hard-coded the uppercase
 *    name, causing HTTP 400. Fixed by using the imported const.
 */

import { describe, expect, it } from 'vitest';
import {
    MAX_ACCOMMODATIONS_LIMIT_KEY,
    parseUsageResponse
} from '../../../src/lib/host/usage-badge';

// ---------------------------------------------------------------------------
// MAX_ACCOMMODATIONS_LIMIT_KEY — Bug 2 regression
// ---------------------------------------------------------------------------

describe('MAX_ACCOMMODATIONS_LIMIT_KEY', () => {
    it('equals the lowercase enum value (bug-2 regression: must NOT be uppercase)', () => {
        // Arrange — expected value matches LimitKey.MAX_ACCOMMODATIONS = 'max_accommodations'
        // Act & Assert
        expect(MAX_ACCOMMODATIONS_LIMIT_KEY).toBe('max_accommodations');
    });
});

// ---------------------------------------------------------------------------
// parseUsageResponse — Bug 1 regression + edge cases
// ---------------------------------------------------------------------------

describe('parseUsageResponse', () => {
    // ── Happy path ────────────────────────────────────────────────────────────

    it('parses the real API envelope { success, data: { ... } } (bug-1 regression)', () => {
        // Arrange
        const json = {
            success: true,
            data: { currentUsage: 2, maxAllowed: 5, threshold: 'warning' }
        };

        // Act
        const result = parseUsageResponse({ json });

        // Assert
        expect(result).toEqual({ currentUsage: 2, maxAllowed: 5, threshold: 'warning' });
    });

    it('defaults currentUsage to 0 when missing inside data', () => {
        // Arrange
        const json = { success: true, data: { maxAllowed: 10 } };

        // Act
        const result = parseUsageResponse({ json });

        // Assert
        expect(result).not.toBeNull();
        expect(result?.currentUsage).toBe(0);
        expect(result?.maxAllowed).toBe(10);
    });

    it('defaults threshold to "ok" when missing inside data', () => {
        // Arrange
        const json = { success: true, data: { currentUsage: 1, maxAllowed: 3 } };

        // Act
        const result = parseUsageResponse({ json });

        // Assert
        expect(result).not.toBeNull();
        expect(result?.threshold).toBe('ok');
    });

    // ── Bug-1 regression: old unwrapped shape must return null ────────────────

    it('returns null for the old unwrapped shape { currentUsage, maxAllowed } (bug-1 regression)', () => {
        // Arrange — this was the shape the old code expected (missing .data wrapper)
        const json = { currentUsage: 2, maxAllowed: 5 };

        // Act
        const result = parseUsageResponse({ json });

        // Assert — must be null because json.data is missing
        expect(result).toBeNull();
    });

    // ── Null / empty / invalid inputs ─────────────────────────────────────────

    it('returns null when data is null', () => {
        // Arrange
        const json = { success: true, data: null };

        // Act & Assert
        expect(parseUsageResponse({ json })).toBeNull();
    });

    it('returns null for an empty object {}', () => {
        // Arrange & Act & Assert
        expect(parseUsageResponse({ json: {} })).toBeNull();
    });

    it('returns null for a non-object input (string)', () => {
        // Arrange & Act & Assert
        expect(parseUsageResponse({ json: 'not an object' })).toBeNull();
    });

    it('returns null for a non-object input (number)', () => {
        // Arrange & Act & Assert
        expect(parseUsageResponse({ json: 42 })).toBeNull();
    });

    it('returns null for null input', () => {
        // Arrange & Act & Assert
        expect(parseUsageResponse({ json: null })).toBeNull();
    });

    it('returns null when data.maxAllowed is missing', () => {
        // Arrange
        const json = { success: true, data: { currentUsage: 1 } };

        // Act & Assert
        expect(parseUsageResponse({ json })).toBeNull();
    });

    it('returns null when data.maxAllowed is a non-number (string)', () => {
        // Arrange
        const json = { success: true, data: { maxAllowed: '5', currentUsage: 1 } };

        // Act & Assert
        expect(parseUsageResponse({ json })).toBeNull();
    });

    it('returns null when data is an array (not a plain object)', () => {
        // Arrange
        const json = { success: true, data: [1, 2, 3] };

        // Act & Assert
        expect(parseUsageResponse({ json })).toBeNull();
    });
});
