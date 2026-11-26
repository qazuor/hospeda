/**
 * HOS-2199: `accommodation_review_replies` table schema tests (in-process, no database).
 *
 * The one rule worth freezing: ONE LIVE reply per review. The unique index is
 * PARTIAL (`WHERE deleted_at IS NULL`) so a soft-deleted reply frees the slot
 * and the host can answer again. A full unique index would block that.
 */
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { accommodationReviewReplies } from '../../../src/schemas/accommodation/accommodation_review_reply.dbschema.ts';

const config = getTableConfig(accommodationReviewReplies);
const column = (name: string) => config.columns.find((c) => c.name === name);

describe('accommodation_review_replies table', () => {
    it('has the SQL table name', () => {
        expect(config.name).toBe('accommodation_review_replies');
    });

    it('requires the review, the author and the text', () => {
        for (const name of ['review_id', 'author_user_id', 'content']) {
            expect(column(name)?.notNull, name).toBe(true);
        }
    });

    it('is born APPROVED: it publishes at once unless the filter flags it', () => {
        expect(column('moderation_state')?.default).toBe('APPROVED');
    });

    it('keeps the soft-delete and edit columns nullable', () => {
        for (const name of ['edited_at', 'deleted_at', 'deleted_by_id', 'moderated_by_id']) {
            expect(column(name)?.notNull, name).toBe(false);
        }
    });

    it('allows one LIVE reply per review through a partial unique index', () => {
        const unique = config.indexes.find(
            (i) => i.config.name === 'accommodationReviewReplies_reviewId_live_uniq'
        );
        expect(unique?.config.unique).toBe(true);
        expect(unique?.config.where).toBeDefined();
        expect(unique?.config.columns.map((c) => (c as { name: string }).name)).toEqual([
            'review_id'
        ]);
    });
});
