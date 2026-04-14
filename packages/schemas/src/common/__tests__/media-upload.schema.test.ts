import { describe, expect, it } from 'vitest';
import {
    AdminUploadRequestSchema,
    DeleteMediaQuerySchema,
    DeleteMediaResponseSchema,
    MediaEntityTypeSchema,
    MediaRoleSchema,
    UploadResponseSchema
} from '../media-upload.schema.js';

// ============================================================================
// MediaEntityTypeSchema
// ============================================================================

describe('MediaEntityTypeSchema', () => {
    it('should accept all valid entity types', () => {
        const validTypes = ['accommodation', 'destination', 'event', 'post'];
        for (const type of validTypes) {
            const result = MediaEntityTypeSchema.safeParse(type);
            expect(result.success).toBe(true);
        }
    });

    it('should reject an unknown entity type', () => {
        const result = MediaEntityTypeSchema.safeParse('user');
        expect(result.success).toBe(false);
    });

    it('should reject an empty string', () => {
        const result = MediaEntityTypeSchema.safeParse('');
        expect(result.success).toBe(false);
    });

    it('should reject a non-string value', () => {
        const result = MediaEntityTypeSchema.safeParse(42);
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// MediaRoleSchema
// ============================================================================

describe('MediaRoleSchema', () => {
    it('should accept "featured"', () => {
        const result = MediaRoleSchema.safeParse('featured');
        expect(result.success).toBe(true);
    });

    it('should accept "gallery"', () => {
        const result = MediaRoleSchema.safeParse('gallery');
        expect(result.success).toBe(true);
    });

    it('should reject an unknown role', () => {
        const result = MediaRoleSchema.safeParse('thumbnail');
        expect(result.success).toBe(false);
    });

    it('should reject an empty string', () => {
        const result = MediaRoleSchema.safeParse('');
        expect(result.success).toBe(false);
    });
});

// ============================================================================
// AdminUploadRequestSchema
// ============================================================================

describe('AdminUploadRequestSchema', () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

    describe('when given valid input', () => {
        it('should pass with all fields correct', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityType: 'accommodation',
                entityId: VALID_UUID,
                role: 'featured'
            });
            expect(result.success).toBe(true);
        });

        it('should pass for every entity type', () => {
            const types = ['accommodation', 'destination', 'event', 'post'];
            for (const entityType of types) {
                const result = AdminUploadRequestSchema.safeParse({
                    entityType,
                    entityId: VALID_UUID,
                    role: 'gallery'
                });
                expect(result.success).toBe(true);
            }
        });

        it('should pass for both roles', () => {
            const roles = ['featured', 'gallery'];
            for (const role of roles) {
                const result = AdminUploadRequestSchema.safeParse({
                    entityType: 'event',
                    entityId: VALID_UUID,
                    role
                });
                expect(result.success).toBe(true);
            }
        });
    });

    describe('when given invalid entityType', () => {
        it('should fail for an unknown entity type', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityType: 'hotel',
                entityId: VALID_UUID,
                role: 'featured'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when given invalid entityId', () => {
        it('should fail for a non-UUID string', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityType: 'accommodation',
                entityId: '../malicious',
                role: 'featured'
            });
            expect(result.success).toBe(false);
        });

        it('should fail for an empty entityId', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityType: 'accommodation',
                entityId: '',
                role: 'featured'
            });
            expect(result.success).toBe(false);
        });

        it('should fail for a numeric entityId', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityType: 'accommodation',
                entityId: 12345,
                role: 'featured'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when fields are missing', () => {
        it('should fail when entityType is missing', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityId: VALID_UUID,
                role: 'featured'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when entityId is missing', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityType: 'accommodation',
                role: 'featured'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when role is missing', () => {
            const result = AdminUploadRequestSchema.safeParse({
                entityType: 'accommodation',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should fail for an empty object', () => {
            const result = AdminUploadRequestSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// DeleteMediaQuerySchema
// ============================================================================

describe('DeleteMediaQuerySchema', () => {
    describe('when given valid input', () => {
        it('should pass for a publicId with "hospeda/" prefix', () => {
            const result = DeleteMediaQuerySchema.safeParse({
                publicId: 'hospeda/prod/accommodations/abc/featured'
            });
            expect(result.success).toBe(true);
        });

        it('should pass for a minimal valid publicId', () => {
            const result = DeleteMediaQuerySchema.safeParse({
                publicId: 'hospeda/x'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid publicId', () => {
        it('should fail for an empty string', () => {
            const result = DeleteMediaQuerySchema.safeParse({ publicId: '' });
            expect(result.success).toBe(false);
        });

        it('should fail when prefix is missing', () => {
            const result = DeleteMediaQuerySchema.safeParse({
                publicId: 'other/path/image'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues[0]?.message).toBe('publicId must start with "hospeda/"');
            }
        });

        it('should fail for a path that contains "hospeda/" in the middle', () => {
            const result = DeleteMediaQuerySchema.safeParse({
                publicId: 'prefix/hospeda/image'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when publicId field is missing', () => {
        it('should fail for an empty object', () => {
            const result = DeleteMediaQuerySchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// UploadResponseSchema
// ============================================================================

describe('UploadResponseSchema', () => {
    const VALID_RESPONSE = {
        url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
        publicId: 'hospeda/prod/accommodations/abc/featured',
        width: 1920,
        height: 1080
    };

    describe('when given valid input', () => {
        it('should pass for a complete valid response', () => {
            const result = UploadResponseSchema.safeParse(VALID_RESPONSE);
            expect(result.success).toBe(true);
        });
    });

    describe('when url is invalid', () => {
        it('should fail for a relative URL', () => {
            const result = UploadResponseSchema.safeParse({
                ...VALID_RESPONSE,
                url: '/relative/path.jpg'
            });
            expect(result.success).toBe(false);
        });

        it('should fail for an empty url', () => {
            const result = UploadResponseSchema.safeParse({
                ...VALID_RESPONSE,
                url: ''
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when dimensions are invalid', () => {
        it('should fail for a zero width', () => {
            const result = UploadResponseSchema.safeParse({ ...VALID_RESPONSE, width: 0 });
            expect(result.success).toBe(false);
        });

        it('should fail for a negative height', () => {
            const result = UploadResponseSchema.safeParse({ ...VALID_RESPONSE, height: -1 });
            expect(result.success).toBe(false);
        });

        it('should fail for a non-integer width', () => {
            const result = UploadResponseSchema.safeParse({ ...VALID_RESPONSE, width: 1920.5 });
            expect(result.success).toBe(false);
        });
    });

    describe('when fields are missing', () => {
        it('should fail when url is missing', () => {
            const { url: _url, ...rest } = VALID_RESPONSE;
            const result = UploadResponseSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should fail when publicId is missing', () => {
            const { publicId: _publicId, ...rest } = VALID_RESPONSE;
            const result = UploadResponseSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should fail when width is missing', () => {
            const { width: _width, ...rest } = VALID_RESPONSE;
            const result = UploadResponseSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should fail when height is missing', () => {
            const { height: _height, ...rest } = VALID_RESPONSE;
            const result = UploadResponseSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// DeleteMediaResponseSchema
// ============================================================================

describe('DeleteMediaResponseSchema', () => {
    describe('when given valid input', () => {
        it('should pass for a correct delete response', () => {
            const result = DeleteMediaResponseSchema.safeParse({
                deleted: true,
                publicId: 'hospeda/prod/accommodations/abc/featured'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when deleted literal is wrong', () => {
        it('should fail when deleted is false', () => {
            const result = DeleteMediaResponseSchema.safeParse({
                deleted: false,
                publicId: 'hospeda/abc'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when deleted is a string "true"', () => {
            const result = DeleteMediaResponseSchema.safeParse({
                deleted: 'true',
                publicId: 'hospeda/abc'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when fields are missing', () => {
        it('should fail when publicId is missing', () => {
            const result = DeleteMediaResponseSchema.safeParse({ deleted: true });
            expect(result.success).toBe(false);
        });

        it('should fail when deleted is missing', () => {
            const result = DeleteMediaResponseSchema.safeParse({
                publicId: 'hospeda/abc'
            });
            expect(result.success).toBe(false);
        });
    });
});
