import { describe, expect, it } from 'vitest';
import { TagI18nKeysSchema } from '../../entities/tag/tag.i18n.schema.js';

// ============================================================================
// Test fixture — a complete, valid i18n keys object for all required groups
// ============================================================================

/** Complete valid fixture covering every leaf key in TagI18nKeysSchema. */
const VALID_KEYS = {
    tags: {
        type: {
            INTERNAL: 'Internal',
            SYSTEM: 'System',
            USER: 'User'
        },
        lifecycle: {
            ACTIVE: 'Active',
            INACTIVE: 'Inactive',
            ARCHIVED: 'Archived'
        },
        errors: {
            quotaExceeded: 'Tag quota exceeded',
            nameConflict: 'A tag with that name already exists',
            internalNotVisible: 'This tag is not available',
            entityNotAccessible: 'You do not have access to this entity',
            notFound: 'Tag not found'
        },
        picker: {
            title: 'Add tags',
            searchPlaceholder: 'Search tags…',
            empty: 'No tags found',
            createNew: 'Create new tag',
            quotaReached: 'You have reached the tag limit',
            groupSystem: 'System tags',
            groupInternal: 'Internal tags',
            groupUser: 'Your tags'
        },
        manager: {
            title: 'My tags',
            quotaIndicator: '{used} / {max} tags used',
            emptyState: 'You have not created any tags yet',
            deleteConfirm: 'Are you sure you want to delete this tag?'
        },
        admin: {
            title: 'Tag management',
            createButton: 'Create tag',
            filterByType: 'Filter by type',
            filterByLifecycle: 'Filter by status'
        },
        delete: {
            title: 'Delete tag',
            confirmButton: 'Delete',
            cancelButton: 'Cancel',
            impactCount: 'This tag is used in {count} places'
        }
    },
    postTags: {
        admin: {
            title: 'Post tag management',
            createButton: 'Create post tag',
            slugLabel: 'Slug',
            duplicateSlugError: 'A post tag with this slug already exists'
        }
    }
} as const;

// ============================================================================
// TagI18nKeysSchema — happy path
// ============================================================================

