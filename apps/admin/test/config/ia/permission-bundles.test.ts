/**
 * Tests for permission-bundles.ts — expandPermissions (T-011)
 *
 * Covers:
 * - Universal wildcard ('*') expands to the full PermissionEnum value set
 * - Prefix wildcard ('FOO_*') expands to all matching enum members
 * - Exact expression resolves to the single matching enum value
 * - Unknown exact expression throws Error
 * - Unknown prefix wildcard (no matches) throws Error
 * - Overlapping expressions produce no duplicates
 * - Empty input returns empty array
 */

import { expandPermissions } from '@/config/ia/permission-bundles';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_PERMISSION_VALUES = Object.values(PermissionEnum);

// All PermissionEnum keys that start with ACCOMMODATION_
const ACCOMMODATION_VALUES = Object.entries(PermissionEnum)
    .filter(([key]) => key.startsWith('ACCOMMODATION_'))
    .map(([, value]) => value as PermissionEnum);

// All PermissionEnum keys that start with CONVERSATION_
const CONVERSATION_VALUES = Object.entries(PermissionEnum)
    .filter(([key]) => key.startsWith('CONVERSATION_'))
    .map(([, value]) => value as PermissionEnum);

// ---------------------------------------------------------------------------
// Universal wildcard
// ---------------------------------------------------------------------------

describe('expandPermissions — universal wildcard (*)', () => {
    it('should expand * to the full set of PermissionEnum values', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['*'] });

        // Assert — same members, order may differ
        expect(result).toHaveLength(ALL_PERMISSION_VALUES.length);
        for (const perm of ALL_PERMISSION_VALUES) {
            expect(result).toContain(perm);
        }
    });

    it('should return no duplicates when * is supplied multiple times', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['*', '*'] });

        // Assert — Set deduplication
        expect(result).toHaveLength(ALL_PERMISSION_VALUES.length);
        expect(new Set(result).size).toBe(result.length);
    });
});

// ---------------------------------------------------------------------------
// Prefix wildcard
// ---------------------------------------------------------------------------

describe('expandPermissions — prefix wildcard (FOO_*)', () => {
    it('should expand ACCOMMODATION_* to all ACCOMMODATION_ enum members', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['ACCOMMODATION_*'] });

        // Assert — all members present
        expect(result.length).toBeGreaterThan(0);
        expect(result).toHaveLength(ACCOMMODATION_VALUES.length);
        for (const perm of ACCOMMODATION_VALUES) {
            expect(result).toContain(perm);
        }
    });

    it('should expand CONVERSATION_* to all CONVERSATION_ enum members', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['CONVERSATION_*'] });

        // Assert
        expect(result.length).toBeGreaterThan(0);
        expect(result).toHaveLength(CONVERSATION_VALUES.length);
        for (const perm of CONVERSATION_VALUES) {
            expect(result).toContain(perm);
        }
    });

    it('should not include members from other prefixes', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['ACCOMMODATION_*'] });

        // Assert — no CONVERSATION_ values
        for (const perm of CONVERSATION_VALUES) {
            expect(result).not.toContain(perm);
        }
    });

    it('should throw when prefix wildcard matches nothing', () => {
        // Arrange + Act + Assert
        expect(() => expandPermissions({ expressions: ['NOPE_*'] })).toThrow(
            'Unknown permission: NOPE_*'
        );
    });
});

// ---------------------------------------------------------------------------
// Exact expression
// ---------------------------------------------------------------------------

describe('expandPermissions — exact expression', () => {
    it('should resolve CONVERSATION_VIEW_OWN to the matching enum value', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['CONVERSATION_VIEW_OWN'] });

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(PermissionEnum.CONVERSATION_VIEW_OWN);
    });

    it('should resolve ACCOMMODATION_CREATE to the matching enum value', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['ACCOMMODATION_CREATE'] });

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(PermissionEnum.ACCOMMODATION_CREATE);
    });

    it('should resolve ACCESS_PANEL_ADMIN to the matching enum value', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: ['ACCESS_PANEL_ADMIN'] });

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toBe(PermissionEnum.ACCESS_PANEL_ADMIN);
    });

    it('should throw for an unknown exact key', () => {
        // Arrange + Act + Assert
        // PermissionExpression is a branded string (regex-validated at runtime by Zod),
        // so TypeScript accepts any string here — the runtime check is what matters.
        expect(() => expandPermissions({ expressions: ['NOPE'] })).toThrow(
            'Unknown permission: NOPE'
        );
    });

    it('should throw for an unknown exact key with underscore (not a valid prefix wildcard)', () => {
        // Arrange + Act + Assert — 'NOPE_CREATE' is treated as exact (no trailing *)
        expect(() => expandPermissions({ expressions: ['NOPE_CREATE'] })).toThrow(
            'Unknown permission: NOPE_CREATE'
        );
    });
});

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

describe('expandPermissions — deduplication', () => {
    it('should deduplicate when an exact expression overlaps with a prefix wildcard', () => {
        // Arrange — ACCOMMODATION_CREATE appears in both 'ACCOMMODATION_*' and exact
        const expressions = ['ACCOMMODATION_*', 'ACCOMMODATION_CREATE'] as const;

        // Act
        const result = expandPermissions({ expressions });

        // Assert — ACCOMMODATION_CREATE appears exactly once
        const count = result.filter((p) => p === PermissionEnum.ACCOMMODATION_CREATE).length;
        expect(count).toBe(1);

        // And overall length equals the prefix-only expansion (no extras)
        expect(result).toHaveLength(ACCOMMODATION_VALUES.length);
    });

    it('should deduplicate across two overlapping prefix wildcards', () => {
        // Arrange — both expand to CONVERSATION_* members
        const expressions = ['CONVERSATION_*', 'CONVERSATION_*'] as const;

        // Act
        const result = expandPermissions({ expressions });

        // Assert — same length as single expansion
        expect(result).toHaveLength(CONVERSATION_VALUES.length);
        expect(new Set(result).size).toBe(result.length);
    });

    it('should produce no duplicates in the combined result', () => {
        // Arrange — mixed expressions that can overlap
        const expressions = [
            'ACCOMMODATION_CREATE',
            'CONVERSATION_VIEW_OWN',
            'CONVERSATION_*'
        ] as const;

        // Act
        const result = expandPermissions({ expressions });

        // Assert — no duplicates
        expect(new Set(result).size).toBe(result.length);
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('expandPermissions — edge cases', () => {
    it('should return an empty array for an empty expressions input', () => {
        // Arrange + Act
        const result = expandPermissions({ expressions: [] });

        // Assert
        expect(result).toEqual([]);
    });

    it('should handle multiple exact expressions correctly', () => {
        // Arrange
        const expressions = [
            'CONVERSATION_VIEW_OWN',
            'ACCOMMODATION_CREATE',
            'ACCESS_PANEL_ADMIN'
        ] as const;

        // Act
        const result = expandPermissions({ expressions });

        // Assert
        expect(result).toHaveLength(3);
        expect(result).toContain(PermissionEnum.CONVERSATION_VIEW_OWN);
        expect(result).toContain(PermissionEnum.ACCOMMODATION_CREATE);
        expect(result).toContain(PermissionEnum.ACCESS_PANEL_ADMIN);
    });
});
