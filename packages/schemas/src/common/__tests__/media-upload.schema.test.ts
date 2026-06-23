import { describe, expect, expectTypeOf, it } from 'vitest';
import {
    AdminUploadRequestSchema,
    DeleteMediaQuerySchema,
    DeleteMediaResponseSchema,
    ENTITY_FOLDER_MAP,
    ENTITY_GALLERY_CAPS,
    MAX_GALLERY_CAP_FALLBACK,
    MediaEntityTypeSchema,
    MediaRoleSchema,
    ProtectedUploadEntityRequestSchema,
    UploadResponseDataSchema,
    UploadResponseSchema,
    getGalleryCap,
    resolveMediaFolder
} from '../media-upload.schema.js';

// ============================================================================
// MediaEntityTypeSchema
// ============================================================================

describe('MediaEntityTypeSchema', () => {
    it('should accept all valid entity types', () => {
        const validTypes = [
            'accommodation',
            'destination',
            'event',
            'post',
            'user',
            'postSponsor',
            'eventOrganizer',
            'avatars'
        ];
        for (const type of validTypes) {
            const result = MediaEntityTypeSchema.safeParse(type);
            expect(result.success).toBe(true);
        }
    });

    it('should reject an unknown entity type', () => {
        const result = MediaEntityTypeSchema.safeParse('hotel');
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
    it.each(['featured', 'gallery', 'avatar', 'sponsorLogo', 'organizerLogo'])(
        'should accept "%s"',
        (role) => {
            const result = MediaRoleSchema.safeParse(role);
            expect(result.success).toBe(true);
        }
    );

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
// AdminUploadRequestSchema — discriminated union (GAP-078-153)
// ============================================================================

describe('AdminUploadRequestSchema', () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
    const VALID_UUID_2 = '550e8400-e29b-41d4-a716-446655440001';

    describe('featured variant', () => {
        it('should pass for each CRUD content entity', () => {
            for (const entityType of ['accommodation', 'destination', 'event', 'post']) {
                const result = AdminUploadRequestSchema.safeParse({
                    role: 'featured',
                    entityType,
                    entityId: VALID_UUID
                });
                expect(result.success).toBe(true);
            }
        });

        it('should narrow the TypeScript type to the featured variant', () => {
            const parsed = AdminUploadRequestSchema.parse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: VALID_UUID
            });
            if (parsed.role === 'featured') {
                expectTypeOf(parsed.entityType).toEqualTypeOf<
                    'accommodation' | 'destination' | 'event' | 'post' | 'gastronomy' | 'experience'
                >();
                expectTypeOf(parsed.entityId).toEqualTypeOf<string>();
            }
        });

        it('should fail when entityType is not a gallery-capable entity', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'featured',
                entityType: 'user',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should fail when entityId is missing', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when entityId is not a UUID', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: '../malicious'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('gallery variant', () => {
        it('should pass without a galleryId (server will generate one)', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'accommodation',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(true);
        });

        it('should pass with a valid 10-char nanoid-shaped galleryId', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'post',
                entityId: VALID_UUID,
                galleryId: 'a7x3kB9m2p'
            });
            expect(result.success).toBe(true);
        });

        it('should fail for a too-short galleryId', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'post',
                entityId: VALID_UUID,
                galleryId: 'abc'
            });
            expect(result.success).toBe(false);
        });

        it('should fail for a galleryId containing path traversal characters', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'post',
                entityId: VALID_UUID,
                galleryId: '../xxx/../'
            });
            expect(result.success).toBe(false);
        });

        it('should fail for entityType "user" (no gallery on users)', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'user',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should narrow the TypeScript type to the gallery variant', () => {
            const parsed = AdminUploadRequestSchema.parse({
                role: 'gallery',
                entityType: 'post',
                entityId: VALID_UUID,
                galleryId: 'a7x3kB9m2p'
            });
            if (parsed.role === 'gallery') {
                expectTypeOf(parsed.galleryId).toEqualTypeOf<string | undefined>();
            }
        });
    });

    describe('avatar variant', () => {
        it('should pass with userId and entityType "user"', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'avatar',
                entityType: 'user',
                userId: VALID_UUID
            });
            expect(result.success).toBe(true);
        });

        it('should fail without userId', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'avatar',
                entityType: 'user'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when userId is not a UUID', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'avatar',
                entityType: 'user',
                userId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });

        it('should fail when entityType is not "user"', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'avatar',
                entityType: 'accommodation',
                userId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should narrow the TypeScript type to the avatar variant', () => {
            const parsed = AdminUploadRequestSchema.parse({
                role: 'avatar',
                entityType: 'user',
                userId: VALID_UUID
            });
            if (parsed.role === 'avatar') {
                expectTypeOf(parsed.entityType).toEqualTypeOf<'user'>();
                expectTypeOf(parsed.userId).toEqualTypeOf<string>();
            }
        });
    });

    describe('sponsorLogo variant', () => {
        it('should pass with entityType "postSponsor" and a UUID entityId', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'sponsorLogo',
                entityType: 'postSponsor',
                entityId: VALID_UUID_2
            });
            expect(result.success).toBe(true);
        });

        it('should fail when entityType is not "postSponsor"', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'sponsorLogo',
                entityType: 'accommodation',
                entityId: VALID_UUID_2
            });
            expect(result.success).toBe(false);
        });
    });

    describe('organizerLogo variant', () => {
        it('should pass with entityType "eventOrganizer" and a UUID entityId', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'organizerLogo',
                entityType: 'eventOrganizer',
                entityId: VALID_UUID_2
            });
            expect(result.success).toBe(true);
        });

        it('should fail when entityType is not "eventOrganizer"', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'organizerLogo',
                entityType: 'event',
                entityId: VALID_UUID_2
            });
            expect(result.success).toBe(false);
        });
    });

    describe('unknown role', () => {
        it('should fail when role is not one of the discriminants', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'thumbnail',
                entityType: 'accommodation',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should fail for an empty object (no discriminator)', () => {
            const result = AdminUploadRequestSchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });

    // SPEC-078-GAPS GAP-078-155: optional `tags` and `overwrite` pass-through
    describe('tags + overwrite pass-through', () => {
        it('should accept featured uploads with tags and overwrite', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: VALID_UUID,
                tags: ['hero', 'beach'],
                overwrite: false
            });
            expect(result.success).toBe(true);
            if (result.success) {
                // tags + overwrite live on the parsed shape regardless of variant
                expect(result.data.tags).toEqual(['hero', 'beach']);
                expect(result.data.overwrite).toBe(false);
            }
        });

        it('should accept gallery uploads with tags and overwrite', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'post',
                entityId: VALID_UUID,
                tags: ['gallery'],
                overwrite: true
            });
            expect(result.success).toBe(true);
        });

        it('should reject tags containing a comma (Cloudinary delimiter)', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: VALID_UUID,
                tags: ['safe', 'evil,injection']
            });
            expect(result.success).toBe(false);
        });

        it('should reject more than 20 tags', () => {
            const tooMany = Array.from({ length: 21 }, (_, i) => `tag${i}`);
            const result = AdminUploadRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: VALID_UUID,
                tags: tooMany
            });
            expect(result.success).toBe(false);
        });

        it('should reject overwrite of non-boolean type', () => {
            const result = AdminUploadRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: VALID_UUID,
                overwrite: 'true'
            });
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// ProtectedUploadEntityRequestSchema
// ============================================================================

