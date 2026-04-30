import { describe, expect, it } from 'vitest';
import {
    ImpactCountResponseSchema,
    PickerQueryContextSchema,
    TagAssignInputSchema,
    TagAssignRemoveInputSchema,
    TagPickerVisibilitySchema
} from '../../../src/entities/tag/tag.access.schema.js';

// Fixed UUIDs used across tests
const VALID_TAG_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_ENTITY_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const VALID_ACTOR_ID = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

// ============================================================================
// TagPickerVisibilitySchema
// ============================================================================

describe('TagPickerVisibilitySchema', () => {
    it('should accept ANONYMOUS', () => {
        expect(() => TagPickerVisibilitySchema.parse('ANONYMOUS')).not.toThrow();
        expect(TagPickerVisibilitySchema.parse('ANONYMOUS')).toBe('ANONYMOUS');
    });

    it('should accept AUTHENTICATED', () => {
        expect(() => TagPickerVisibilitySchema.parse('AUTHENTICATED')).not.toThrow();
    });

    it('should accept ADMIN_WITH_INTERNAL_VIEW', () => {
        expect(() => TagPickerVisibilitySchema.parse('ADMIN_WITH_INTERNAL_VIEW')).not.toThrow();
    });

    it('should accept SUPER_ADMIN_MODERATION', () => {
        expect(() => TagPickerVisibilitySchema.parse('SUPER_ADMIN_MODERATION')).not.toThrow();
    });

    it('should reject an unknown visibility level', () => {
        expect(() => TagPickerVisibilitySchema.parse('PUBLIC')).toThrow();
    });

    it('should reject empty string', () => {
        expect(() => TagPickerVisibilitySchema.parse('')).toThrow();
    });
});

// ============================================================================
// PickerQueryContextSchema
// ============================================================================

describe('PickerQueryContextSchema', () => {
    it('should accept valid context with hasTagInternalView false', () => {
        // Arrange
        const input = { actorId: VALID_ACTOR_ID, hasTagInternalView: false };

        // Act + Assert
        expect(() => PickerQueryContextSchema.parse(input)).not.toThrow();
        const result = PickerQueryContextSchema.parse(input);
        expect(result.actorId).toBe(VALID_ACTOR_ID);
        expect(result.hasTagInternalView).toBe(false);
    });

    it('should accept valid context with hasTagInternalView true', () => {
        const input = { actorId: VALID_ACTOR_ID, hasTagInternalView: true };
        expect(() => PickerQueryContextSchema.parse(input)).not.toThrow();
    });

    it('should reject when actorId is not a UUID', () => {
        const input = { actorId: 'not-a-uuid', hasTagInternalView: false };
        expect(() => PickerQueryContextSchema.parse(input)).toThrow();
    });

    it('should reject when actorId is missing', () => {
        const input = { hasTagInternalView: false };
        expect(() => PickerQueryContextSchema.parse(input)).toThrow();
    });

    it('should reject when hasTagInternalView is missing', () => {
        const input = { actorId: VALID_ACTOR_ID };
        expect(() => PickerQueryContextSchema.parse(input)).toThrow();
    });
});

// ============================================================================
// TagAssignInputSchema
// ============================================================================

