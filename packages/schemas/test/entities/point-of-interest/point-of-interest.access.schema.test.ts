import { describe, expect, it } from 'vitest';
import {
    PointOfInterestAdminSchema,
    PointOfInterestProtectedSchema,
    PointOfInterestPublicSchema
} from '../../../src/entities/point-of-interest/point-of-interest.access.schema.js';
import { createValidPointOfInterest } from '../../fixtures/point-of-interest.fixtures.js';

describe('Point Of Interest Access Schemas', () => {
    describe('PointOfInterestPublicSchema', () => {
        it('should include lat/long/type (not sensitive data)', () => {
            const data = createValidPointOfInterest();
            const result = PointOfInterestPublicSchema.parse(data);

            expect(result).toHaveProperty('lat');
            expect(result).toHaveProperty('long');
            expect(result).toHaveProperty('type');
        });

        it('should include public identification and content fields', () => {
            const data = createValidPointOfInterest();
            const result = PointOfInterestPublicSchema.parse(data);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('slug');
            expect(result).toHaveProperty('description');
            expect(result).toHaveProperty('icon');
            expect(result).toHaveProperty('isFeatured');
            expect(result).toHaveProperty('isBuiltin');
            expect(result).toHaveProperty('displayWeight');
        });

        it('should strip audit and admin fields', () => {
            const data = createValidPointOfInterest();
            const result = PointOfInterestPublicSchema.parse(data);

            expect(result).not.toHaveProperty('createdAt');
            expect(result).not.toHaveProperty('updatedAt');
            expect(result).not.toHaveProperty('createdById');
            expect(result).not.toHaveProperty('updatedById');
            expect(result).not.toHaveProperty('adminInfo');
            expect(result).not.toHaveProperty('lifecycleState');
        });

        it('should never expose a `name` field (HOS-113 OQ-2)', () => {
            const data = createValidPointOfInterest();
            const result = PointOfInterestPublicSchema.parse(data);

            expect(result).not.toHaveProperty('name');
        });
    });

    describe('PointOfInterestProtectedSchema', () => {
        it('should include all public fields plus lifecycle and basic audit', () => {
            const data = createValidPointOfInterest();
            const result = PointOfInterestProtectedSchema.parse(data);

            expect(result).toHaveProperty('lat');
            expect(result).toHaveProperty('long');
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('lifecycleState');
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('updatedAt');
        });

        it('should still strip admin-only fields', () => {
            const data = createValidPointOfInterest();
            const result = PointOfInterestProtectedSchema.parse(data);

            expect(result).not.toHaveProperty('adminInfo');
            expect(result).not.toHaveProperty('createdById');
            expect(result).not.toHaveProperty('deletedAt');
        });
    });

    describe('PointOfInterestAdminSchema', () => {
        it('should include every field of the full schema', () => {
            const data = createValidPointOfInterest();
            const result = PointOfInterestAdminSchema.parse(data);

            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('lat');
            expect(result).toHaveProperty('long');
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('adminInfo');
            expect(result).toHaveProperty('createdAt');
            expect(result).toHaveProperty('createdById');
        });
    });
});
