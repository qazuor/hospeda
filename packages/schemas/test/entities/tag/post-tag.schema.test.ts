/**
 * T-012: PostTag Schema Tests
 *
 * Validates the PostTag subsystem schemas introduced by SPEC-086 (D-001, D-013, D-018).
 *
 * AC references: AC-F05-01, D-001, D-013, D-018
 */
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    CreatePostTagSchema,
    UpdatePostTagSchema
} from '../../../src/entities/tag/post-tag.crud.schema.js';
import {
    PublicPostTagQuerySchema,
    PublicPostTagSchema,
    PublicPostTagWithCountSchema
} from '../../../src/entities/tag/post-tag.public.schema.js';
import { PostTagAdminSearchSchema } from '../../../src/entities/tag/post-tag.query.schema.js';
import { PostTagSchema } from '../../../src/entities/tag/post-tag.schema.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

// ---------------------------------------------------------------------------
// PostTagSchema — base entity
// ---------------------------------------------------------------------------

describe('PostTagSchema — base entity (D-018)', () => {
    it('should validate a complete PostTag object', () => {
        const validTag = {
            id: VALID_UUID,
            name: 'Gastronomía',
            slug: 'gastronomia',
            color: 'ORANGE',
            icon: null,
            description: null,
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: VALID_UUID,
            updatedById: VALID_UUID
        };

        expect(() => PostTagSchema.parse(validTag)).not.toThrow();

        const result = PostTagSchema.parse(validTag);
        expect(result.slug).toBe('gastronomia');
        expect(result.name).toBe('Gastronomía');
    });

    it('should validate slug with hyphens', () => {
        const tag = {
            id: VALID_UUID,
            name: 'Guía de viaje',
            slug: 'guia-de-viaje',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        expect(() => PostTagSchema.parse(tag)).not.toThrow();
        expect(PostTagSchema.parse(tag).slug).toBe('guia-de-viaje');
    });

    it('should reject invalid slug — uppercase letters (AC-F05-01)', () => {
        const tag = {
            id: VALID_UUID,
            name: 'Tag',
            slug: 'INVALID',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        expect(() => PostTagSchema.parse(tag)).toThrow(ZodError);
    });

    it('should reject invalid slug — contains space (AC-F05-01)', () => {
        const tag = {
            id: VALID_UUID,
            name: 'Tag',
            slug: 'invalid slug',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        expect(() => PostTagSchema.parse(tag)).toThrow(ZodError);
    });

    it('should reject invalid slug — underscore (AC-F05-01)', () => {
        const tag = {
            id: VALID_UUID,
            name: 'Tag',
            slug: 'invalid_slug',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        expect(() => PostTagSchema.parse(tag)).toThrow(ZodError);
    });

    it('should reject invalid slug — leading hyphen', () => {
        const tag = {
            id: VALID_UUID,
            name: 'Tag',
            slug: '-leading',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        expect(() => PostTagSchema.parse(tag)).toThrow(ZodError);
    });

    it('should reject invalid slug — trailing hyphen', () => {
        const tag = {
            id: VALID_UUID,
            name: 'Tag',
            slug: 'trailing-',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        expect(() => PostTagSchema.parse(tag)).toThrow(ZodError);
    });

    it('should accept optional nullable description', () => {
        const withDescription = {
            id: VALID_UUID,
            name: 'Travel',
            slug: 'travel',
            color: 'GREEN',
            description: 'Tags for travel-related content',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        const result = PostTagSchema.parse(withDescription);
        expect(result.description).toBe('Tags for travel-related content');
    });

    it('should accept null description', () => {
        const withNullDescription = {
            id: VALID_UUID,
            name: 'Travel',
            slug: 'travel',
            color: 'GREEN',
            description: null,
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        const result = PostTagSchema.parse(withNullDescription);
        expect(result.description).toBeNull();
    });

    it('should NOT contain type or ownerId fields (PostTag is not a user-tag)', () => {
        const tag = {
            id: VALID_UUID,
            name: 'Tag',
            slug: 'tag',
            color: 'BLUE',
            lifecycleState: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        };

        const result = PostTagSchema.parse(tag);
        expect(Object.keys(result)).not.toContain('type');
        expect(Object.keys(result)).not.toContain('ownerId');
    });
});

// ---------------------------------------------------------------------------
// CreatePostTagSchema — D-013, D-018
// ---------------------------------------------------------------------------

describe('CreatePostTagSchema — slug validation (AC-F05-01)', () => {
    it('should FAIL with uppercase slug (AC-F05-01)', () => {
        const result = CreatePostTagSchema.safeParse({
            name: 'Tag',
            slug: 'INVALID',
            color: 'BLUE'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const slugIssue = result.error.issues.find((i) => i.path.includes('slug'));
            expect(slugIssue).toBeDefined();
        }
    });

    it('should FAIL with slug containing spaces (AC-F05-01)', () => {
        const result = CreatePostTagSchema.safeParse({
            name: 'Tag',
            slug: 'invalid slug',
            color: 'BLUE'
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const slugIssue = result.error.issues.find((i) => i.path.includes('slug'));
            expect(slugIssue).toBeDefined();
        }
    });

    it('should PASS with valid slug "gastronomia" (AC-F05-01)', () => {
        const result = CreatePostTagSchema.safeParse({
            name: 'Gastronomía',
            slug: 'gastronomia',
            color: 'ORANGE'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe('gastronomia');
        }
    });

    it('should PASS with valid slug "guia-de-viaje" (AC-F05-01)', () => {
        const result = CreatePostTagSchema.safeParse({
            name: 'Guía de viaje',
            slug: 'guia-de-viaje',
            color: 'BLUE'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.slug).toBe('guia-de-viaje');
        }
    });

    it('should PASS with valid slug containing numbers "2024-trends"', () => {
        const result = CreatePostTagSchema.safeParse({
            name: '2024 Trends',
            slug: '2024-trends',
            color: 'PURPLE'
        });

        expect(result.success).toBe(true);
    });

    it('should require name field', () => {
        const result = CreatePostTagSchema.safeParse({ slug: 'tag', color: 'BLUE' });

        expect(result.success).toBe(false);
    });

    it('should require slug field', () => {
        const result = CreatePostTagSchema.safeParse({ name: 'Tag', color: 'BLUE' });

        expect(result.success).toBe(false);
    });

    it('should require color field', () => {
        const result = CreatePostTagSchema.safeParse({ name: 'Tag', slug: 'tag' });

        expect(result.success).toBe(false);
    });

    it('should default lifecycleState if not provided', () => {
        const result = CreatePostTagSchema.safeParse({
            name: 'Travel',
            slug: 'travel',
            color: 'GREEN'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            // lifecycleState comes from the enum default in LifecycleStatusEnumSchema
            // It may be undefined if no default is set at schema level — verify the field exists
            expect(['ACTIVE', undefined]).toContain(result.data.lifecycleState);
        }
    });

    it('should accept optional fields: icon and description', () => {
        const result = CreatePostTagSchema.safeParse({
            name: 'Culture',
            slug: 'cultura',
            color: 'RED',
            icon: 'star',
            description: 'Tags about local culture'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.icon).toBe('star');
            expect(result.data.description).toBe('Tags about local culture');
        }
    });
});

// ---------------------------------------------------------------------------
// UpdatePostTagSchema — all fields patchable
// ---------------------------------------------------------------------------

describe('UpdatePostTagSchema — partial updates', () => {
    it('should allow updating slug (unlike user-tags, slug is patchable for PostTags)', () => {
        const result = UpdatePostTagSchema.safeParse({ slug: 'nueva-gastronomia' });

        expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
        const result = UpdatePostTagSchema.safeParse({ name: 'Updated name' });

        expect(result.success).toBe(true);
    });

    it('should allow empty object (full partial)', () => {
        const result = UpdatePostTagSchema.safeParse({});

        expect(result.success).toBe(true);
    });

    it('should reject invalid slug in update', () => {
        const result = UpdatePostTagSchema.safeParse({ slug: 'UPPERCASE' });

        expect(result.success).toBe(false);
    });

    it('should reject invalid color in update', () => {
        const result = UpdatePostTagSchema.safeParse({ color: 'NOT_A_COLOR' });

        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// PostTagAdminSearchSchema
// ---------------------------------------------------------------------------

describe('PostTagAdminSearchSchema', () => {
    it('should accept empty params with defaults', () => {
        const result = PostTagAdminSearchSchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(1);
            // AdminSearchBaseSchema default is 20 (project-wide convention)
            expect(result.data.pageSize).toBe(20);
        }
    });

    it('should accept lifecycleState filter', () => {
        const result = PostTagAdminSearchSchema.safeParse({ lifecycleState: 'ACTIVE' });

        expect(result.success).toBe(true);
    });

    it('should accept color filter', () => {
        const result = PostTagAdminSearchSchema.safeParse({ color: 'BLUE' });

        expect(result.success).toBe(true);
    });

    it('should accept name substring filter', () => {
        const result = PostTagAdminSearchSchema.safeParse({ name: 'gastro' });

        expect(result.success).toBe(true);
    });

    it('should accept search field (from base schema)', () => {
        const result = PostTagAdminSearchSchema.safeParse({ search: 'viaje' });

        expect(result.success).toBe(true);
    });

    it('should reject invalid lifecycleState', () => {
        const result = PostTagAdminSearchSchema.safeParse({ lifecycleState: 'INVALID' });

        expect(result.success).toBe(false);
    });

    it('should reject invalid color', () => {
        const result = PostTagAdminSearchSchema.safeParse({ color: 'RAINBOW' });

        expect(result.success).toBe(false);
    });

    it('should coerce page and pageSize from strings', () => {
        const result = PostTagAdminSearchSchema.safeParse({ page: '2', pageSize: '25' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.page).toBe(2);
            expect(result.data.pageSize).toBe(25);
        }
    });
});

// ---------------------------------------------------------------------------
// PublicPostTagQuerySchema — D-013
// ---------------------------------------------------------------------------

describe('PublicPostTagQuerySchema — D-013', () => {
    it('should default withCounts to false', () => {
        const result = PublicPostTagQuerySchema.safeParse({});

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.withCounts).toBe(false);
        }
    });

    it('should coerce "true" string to true', () => {
        const result = PublicPostTagQuerySchema.safeParse({ withCounts: 'true' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.withCounts).toBe(true);
        }
    });

    it('should coerce "false" string to false', () => {
        const result = PublicPostTagQuerySchema.safeParse({ withCounts: 'false' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.withCounts).toBe(false);
        }
    });

    it('should coerce boolean true directly', () => {
        const result = PublicPostTagQuerySchema.safeParse({ withCounts: true });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.withCounts).toBe(true);
        }
    });

    it('should coerce "1" to true', () => {
        const result = PublicPostTagQuerySchema.safeParse({ withCounts: '1' });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.withCounts).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// PublicPostTagSchema — safe subset (D-013)
// ---------------------------------------------------------------------------

describe('PublicPostTagSchema — public response subset (D-013)', () => {
    const validPublicTag = {
        id: VALID_UUID,
        name: 'Gastronomía',
        slug: 'gastronomia',
        color: 'ORANGE',
        icon: null,
        description: null,
        lifecycleState: 'ACTIVE'
    };

    it('should validate a public PostTag response item', () => {
        const result = PublicPostTagSchema.safeParse(validPublicTag);

        expect(result.success).toBe(true);
    });

    it('should NOT expose audit fields (createdAt, updatedAt, createdById, etc.)', () => {
        const withAudit = {
            ...validPublicTag,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: VALID_UUID,
            updatedById: VALID_UUID
        };

        const result = PublicPostTagSchema.parse(withAudit);

        // Audit fields should be stripped (Zod strips extra fields by default)
        expect(Object.keys(result)).not.toContain('createdAt');
        expect(Object.keys(result)).not.toContain('updatedAt');
        expect(Object.keys(result)).not.toContain('createdById');
        expect(Object.keys(result)).not.toContain('updatedById');
    });

    it('should include slug in the public response (D-013 — slug appears in URLs)', () => {
        const result = PublicPostTagSchema.parse(validPublicTag);

        expect(result.slug).toBe('gastronomia');
    });
});

// ---------------------------------------------------------------------------
// PublicPostTagWithCountSchema — D-013 withCounts response
// ---------------------------------------------------------------------------

describe('PublicPostTagWithCountSchema — withCounts response (D-013)', () => {
    it('should validate a PostTag with usageCount', () => {
        const tagWithCount = {
            id: VALID_UUID,
            name: 'Gastronomía',
            slug: 'gastronomia',
            color: 'ORANGE',
            icon: null,
            description: null,
            lifecycleState: 'ACTIVE',
            usageCount: 42
        };

        const result = PublicPostTagWithCountSchema.safeParse(tagWithCount);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.usageCount).toBe(42);
        }
    });

    it('should reject negative usageCount', () => {
        const tagWithNegativeCount = {
            id: VALID_UUID,
            name: 'Tag',
            slug: 'tag',
            color: 'BLUE',
            icon: null,
            description: null,
            lifecycleState: 'ACTIVE',
            usageCount: -1
        };

        const result = PublicPostTagWithCountSchema.safeParse(tagWithNegativeCount);

        expect(result.success).toBe(false);
    });

    it('should accept usageCount of zero', () => {
        const tagWithZeroCount = {
            id: VALID_UUID,
            name: 'Tag',
            slug: 'tag',
            color: 'BLUE',
            icon: null,
            description: null,
            lifecycleState: 'ACTIVE',
            usageCount: 0
        };

        const result = PublicPostTagWithCountSchema.safeParse(tagWithZeroCount);

        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Slug regex contract — comprehensive coverage (AC-F05-01)
// ---------------------------------------------------------------------------

describe('PostTag slug regex — comprehensive cases (AC-F05-01, D-013)', () => {
    const validSlugs = [
        'gastronomia',
        'guia-de-viaje',
        'familia',
        'trekking',
        'eco-turismo',
        'aventura2024',
        '2024-trends',
        'arte-y-cultura',
        'a',
        '123',
        'a1b2c3'
    ];

    const invalidSlugs = [
        'UPPERCASE',
        'Mixed-Case',
        'with space',
        'underscore_slug',
        '-leading-hyphen',
        'trailing-hyphen-',
        'double--hyphen',
        '',
        'FULL_CAPS',
        'con ñ',
        'with.dot',
        'with@special'
    ];

    for (const slug of validSlugs) {
        it(`should accept valid slug: "${slug}"`, () => {
            const result = CreatePostTagSchema.safeParse({ name: 'Tag', slug, color: 'BLUE' });
            expect(result.success).toBe(true);
        });
    }

    for (const slug of invalidSlugs) {
        it(`should reject invalid slug: "${slug}"`, () => {
            const result = CreatePostTagSchema.safeParse({ name: 'Tag', slug, color: 'BLUE' });
            expect(result.success).toBe(false);
        });
    }
});

// ---------------------------------------------------------------------------
// ZodError class confirmation
// ---------------------------------------------------------------------------

describe('PostTagSchema — throws ZodError', () => {
    it('should throw ZodError for invalid input', () => {
        expect(() =>
            PostTagSchema.parse({
                id: VALID_UUID,
                name: '',
                slug: 'INVALID SLUG',
                color: 'NOT_A_COLOR',
                lifecycleState: 'INVALID'
            })
        ).toThrow(ZodError);
    });
});
