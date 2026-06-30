/**
 * T-046: Tag System Schema Completeness — smoke tests
 *
 * AC-F15, AC-F16, AC-F18 verification.
 *
 * COVERAGE NOTE
 * =============
 * The acceptance criteria for this task are already comprehensively tested by
 * existing suites. This file provides lightweight smoke assertions that confirm
 * the same contracts from the perspective of `@repo/schemas` exports, and
 * documents where the primary coverage lives.
 *
 * Existing primary coverage (all passing):
 *
 * AC-F15 — EntityTypeEnum contains 4 new SPEC-086 values + 5 originals
 *   → packages/schemas/src/enums/__tests__/entity-type.enum.test.ts (20 tests)
 *
 * AC-F16 — All 24 SPEC-086 permissions present in PermissionEnum;
 *           TAG_USER_UPDATE_ANY and TAG_SYSTEM_ASSIGN explicitly absent (D-012, D-017)
 *   → packages/schemas/src/enums/__tests__/permission-tag-system.test.ts (28 tests)
 *
 * AC-F18 — TagSchema has `description` (nullable), no `notes`, no `slug`
 *   → packages/schemas/test/entities/tag/tag.refactor.schema.test.ts (multiple tests)
 *
 * @see SPEC-086 decisions D-002, D-012, D-014, D-015, D-017, D-019, D-024
 * @see AC-F15, AC-F16, AC-F18
 */

import { describe, expect, it } from 'vitest';
import { TagSchema } from '../../../src/entities/tag/tag.schema.js';
import { EntityTypeEnum } from '../../../src/enums/entity-type.enum.js';
import { PermissionEnum } from '../../../src/enums/permission.enum.js';

// ---------------------------------------------------------------------------
// AC-F15: EntityTypeEnum — 4 new SPEC-086 values present + 5 originals intact
// ---------------------------------------------------------------------------

describe('EntityTypeEnum completeness (AC-F15)', () => {
    const NEW_SPEC_086_VALUES = [
        'CONVERSATION',
        'REVIEW',
        'BILLING_SUBSCRIPTION',
        'PAYMENT'
    ] as const;

    const ORIGINAL_5_VALUES = ['ACCOMMODATION', 'DESTINATION', 'USER', 'POST', 'EVENT'] as const;

    it('should contain all 4 new SPEC-086 entity types', () => {
        const values = Object.values(EntityTypeEnum);
        for (const v of NEW_SPEC_086_VALUES) {
            expect(values, `EntityTypeEnum must contain ${v}`).toContain(v);
        }
    });

    it('should still contain all 5 original entity types', () => {
        const values = Object.values(EntityTypeEnum);
        for (const v of ORIGINAL_5_VALUES) {
            expect(values, `EntityTypeEnum must still contain ${v}`).toContain(v);
        }
    });

    it('should have exactly 11 values (5 original + 4 from SPEC-086 + 2 from F3)', () => {
        expect(Object.values(EntityTypeEnum)).toHaveLength(11);
    });
});

// ---------------------------------------------------------------------------
// AC-F16: PermissionEnum — 24 SPEC-086 permissions + explicit exclusions
// ---------------------------------------------------------------------------

describe('PermissionEnum completeness (AC-F16)', () => {
    const EXPECTED_USER_TAG_PERMISSIONS = [
        'TAG_INTERNAL_CREATE',
        'TAG_INTERNAL_UPDATE',
        'TAG_INTERNAL_DELETE',
        'TAG_INTERNAL_VIEW',
        'TAG_INTERNAL_ASSIGN',
        'TAG_SYSTEM_CREATE',
        'TAG_SYSTEM_UPDATE',
        'TAG_SYSTEM_DELETE',
        'TAG_SYSTEM_VIEW',
        'TAG_USER_CREATE',
        'TAG_USER_UPDATE_OWN',
        'TAG_USER_DELETE_OWN',
        'TAG_USER_VIEW_OWN',
        'TAG_USER_DELETE_ANY',
        'TAG_VIEW_ALL_USER_TAGS',
        'TAG_VIEW_ALL_ASSIGNMENTS',
        'TAG_ASSIGN_VIEW',
        'TAG_ASSIGN_ADD',
        'TAG_ASSIGN_REMOVE'
    ] as const;

    const EXPECTED_POST_TAG_PERMISSIONS = [
        'POST_TAG_CREATE',
        'POST_TAG_UPDATE',
        'POST_TAG_DELETE',
        'POST_TAG_VIEW',
        'POST_TAG_ASSIGN'
    ] as const;

    it('should contain all 19 user-tag permissions', () => {
        const permEnum = PermissionEnum as Record<string, string>;
        for (const key of EXPECTED_USER_TAG_PERMISSIONS) {
            expect(permEnum[key], `PermissionEnum must contain ${key}`).toBeDefined();
        }
    });

    it('should contain all 5 PostTag permissions', () => {
        const permEnum = PermissionEnum as Record<string, string>;
        for (const key of EXPECTED_POST_TAG_PERMISSIONS) {
            expect(permEnum[key], `PermissionEnum must contain ${key}`).toBeDefined();
        }
    });

    it('should NOT contain TAG_USER_UPDATE_ANY (D-012: super-admin moderation is delete-only)', () => {
        const permEnum = PermissionEnum as Record<string, string>;
        expect(permEnum.TAG_USER_UPDATE_ANY).toBeUndefined();
    });

    it('should NOT contain TAG_SYSTEM_ASSIGN (D-017: covered by TAG_ASSIGN_ADD)', () => {
        const permEnum = PermissionEnum as Record<string, string>;
        expect(permEnum.TAG_SYSTEM_ASSIGN).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// AC-F18: TagSchema — description present (nullable), notes absent, slug absent
// ---------------------------------------------------------------------------

describe('TagSchema field shape (AC-F18)', () => {
    it('should expose a description field in TagSchema.shape', () => {
        // Zod object exposes .shape for key introspection
        expect(TagSchema.shape).toHaveProperty('description');
    });

    it('should NOT expose a notes field in TagSchema.shape', () => {
        expect(TagSchema.shape).not.toHaveProperty('notes');
    });

    it('should NOT expose a slug field in TagSchema.shape (D-002: user-tags have no public URL)', () => {
        expect(TagSchema.shape).not.toHaveProperty('slug');
    });

    it('should accept null as a valid description value', () => {
        // Arrange: minimal valid tag payload with description: null
        const input = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            type: 'SYSTEM',
            ownerId: null,
            name: 'System tag',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: '550e8400-e29b-41d4-a716-446655440000',
            updatedById: '550e8400-e29b-41d4-a716-446655440000',
            description: null
        };

        // Act
        const result = TagSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.description).toBeNull();
        }
    });
});