describe('ProtectedUploadEntityRequestSchema', () => {
    const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

    describe('featured variant', () => {
        it('should accept featured upload for accommodation', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(true);
        });

        it('should accept featured upload for all content entity types', () => {
            for (const entityType of ['accommodation', 'destination', 'event', 'post']) {
                const result = ProtectedUploadEntityRequestSchema.safeParse({
                    role: 'featured',
                    entityType,
                    entityId: VALID_UUID
                });
                expect(result.success).toBe(true);
            }
        });
    });

    describe('gallery variant', () => {
        it('should accept gallery upload for accommodation', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'accommodation',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(true);
        });

        it('should accept gallery upload with optional galleryId', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'accommodation',
                entityId: VALID_UUID,
                galleryId: 'abcdefghij'
            });
            expect(result.success).toBe(true);
        });
    });

    describe('rejected roles', () => {
        it('should reject avatar role', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'avatar',
                entityType: 'user',
                userId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should reject sponsorLogo role', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'sponsorLogo',
                entityType: 'postSponsor',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });

        it('should reject organizerLogo role', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'organizerLogo',
                entityType: 'eventOrganizer',
                entityId: VALID_UUID
            });
            expect(result.success).toBe(false);
        });
    });

    describe('validation', () => {
        it('should reject invalid entityId', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: 'not-a-uuid'
            });
            expect(result.success).toBe(false);
        });

        it('should accept optional tags', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'featured',
                entityType: 'accommodation',
                entityId: VALID_UUID,
                tags: ['tag1', 'tag2']
            });
            expect(result.success).toBe(true);
        });

        it('should accept optional overwrite boolean', () => {
            const result = ProtectedUploadEntityRequestSchema.safeParse({
                role: 'gallery',
                entityType: 'accommodation',
                entityId: VALID_UUID,
                overwrite: true
            });
            expect(result.success).toBe(true);
        });
    });
});