describe('TagAssignInputSchema', () => {
    const validAssign = {
        tagId: VALID_TAG_ID,
        entityId: VALID_ENTITY_ID,
        entityType: 'ACCOMMODATION' as const,
        assignedById: VALID_ACTOR_ID
    };

    it('should accept all four required fields (happy path)', () => {
        // Arrange + Act + Assert
        expect(() => TagAssignInputSchema.parse(validAssign)).not.toThrow();
        const result = TagAssignInputSchema.parse(validAssign);
        expect(result.tagId).toBe(VALID_TAG_ID);
        expect(result.entityId).toBe(VALID_ENTITY_ID);
        expect(result.entityType).toBe('ACCOMMODATION');
        expect(result.assignedById).toBe(VALID_ACTOR_ID);
    });

    it('should reject when tagId is missing', () => {
        // Arrange
        const { tagId: _omitted, ...withoutTagId } = validAssign;

        // Act + Assert
        expect(() => TagAssignInputSchema.parse(withoutTagId)).toThrow();
    });

    it('should reject when entityId is missing', () => {
        // Arrange
        const { entityId: _omitted, ...withoutEntityId } = validAssign;

        // Act + Assert
        expect(() => TagAssignInputSchema.parse(withoutEntityId)).toThrow();
    });

    it('should reject when entityType is missing', () => {
        // Arrange
        const { entityType: _omitted, ...withoutEntityType } = validAssign;

        // Act + Assert
        expect(() => TagAssignInputSchema.parse(withoutEntityType)).toThrow();
    });

    it('should reject when assignedById is missing', () => {
        // Arrange
        const { assignedById: _omitted, ...withoutAssignedById } = validAssign;

        // Act + Assert
        expect(() => TagAssignInputSchema.parse(withoutAssignedById)).toThrow();
    });

    it('should accept all valid EntityTypeEnum values', () => {
        const entityTypes = [
            'ACCOMMODATION',
            'DESTINATION',
            'USER',
            'POST',
            'EVENT',
            'CONVERSATION',
            'REVIEW',
            'BILLING_SUBSCRIPTION',
            'PAYMENT'
        ] as const;

        for (const entityType of entityTypes) {
            expect(() => TagAssignInputSchema.parse({ ...validAssign, entityType })).not.toThrow();
        }
    });

    it('should reject an invalid entityType', () => {
        expect(() =>
            TagAssignInputSchema.parse({ ...validAssign, entityType: 'UNKNOWN_ENTITY' })
        ).toThrow();
    });

    it('should reject when tagId is not a UUID', () => {
        expect(() => TagAssignInputSchema.parse({ ...validAssign, tagId: 'not-a-uuid' })).toThrow();
    });

    it('should reject when entityId is not a UUID', () => {
        expect(() =>
            TagAssignInputSchema.parse({ ...validAssign, entityId: 'not-a-uuid' })
        ).toThrow();
    });

    it('should reject when assignedById is not a UUID', () => {
        expect(() =>
            TagAssignInputSchema.parse({ ...validAssign, assignedById: 'not-a-uuid' })
        ).toThrow();
    });
});

// ============================================================================
// TagAssignRemoveInputSchema
// ============================================================================

describe('TagAssignRemoveInputSchema', () => {
    const validRemove = {
        tagId: VALID_TAG_ID,
        entityId: VALID_ENTITY_ID,
        entityType: 'POST' as const,
        assignedById: VALID_ACTOR_ID
    };

    it('should accept all four required fields (happy path)', () => {
        expect(() => TagAssignRemoveInputSchema.parse(validRemove)).not.toThrow();
        const result = TagAssignRemoveInputSchema.parse(validRemove);
        expect(result.tagId).toBe(VALID_TAG_ID);
        expect(result.entityId).toBe(VALID_ENTITY_ID);
        expect(result.entityType).toBe('POST');
        expect(result.assignedById).toBe(VALID_ACTOR_ID);
    });

    it('should reject when tagId is missing', () => {
        const { tagId: _omitted, ...withoutTagId } = validRemove;
        expect(() => TagAssignRemoveInputSchema.parse(withoutTagId)).toThrow();
    });

    it('should reject when entityId is missing', () => {
        const { entityId: _omitted, ...withoutEntityId } = validRemove;
        expect(() => TagAssignRemoveInputSchema.parse(withoutEntityId)).toThrow();
    });

    it('should reject when entityType is missing', () => {
        const { entityType: _omitted, ...withoutEntityType } = validRemove;
        expect(() => TagAssignRemoveInputSchema.parse(withoutEntityType)).toThrow();
    });

    it('should reject when assignedById is missing', () => {
        const { assignedById: _omitted, ...withoutAssignedById } = validRemove;
        expect(() => TagAssignRemoveInputSchema.parse(withoutAssignedById)).toThrow();
    });
});

// ============================================================================
// ImpactCountResponseSchema
// ============================================================================

describe('ImpactCountResponseSchema', () => {
    it('should accept count of zero', () => {
        expect(() => ImpactCountResponseSchema.parse({ count: 0 })).not.toThrow();
        expect(ImpactCountResponseSchema.parse({ count: 0 }).count).toBe(0);
    });

    it('should accept a positive integer count', () => {
        expect(() => ImpactCountResponseSchema.parse({ count: 42 })).not.toThrow();
    });

    it('should reject negative count (D-011 — nonnegative invariant)', () => {
        expect(() => ImpactCountResponseSchema.parse({ count: -1 })).toThrow();
    });

    it('should reject a float count', () => {
        expect(() => ImpactCountResponseSchema.parse({ count: 1.5 })).toThrow();
    });

    it('should reject when count is missing', () => {
        expect(() => ImpactCountResponseSchema.parse({})).toThrow();
    });

    it('should reject when count is a string', () => {
        expect(() => ImpactCountResponseSchema.parse({ count: '42' })).toThrow();
    });
});
