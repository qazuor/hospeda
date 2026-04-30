/**
 * T-011: Refactored Tag Schema Invariant Tests
 *
 * Validates the business rules introduced by SPEC-086 refactor:
 * - D-002: type × ownerId invariants on TagCreateInputSchema
 * - D-018: type is immutable (excluded from TagUpdateInputSchema)
 * - No slug field anywhere (D-002)
 *
 * AC references: AC-F01, AC-F02, D-002, D-018
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { EntityTagSchema } from '../../../src/entities/tag/entity-tag.schema.js';
import {
    TagCreateInputSchema,
    TagUpdateInputSchema
} from '../../../src/entities/tag/tag.crud.schema.js';
import { TagSchema } from '../../../src/entities/tag/tag.schema.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ANOTHER_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// ---------------------------------------------------------------------------
// TagSchema field shape
// ---------------------------------------------------------------------------

describe('TagSchema — field shape after refactor (D-002, D-018)', () => {
    it('should contain type field', () => {
        const base = {
            id: VALID_UUID,
            type: 'SYSTEM',
            ownerId: null,
            name: 'Some tag',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: VALID_UUID,
            updatedById: VALID_UUID
        };

        const result = TagSchema.parse(base);
        expect(result.type).toBe('SYSTEM');
    });

    it('should contain ownerId field as nullable', () => {
        const base = {
            id: VALID_UUID,
            type: 'USER',
            ownerId: ANOTHER_UUID,
            name: 'My tag',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: VALID_UUID,
            updatedById: VALID_UUID
        };

        const result = TagSchema.parse(base);
        expect(result.ownerId).toBe(ANOTHER_UUID);
    });

    it('should NOT contain slug field (D-002 — user-tags have no public URL)', () => {
        const base = {
            id: VALID_UUID,
            type: 'SYSTEM',
            ownerId: null,
            name: 'Tag name',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: VALID_UUID,
            updatedById: VALID_UUID,
            slug: 'should-be-stripped' // extra field — Zod strips it
        };

        const result = TagSchema.parse(base);
        expect(Object.keys(result)).not.toContain('slug');
    });

    it('should NOT contain notes field (replaced by description per D-018)', () => {
        const base = {
            id: VALID_UUID,
            type: 'SYSTEM',
            ownerId: null,
            name: 'Tag name',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: VALID_UUID,
            updatedById: VALID_UUID,
            notes: 'old notes field' // extra field — Zod strips it
        };

        const result = TagSchema.parse(base);
        expect(Object.keys(result)).not.toContain('notes');
    });

    it('should contain description field (nullable)', () => {
        const withDescription = {
            id: VALID_UUID,
            type: 'INTERNAL',
            ownerId: null,
            name: 'Internal tag',
            color: 'RED',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: VALID_UUID,
            updatedById: VALID_UUID,
            description: 'Admin use only'
        };

        const result = TagSchema.parse(withDescription);
        expect(result.description).toBe('Admin use only');
    });
});

// ---------------------------------------------------------------------------
// TagCreateInputSchema — D-002 ownerId invariants (AC-F01, AC-F02)
// ---------------------------------------------------------------------------

describe('TagCreateInputSchema — D-002 ownerId invariants', () => {
    const baseSystemPayload = {
        type: 'SYSTEM' as const,
        name: 'System Tag',
        color: 'BLUE' as const
    };

    const baseInternalPayload = {
        type: 'INTERNAL' as const,
        name: 'Internal Tag',
        color: 'RED' as const
    };

    // AC-F01: USER tag without ownerId MUST fail
    it('should FAIL when type=USER and no ownerId provided (AC-F01)', () => {
        const result = TagCreateInputSchema.safeParse({
            type: 'USER',
            name: 'My tag',
            color: 'BLUE'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const ownerIdIssue = result.error.issues.find((i) => i.path.includes('ownerId'));
            expect(ownerIdIssue).toBeDefined();
        }
    });

    // AC-F01: USER tag without ownerId (null explicitly) MUST fail
    it('should FAIL when type=USER and ownerId is null (AC-F01)', () => {
        const result = TagCreateInputSchema.safeParse({
            type: 'USER',
            name: 'My tag',
            color: 'BLUE',
            ownerId: null
        });

        expect(result.success).toBe(false);
    });

    // AC-F01: USER tag WITH valid ownerId MUST pass
    it('should PASS when type=USER and ownerId is a valid UUID (AC-F01)', () => {
        const result = TagCreateInputSchema.safeParse({
            type: 'USER',
            name: 'My tag',
            color: 'BLUE',
            ownerId: VALID_UUID
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.ownerId).toBe(VALID_UUID);
            expect(result.data.type).toBe('USER');
        }
    });

    // AC-F02: SYSTEM tag WITH ownerId MUST fail
    it('should FAIL when type=SYSTEM and ownerId is provided (AC-F02)', () => {
        const result = TagCreateInputSchema.safeParse({
            ...baseSystemPayload,
            ownerId: VALID_UUID
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const ownerIdIssue = result.error.issues.find((i) => i.path.includes('ownerId'));
            expect(ownerIdIssue).toBeDefined();
        }
    });

    // AC-F02: SYSTEM tag WITHOUT ownerId MUST pass
    it('should PASS when type=SYSTEM and no ownerId (AC-F02)', () => {
        const result = TagCreateInputSchema.safeParse(baseSystemPayload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe('SYSTEM');
            expect(result.data.ownerId == null).toBe(true);
        }
    });

    // AC-F02: SYSTEM tag with explicit null ownerId MUST pass
    it('should PASS when type=SYSTEM and ownerId is explicitly null (AC-F02)', () => {
        const result = TagCreateInputSchema.safeParse({
            ...baseSystemPayload,
            ownerId: null
        });

        expect(result.success).toBe(true);
    });

    // AC-F02: INTERNAL tag WITH ownerId MUST fail
    it('should FAIL when type=INTERNAL and ownerId is provided (AC-F02)', () => {
        const result = TagCreateInputSchema.safeParse({
            ...baseInternalPayload,
            ownerId: VALID_UUID
        });

        expect(result.success).toBe(false);
    });

    // AC-F02: INTERNAL tag WITHOUT ownerId MUST pass
    it('should PASS when type=INTERNAL and no ownerId (AC-F02)', () => {
        const result = TagCreateInputSchema.safeParse(baseInternalPayload);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe('INTERNAL');
        }
    });

    it('should require name field', () => {
        const result = TagCreateInputSchema.safeParse({
            type: 'SYSTEM',
            color: 'BLUE'
        });

        expect(result.success).toBe(false);
    });

    it('should require color field', () => {
        const result = TagCreateInputSchema.safeParse({
            type: 'SYSTEM',
            name: 'Tag name'
        });

        expect(result.success).toBe(false);
    });

    it('should require type field', () => {
        const result = TagCreateInputSchema.safeParse({
            name: 'Tag name',
            color: 'BLUE'
        });

        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// TagUpdateInputSchema — type is immutable (D-018)
// ---------------------------------------------------------------------------

describe('TagUpdateInputSchema — type immutability (D-018)', () => {
    it('should not accept type field (type is immutable after creation)', () => {
        // Zod strips unknown fields by default, but type should not be in the schema
        // so attempting to pass it should result in it being stripped or not accepted
        const result = TagUpdateInputSchema.safeParse({
            name: 'Updated name',
            color: 'RED',
            type: 'SYSTEM' // should be stripped / rejected
        });

        // Zod strips by default — if the schema uses .strip() (default), it succeeds
        // but type should not be in the output shape
        if (result.success) {
            // type should not appear in the output since it was omitted from the schema
            expect(Object.keys(result.data)).not.toContain('type');
        }
    });

    it('should not accept ownerId field (ownership is immutable)', () => {
        const result = TagUpdateInputSchema.safeParse({
            name: 'Updated name',
            ownerId: VALID_UUID // should be stripped
        });

        if (result.success) {
            expect(Object.keys(result.data)).not.toContain('ownerId');
        }
    });

    it('should allow partial updates of patchable fields', () => {
        const validUpdate = {
            name: 'New name',
            color: 'RED',
            icon: 'some-icon-xx',
            description: 'Updated description',
            lifecycleState: 'ARCHIVED'
        };

        const result = TagUpdateInputSchema.safeParse(validUpdate);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.name).toBe('New name');
            expect(result.data.color).toBe('RED');
            expect(result.data.description).toBe('Updated description');
            expect(result.data.lifecycleState).toBe('ARCHIVED');
        }
    });

    it('should allow empty object (all fields optional for PATCH)', () => {
        const result = TagUpdateInputSchema.safeParse({});

        expect(result.success).toBe(true);
    });

    it('should reject invalid values in patchable fields', () => {
        const invalidUpdate = {
            name: 'A', // too short
            color: 'INVALID_COLOR'
        };

        const result = TagUpdateInputSchema.safeParse(invalidUpdate);

        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// EntityTagSchema — assignedById is always required (D-005)
// ---------------------------------------------------------------------------

describe('EntityTagSchema — assignedById required (D-005)', () => {
    it('should require assignedById field', () => {
        const missingAssignedBy = {
            tagId: VALID_UUID,
            entityId: ANOTHER_UUID,
            entityType: 'ACCOMMODATION'
        };

        const result = EntityTagSchema.safeParse(missingAssignedBy);

        expect(result.success).toBe(false);
        if (!result.success) {
            const assignedByIssue = result.error.issues.find((i) =>
                i.path.includes('assignedById')
            );
            expect(assignedByIssue).toBeDefined();
        }
    });

    it('should PASS when assignedById is a valid UUID', () => {
        const validAssignment = {
            tagId: VALID_UUID,
            entityId: ANOTHER_UUID,
            entityType: 'ACCOMMODATION',
            assignedById: VALID_UUID
        };

        const result = EntityTagSchema.safeParse(validAssignment);

        expect(result.success).toBe(true);
    });

    it('should reject null assignedById (NOT NULL per D-005)', () => {
        const nullAssignedBy = {
            tagId: VALID_UUID,
            entityId: ANOTHER_UUID,
            entityType: 'ACCOMMODATION',
            assignedById: null
        };

        const result = EntityTagSchema.safeParse(nullAssignedBy);

        expect(result.success).toBe(false);
    });

    it('should allow SYSTEM_USER_ID as assignedById for automated assignments', () => {
        // SYSTEM_USER_ID must be a valid RFC4122 UUID (Zod v4 enforces strict UUID format).
        // The actual constant value is seeded in the DB as a real user row (D-005).
        // Using a valid RFC4122 v4-format UUID here (version digit 4 = starts with 4).
        const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';

        const systemAssignment = {
            tagId: VALID_UUID,
            entityId: ANOTHER_UUID,
            entityType: 'POST',
            assignedById: SYSTEM_USER_ID
        };

        const result = EntityTagSchema.safeParse(systemAssignment);

        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// ZodError shape assertions — helpful error messages
// ---------------------------------------------------------------------------

describe('Error message quality', () => {
    it('should produce a descriptive error when USER tag has no ownerId', () => {
        const result = TagCreateInputSchema.safeParse({
            type: 'USER',
            name: 'Tag',
            color: 'BLUE'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const issues = result.error.issues;
            // At least one issue should reference ownerId path
            expect(issues.some((i) => i.path.includes('ownerId'))).toBe(true);
            // Message should mention D-002 or be descriptive
            const ownerIssue = issues.find((i) => i.path.includes('ownerId'));
            expect(ownerIssue?.message).toMatch(/ownerId|USER|D-002/i);
        }
    });

    it('should produce a descriptive error when SYSTEM tag has ownerId', () => {
        const result = TagCreateInputSchema.safeParse({
            type: 'SYSTEM',
            name: 'Tag',
            color: 'BLUE',
            ownerId: VALID_UUID
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const issues = result.error.issues;
            expect(issues.some((i) => i.path.includes('ownerId'))).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// TagSchema — ZodError class confirmation
// ---------------------------------------------------------------------------

describe('TagSchema — throws ZodError', () => {
    it('should throw ZodError for invalid input', () => {
        expect(() =>
            TagSchema.parse({
                name: 'A', // too short
                color: 'INVALID'
            })
        ).toThrow(ZodError);
    });
});