// ============================================================================
// ENTITY_FOLDER_MAP (GAP-078-055)
// ============================================================================

describe('ENTITY_FOLDER_MAP', () => {
    const ENV = 'dev';
    const ID = '550e8400-e29b-41d4-a716-446655440000';

    it('should produce the expected folder for accommodation', () => {
        expect(ENTITY_FOLDER_MAP.accommodation({ environment: ENV, entityId: ID })).toBe(
            `hospeda/${ENV}/accommodations/${ID}`
        );
    });

    it('should produce the expected folder for destination', () => {
        expect(ENTITY_FOLDER_MAP.destination({ environment: ENV, entityId: ID })).toBe(
            `hospeda/${ENV}/destinations/${ID}`
        );
    });

    it('should produce the expected folder for event', () => {
        expect(ENTITY_FOLDER_MAP.event({ environment: ENV, entityId: ID })).toBe(
            `hospeda/${ENV}/events/${ID}`
        );
    });

    it('should produce the expected folder for post', () => {
        expect(ENTITY_FOLDER_MAP.post({ environment: ENV, entityId: ID })).toBe(
            `hospeda/${ENV}/posts/${ID}`
        );
    });

    it('should produce the avatar folder for a user given userId', () => {
        expect(ENTITY_FOLDER_MAP.user({ environment: ENV, userId: ID })).toBe(
            `hospeda/${ENV}/avatars/${ID}`
        );
    });

    it('should fall back to entityId if userId is absent on the user resolver', () => {
        expect(ENTITY_FOLDER_MAP.user({ environment: ENV, entityId: ID })).toBe(
            `hospeda/${ENV}/avatars/${ID}`
        );
    });

    it('should produce the seed-avatars folder', () => {
        expect(ENTITY_FOLDER_MAP.avatars({ environment: ENV })).toBe(`hospeda/${ENV}/seed/avatars`);
    });

    it('should produce the postSponsor folder', () => {
        expect(ENTITY_FOLDER_MAP.postSponsor({ environment: ENV, entityId: ID })).toBe(
            `hospeda/${ENV}/postSponsors/${ID}`
        );
    });

    it('should produce the eventOrganizer folder', () => {
        expect(ENTITY_FOLDER_MAP.eventOrganizer({ environment: ENV, entityId: ID })).toBe(
            `hospeda/${ENV}/eventOrganizers/${ID}`
        );
    });

    it('should throw when a required entityId is missing', () => {
        expect(() => ENTITY_FOLDER_MAP.accommodation({ environment: ENV })).toThrow(/entityId/);
    });

    it('should throw on the user resolver when no identifier is supplied', () => {
        expect(() => ENTITY_FOLDER_MAP.user({ environment: ENV })).toThrow(/userId/);
    });

    it('every returned path should start with hospeda/{env}/', () => {
        const keys = Object.keys(ENTITY_FOLDER_MAP) as Array<keyof typeof ENTITY_FOLDER_MAP>;
        for (const key of keys) {
            const path =
                key === 'avatars'
                    ? ENTITY_FOLDER_MAP[key]({ environment: ENV })
                    : key === 'user'
                      ? ENTITY_FOLDER_MAP[key]({ environment: ENV, userId: ID })
                      : ENTITY_FOLDER_MAP[key]({ environment: ENV, entityId: ID });
            expect(path.startsWith(`hospeda/${ENV}/`)).toBe(true);
            expect(path.endsWith('/')).toBe(false);
        }
    });
});