describe('TagI18nKeysSchema', () => {
    describe('when given a complete, valid keys object', () => {
        it('should parse successfully', () => {
            // Arrange / Act
            const result = TagI18nKeysSchema.safeParse(VALID_KEYS);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should preserve all string values unchanged', () => {
            // Arrange / Act
            const result = TagI18nKeysSchema.safeParse(VALID_KEYS);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.tags.type.INTERNAL).toBe('Internal');
                expect(result.data.tags.errors.quotaExceeded).toBe('Tag quota exceeded');
                expect(result.data.postTags.admin.duplicateSlugError).toBe(
                    'A post tag with this slug already exists'
                );
            }
        });
    });

    // ============================================================================
    // tags.type — missing individual keys
    // ============================================================================

    describe('tags.type', () => {
        it('should fail when INTERNAL is missing', () => {
            const { INTERNAL: _removed, ...rest } = VALID_KEYS.tags.type;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, type: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when SYSTEM is missing', () => {
            const { SYSTEM: _removed, ...rest } = VALID_KEYS.tags.type;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, type: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when USER is missing', () => {
            const { USER: _removed, ...rest } = VALID_KEYS.tags.type;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, type: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // tags.lifecycle — missing individual keys
    // ============================================================================

    describe('tags.lifecycle', () => {
        it('should fail when ACTIVE is missing', () => {
            const { ACTIVE: _removed, ...rest } = VALID_KEYS.tags.lifecycle;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, lifecycle: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when INACTIVE is missing', () => {
            const { INACTIVE: _removed, ...rest } = VALID_KEYS.tags.lifecycle;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, lifecycle: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when ARCHIVED is missing', () => {
            const { ARCHIVED: _removed, ...rest } = VALID_KEYS.tags.lifecycle;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, lifecycle: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // tags.errors — missing individual keys
    // ============================================================================

    describe('tags.errors', () => {
        it('should fail when quotaExceeded is missing', () => {
            const { quotaExceeded: _removed, ...rest } = VALID_KEYS.tags.errors;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, errors: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when nameConflict is missing', () => {
            const { nameConflict: _removed, ...rest } = VALID_KEYS.tags.errors;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, errors: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when notFound is missing', () => {
            const { notFound: _removed, ...rest } = VALID_KEYS.tags.errors;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, errors: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // tags.picker — missing individual keys
    // ============================================================================

    describe('tags.picker', () => {
        it('should fail when title is missing', () => {
            const { title: _removed, ...rest } = VALID_KEYS.tags.picker;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, picker: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when quotaReached is missing', () => {
            const { quotaReached: _removed, ...rest } = VALID_KEYS.tags.picker;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, picker: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when groupSystem is missing', () => {
            const { groupSystem: _removed, ...rest } = VALID_KEYS.tags.picker;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, picker: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // tags.manager — missing individual keys
    // ============================================================================

    describe('tags.manager', () => {
        it('should fail when emptyState is missing', () => {
            const { emptyState: _removed, ...rest } = VALID_KEYS.tags.manager;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, manager: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when deleteConfirm is missing', () => {
            const { deleteConfirm: _removed, ...rest } = VALID_KEYS.tags.manager;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, manager: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // tags.admin — missing individual keys
    // ============================================================================

    describe('tags.admin', () => {
        it('should fail when createButton is missing', () => {
            const { createButton: _removed, ...rest } = VALID_KEYS.tags.admin;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, admin: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when filterByLifecycle is missing', () => {
            const { filterByLifecycle: _removed, ...rest } = VALID_KEYS.tags.admin;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, admin: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // tags.delete — missing individual keys
    // ============================================================================

    describe('tags.delete', () => {
        it('should fail when impactCount is missing', () => {
            const { impactCount: _removed, ...rest } = VALID_KEYS.tags.delete;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, delete: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when confirmButton is missing', () => {
            const { confirmButton: _removed, ...rest } = VALID_KEYS.tags.delete;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: { ...VALID_KEYS.tags, delete: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // postTags.admin — missing individual keys
    // ============================================================================

    describe('postTags.admin', () => {
        it('should fail when title is missing', () => {
            const { title: _removed, ...rest } = VALID_KEYS.postTags.admin;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                postTags: { admin: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when duplicateSlugError is missing', () => {
            const { duplicateSlugError: _removed, ...rest } = VALID_KEYS.postTags.admin;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                postTags: { admin: rest }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when slugLabel is missing', () => {
            const { slugLabel: _removed, ...rest } = VALID_KEYS.postTags.admin;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                postTags: { admin: rest }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // Missing top-level groups
    // ============================================================================

    describe('when a required top-level group is missing', () => {
        it('should fail when the entire tags.type group is absent', () => {
            const { type: _removed, ...tagsWithoutType } = VALID_KEYS.tags;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: tagsWithoutType
            });
            expect(result.success).toBe(false);
        });

        it('should fail when the entire tags.errors group is absent', () => {
            const { errors: _removed, ...tagsWithoutErrors } = VALID_KEYS.tags;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: tagsWithoutErrors
            });
            expect(result.success).toBe(false);
        });

        it('should fail when the entire tags.picker group is absent', () => {
            const { picker: _removed, ...tagsWithoutPicker } = VALID_KEYS.tags;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: tagsWithoutPicker
            });
            expect(result.success).toBe(false);
        });

        it('should fail when the entire tags.manager group is absent', () => {
            const { manager: _removed, ...tagsWithoutManager } = VALID_KEYS.tags;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: tagsWithoutManager
            });
            expect(result.success).toBe(false);
        });

        it('should fail when the entire tags.admin group is absent', () => {
            const { admin: _removed, ...tagsWithoutAdmin } = VALID_KEYS.tags;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: tagsWithoutAdmin
            });
            expect(result.success).toBe(false);
        });

        it('should fail when the entire tags.delete group is absent', () => {
            const { delete: _removed, ...tagsWithoutDelete } = VALID_KEYS.tags;
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: tagsWithoutDelete
            });
            expect(result.success).toBe(false);
        });

        it('should fail when the entire tags namespace is absent', () => {
            const { tags: _removed, ...withoutTags } = VALID_KEYS;
            const result = TagI18nKeysSchema.safeParse(withoutTags);
            expect(result.success).toBe(false);
        });

        it('should fail when the entire postTags namespace is absent', () => {
            const { postTags: _removed, ...withoutPostTags } = VALID_KEYS;
            const result = TagI18nKeysSchema.safeParse(withoutPostTags);
            expect(result.success).toBe(false);
        });

        it('should fail when the entire postTags.admin group is absent', () => {
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                postTags: {}
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // Type safety — non-string values
    // ============================================================================

    describe('when a key holds a non-string value', () => {
        it('should fail when tags.type.INTERNAL is a number', () => {
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: {
                    ...VALID_KEYS.tags,
                    type: { ...VALID_KEYS.tags.type, INTERNAL: 42 }
                }
            });
            expect(result.success).toBe(false);
        });

        it('should fail when postTags.admin.title is null', () => {
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                postTags: {
                    admin: { ...VALID_KEYS.postTags.admin, title: null }
                }
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // Edge — empty strings are valid (tooling may still flag them separately)
    // ============================================================================

    describe('empty strings', () => {
        it('should accept empty strings (completeness check is done by tooling, not this schema)', () => {
            const result = TagI18nKeysSchema.safeParse({
                ...VALID_KEYS,
                tags: {
                    ...VALID_KEYS.tags,
                    type: { INTERNAL: '', SYSTEM: '', USER: '' }
                }
            });
            expect(result.success).toBe(true);
        });
    });
});
