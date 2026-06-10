import { describe, expect, it } from 'vitest';
import {
    contentModerationTermSchema,
    createContentModerationTermSchema,
    updateContentModerationTermSchema
} from '../../../src/entities/contentModeration/index.js';

describe('content moderation term schemas', () => {
    it('trims term values in persisted entity schema', () => {
        const result = contentModerationTermSchema.parse({
            id: crypto.randomUUID(),
            term: ' spam ',
            kind: 'word',
            category: 'other',
            severity: 1,
            enabled: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            createdById: null,
            updatedById: null
        });

        expect(result.term).toBe('spam');
    });

    it('rejects blank terms after trim on create', () => {
        const result = createContentModerationTermSchema.safeParse({
            term: '   ',
            kind: 'word',
            category: 'other',
            severity: 1,
            enabled: true
        });

        expect(result.success).toBe(false);
    });

    it('trims update payload term values', () => {
        const result = updateContentModerationTermSchema.parse({
            term: ' evil.com '
        });

        expect(result.term).toBe('evil.com');
    });
});