// ============================================================================
// resolveMediaFolder
// ============================================================================

describe('resolveMediaFolder', () => {
    const ID = '550e8400-e29b-41d4-a716-446655440000';

    it('should resolve a content-entity folder via entityId', () => {
        expect(
            resolveMediaFolder({
                entityType: 'accommodation',
                environment: 'prod',
                entityId: ID
            })
        ).toBe(`hospeda/prod/accommodations/${ID}`);
    });

    it('should resolve the avatar folder via userId', () => {
        expect(
            resolveMediaFolder({
                entityType: 'user',
                environment: 'prod',
                userId: ID
            })
        ).toBe(`hospeda/prod/avatars/${ID}`);
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

    // GAP-078-034 + GAP-078-173 — path traversal protection
    describe('when publicId contains path traversal', () => {
        it('should fail for a raw ".." segment in the middle', () => {
            const result = DeleteMediaQuerySchema.safeParse({
                publicId: 'hospeda/dev/../prod/x'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.message.includes('path traversal'))).toBe(
                    true
                );
            }
        });

        it('should fail for URL-encoded ".." (%2E%2E)', () => {
            const result = DeleteMediaQuerySchema.safeParse({
                publicId: 'hospeda/dev/%2E%2E/prod/x'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.message.includes('path traversal'))).toBe(
                    true
                );
            }
        });

        it('should fail for a ".." segment at the end', () => {
            const result = DeleteMediaQuerySchema.safeParse({
                publicId: 'hospeda/dev/foo/..'
            });
            expect(result.success).toBe(false);
        });

        it('should not throw on malformed URL-encoded input', () => {
            // `%E0` is an invalid UTF-8 start byte and makes decodeURIComponent
            // throw. The refinement must swallow that and fall back to checking
            // the raw string instead of crashing validation.
            expect(() =>
                DeleteMediaQuerySchema.safeParse({
                    publicId: 'hospeda/dev/%E0/foo'
                })
            ).not.toThrow();
        });
    });
});

// ============================================================================
// UploadResponseDataSchema
// ============================================================================

describe('UploadResponseDataSchema', () => {
    const VALID_RESPONSE = {
        url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
        publicId: 'hospeda/prod/accommodations/abc/featured',
        width: 1920,
        height: 1080,
        moderationState: 'APPROVED' as const
    };

    describe('when given valid input', () => {
        it('should pass for a complete valid response', () => {
            const result = UploadResponseDataSchema.safeParse(VALID_RESPONSE);
            expect(result.success).toBe(true);
        });

        it('should default moderationState to APPROVED when omitted', () => {
            const { moderationState: _m, ...rest } = VALID_RESPONSE;
            const result = UploadResponseDataSchema.safeParse(rest);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.moderationState).toBe('APPROVED');
            }
        });

        it('should strip unknown provider fields (schema compatibility policy)', () => {
            const result = UploadResponseDataSchema.safeParse({
                ...VALID_RESPONSE,
                // Extra fields that a Cloudinary SDK upgrade might introduce.
                // The schema strips them so the public contract stays stable.
                format: 'jpg',
                bytes: 12345,
                etag: 'abc'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect('format' in result.data).toBe(false);
                expect('bytes' in result.data).toBe(false);
                expect('etag' in result.data).toBe(false);
            }
        });
    });

    describe('when moderationState is not APPROVED', () => {
        it('should fail for any other literal value', () => {
            const result = UploadResponseDataSchema.safeParse({
                ...VALID_RESPONSE,
                moderationState: 'PENDING'
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when url is invalid', () => {
        it('should fail for a relative URL', () => {
            const result = UploadResponseDataSchema.safeParse({
                ...VALID_RESPONSE,
                url: '/relative/path.jpg'
            });
            expect(result.success).toBe(false);
        });

        it('should fail for an empty url', () => {
            const result = UploadResponseDataSchema.safeParse({
                ...VALID_RESPONSE,
                url: ''
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when dimensions are invalid', () => {
        it('should fail for a zero width', () => {
            const result = UploadResponseDataSchema.safeParse({ ...VALID_RESPONSE, width: 0 });
            expect(result.success).toBe(false);
        });

        it('should fail for a negative height', () => {
            const result = UploadResponseDataSchema.safeParse({ ...VALID_RESPONSE, height: -1 });
            expect(result.success).toBe(false);
        });

        it('should fail for a non-integer width', () => {
            const result = UploadResponseDataSchema.safeParse({
                ...VALID_RESPONSE,
                width: 1920.5
            });
            expect(result.success).toBe(false);
        });
    });

    describe('when fields are missing', () => {
        it('should fail when url is missing', () => {
            const { url: _url, ...rest } = VALID_RESPONSE;
            const result = UploadResponseDataSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should fail when publicId is missing', () => {
            const { publicId: _publicId, ...rest } = VALID_RESPONSE;
            const result = UploadResponseDataSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should fail when width is missing', () => {
            const { width: _width, ...rest } = VALID_RESPONSE;
            const result = UploadResponseDataSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });

        it('should fail when height is missing', () => {
            const { height: _height, ...rest } = VALID_RESPONSE;
            const result = UploadResponseDataSchema.safeParse(rest);
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// UploadResponseSchema (wrapped)
// ============================================================================

describe('UploadResponseSchema (wrapped envelope)', () => {
    const VALID_DATA = {
        url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/abc.jpg',
        publicId: 'hospeda/prod/accommodations/abc/featured',
        width: 1920,
        height: 1080,
        moderationState: 'APPROVED' as const
    };

    const VALID_METADATA = {
        timestamp: '2026-04-19T00:00:00.000Z',
        requestId: 'req-123'
    };

    describe('when given a valid wrapped response', () => {
        it('should pass for a fully-populated envelope', () => {
            const result = UploadResponseSchema.safeParse({
                success: true,
                data: VALID_DATA,
                metadata: VALID_METADATA
            });
            expect(result.success).toBe(true);
        });

        it('should pass when metadata fields are omitted (all optional)', () => {
            const result = UploadResponseSchema.safeParse({
                success: true,
                data: VALID_DATA,
                metadata: {}
            });
            expect(result.success).toBe(true);
        });
    });

    describe('when the envelope is malformed', () => {
        it('should fail when success is false', () => {
            const result = UploadResponseSchema.safeParse({
                success: false,
                data: VALID_DATA,
                metadata: VALID_METADATA
            });
            expect(result.success).toBe(false);
        });

        it('should fail when data is missing', () => {
            const result = UploadResponseSchema.safeParse({
                success: true,
                metadata: VALID_METADATA
            });
            expect(result.success).toBe(false);
        });

        it('should fail when metadata is missing', () => {
            const result = UploadResponseSchema.safeParse({
                success: true,
                data: VALID_DATA
            });
            expect(result.success).toBe(false);
        });

        it('should fail when data.moderationState is not APPROVED', () => {
            const result = UploadResponseSchema.safeParse({
                success: true,
                data: { ...VALID_DATA, moderationState: 'REJECTED' },
                metadata: VALID_METADATA
            });
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

        // SPEC-078-GAPS GAP-078-154: wasPresent is an optional boolean signal
        it('should accept wasPresent: true', () => {
            const result = DeleteMediaResponseSchema.safeParse({
                deleted: true,
                publicId: 'hospeda/prod/accommodations/abc/featured',
                wasPresent: true
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.wasPresent).toBe(true);
            }
        });

        it('should accept wasPresent: false', () => {
            const result = DeleteMediaResponseSchema.safeParse({
                deleted: true,
                publicId: 'hospeda/prod/accommodations/abc/featured',
                wasPresent: false
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.wasPresent).toBe(false);
            }
        });

        it('should reject wasPresent of non-boolean type', () => {
            const result = DeleteMediaResponseSchema.safeParse({
                deleted: true,
                publicId: 'hospeda/prod/accommodations/abc/featured',
                wasPresent: 'yes'
            });
            expect(result.success).toBe(false);
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

// ============================================================================
// ENTITY_GALLERY_CAPS + getGalleryCap (SSOT for per-entity gallery limits)
// ============================================================================

describe('ENTITY_GALLERY_CAPS', () => {
    it('should define accommodation cap as 50', () => {
        expect(ENTITY_GALLERY_CAPS.accommodation).toBe(50);
    });

    it('should define destination cap as 20', () => {
        expect(ENTITY_GALLERY_CAPS.destination).toBe(20);
    });

    it('should define event cap as 10', () => {
        expect(ENTITY_GALLERY_CAPS.event).toBe(10);
    });

    it('should define post cap as 15', () => {
        expect(ENTITY_GALLERY_CAPS.post).toBe(15);
    });

    it('should export all four gallery entity cap keys', () => {
        // Verify that all expected keys are present and hold numeric values.
        const keys = Object.keys(ENTITY_GALLERY_CAPS);
        expect(keys).toContain('accommodation');
        expect(keys).toContain('destination');
        expect(keys).toContain('event');
        expect(keys).toContain('post');
        for (const key of keys) {
            expect(typeof ENTITY_GALLERY_CAPS[key as keyof typeof ENTITY_GALLERY_CAPS]).toBe(
                'number'
            );
        }
    });
});

describe('MAX_GALLERY_CAP_FALLBACK', () => {
    it('should be a positive integer', () => {
        expect(MAX_GALLERY_CAP_FALLBACK).toBeGreaterThan(0);
        expect(Number.isInteger(MAX_GALLERY_CAP_FALLBACK)).toBe(true);
    });
});

describe('getGalleryCap', () => {
    it('should return 50 for accommodation', () => {
        expect(getGalleryCap('accommodation')).toBe(50);
    });

    it('should return 20 for destination', () => {
        expect(getGalleryCap('destination')).toBe(20);
    });

    it('should return 10 for event', () => {
        expect(getGalleryCap('event')).toBe(10);
    });

    it('should return 15 for post', () => {
        expect(getGalleryCap('post')).toBe(15);
    });

    it('should return MAX_GALLERY_CAP_FALLBACK for an unknown entity type', () => {
        expect(getGalleryCap('unknown')).toBe(MAX_GALLERY_CAP_FALLBACK);
    });

    it('should return MAX_GALLERY_CAP_FALLBACK for an empty string', () => {
        expect(getGalleryCap('')).toBe(MAX_GALLERY_CAP_FALLBACK);
    });

    it('should return MAX_GALLERY_CAP_FALLBACK for a case-mismatched entity type', () => {
        // Entity types are lowercase; 'Accommodation' is not a known key.
        expect(getGalleryCap('Accommodation')).toBe(MAX_GALLERY_CAP_FALLBACK);
    });

    it('should return a number for all four gallery entity types', () => {
        const galleryEntities = ['accommodation', 'destination', 'event', 'post'] as const;
        for (const entity of galleryEntities) {
            const cap = getGalleryCap(entity);
            expect(typeof cap).toBe('number');
            expect(cap).toBeGreaterThan(0);
        }
    });
});

// ============================================================================
// Commerce media support (SPEC-249 T-015a)
// ============================================================================

describe('Commerce media entity types', () => {
    it('MediaEntityTypeSchema accepts gastronomy and experience', () => {
        expect(MediaEntityTypeSchema.safeParse('gastronomy').success).toBe(true);
        expect(MediaEntityTypeSchema.safeParse('experience').success).toBe(true);
    });

    it('defines gallery caps for both commerce verticals', () => {
        expect(ENTITY_GALLERY_CAPS.gastronomy).toBe(30);
        expect(ENTITY_GALLERY_CAPS.experience).toBe(30);
        expect(getGalleryCap('gastronomy')).toBe(30);
        expect(getGalleryCap('experience')).toBe(30);
    });

    it('resolves storage folders for commerce verticals', () => {
        expect(ENTITY_FOLDER_MAP.gastronomy({ environment: 'test', entityId: 'g1' })).toBe(
            'hospeda/test/gastronomies/g1'
        );
        expect(ENTITY_FOLDER_MAP.experience({ environment: 'test', entityId: 'e1' })).toBe(
            'hospeda/test/experiences/e1'
        );
    });

    it('throws when a commerce folder resolver is missing entityId', () => {
        expect(() => ENTITY_FOLDER_MAP.gastronomy({ environment: 'test' })).toThrow();
        expect(() => ENTITY_FOLDER_MAP.experience({ environment: 'test' })).toThrow();
    });
});
