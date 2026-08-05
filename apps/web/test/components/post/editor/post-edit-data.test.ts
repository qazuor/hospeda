/**
 * @file post-edit-data.test.ts
 * @description Unit tests for the post editor's PATCH-diff contract
 * (HOS-374 Phase 2 2C-2).
 *
 * The diff is the piece that decides what actually reaches the API, so it is
 * tested here as pure logic rather than only through a mounted editor.
 *
 * @module test/components/post/editor/post-edit-data
 */

import { describe, expect, it } from 'vitest';
import type { PostEditFormData } from '../../../../src/components/post/editor/post-edit-data';
import {
    buildPostEditFormData,
    buildPostPatchPayload
} from '../../../../src/components/post/editor/post-edit-data';
import type { PostEditDetail } from '../../../../src/lib/api/types';

const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';

const DETAIL: PostEditDetail = {
    id: 'post-1',
    slug: 'una-nota',
    title: 'Una nota',
    summary: 'Un resumen suficientemente largo',
    content: 'x'.repeat(150),
    category: 'CULTURE',
    readingTimeMinutes: 5,
    relatedDestinationId: DESTINATION_ID,
    moderationState: 'PENDING',
    visibility: 'PRIVATE',
    lifecycleState: 'ACTIVE'
};

/** Builds a form state from the shared detail, overriding the given fields. */
function formData(overrides: Partial<PostEditFormData> = {}): PostEditFormData {
    return { ...buildPostEditFormData({ detail: DETAIL }), ...overrides };
}

describe('buildPostEditFormData', () => {
    it('seeds every editable field from the fetched post', () => {
        expect(buildPostEditFormData({ detail: DETAIL })).toEqual({
            title: 'Una nota',
            summary: 'Un resumen suficientemente largo',
            content: 'x'.repeat(150),
            category: 'CULTURE',
            readingTimeMinutes: 5,
            relatedDestinationId: DESTINATION_ID
        });
    });

    it('maps a null related destination to the empty select value', () => {
        // A `<select>` cannot hold `null`; leaving it as null would make React
        // treat the control as uncontrolled and warn on the first change.
        const data = buildPostEditFormData({
            detail: { ...DETAIL, relatedDestinationId: null }
        });

        expect(data.relatedDestinationId).toBe('');
    });

    it('keeps a null reading time as null rather than coercing it to a number', () => {
        const data = buildPostEditFormData({
            detail: { ...DETAIL, readingTimeMinutes: null }
        });

        expect(data.readingTimeMinutes).toBeNull();
    });
});

describe('buildPostPatchPayload', () => {
    it('is empty when nothing changed', () => {
        const baseline = formData();

        expect(buildPostPatchPayload({ current: baseline, baseline })).toEqual({});
    });

    it('sends only the fields that changed', () => {
        const baseline = formData();
        const current = formData({ title: 'Otro título' });

        expect(buildPostPatchPayload({ current, baseline })).toEqual({ title: 'Otro título' });
    });

    it('renames relatedDestinationId to the destinationId key the HTTP schema accepts', () => {
        const baseline = formData();
        const other = '22222222-2222-4222-8222-222222222222';
        const current = formData({ relatedDestinationId: other });

        const payload = buildPostPatchPayload({ current, baseline });

        // `PostUpdateHttpSchema` has no `relatedDestinationId` key, and an
        // unknown key is dropped — the edit would silently never persist.
        expect(payload).toEqual({ destinationId: other });
        expect(payload).not.toHaveProperty('relatedDestinationId');
    });

    it('clears the destination with undefined, never with null', () => {
        const baseline = formData();
        const current = formData({ relatedDestinationId: '' });

        const payload = buildPostPatchPayload({ current, baseline });

        // The HTTP schema types it `z.string().uuid().optional()`, so an
        // explicit null fails validation on every clear.
        expect(payload).toHaveProperty('destinationId');
        expect(payload.destinationId).toBeUndefined();
        expect(payload.destinationId).not.toBeNull();
    });

    it('sends a cleared reading time as null so the server sees the clear', () => {
        const baseline = formData();
        const current = formData({ readingTimeMinutes: null });

        expect(buildPostPatchPayload({ current, baseline })).toEqual({
            readingTimeMinutes: null
        });
    });

    it('never emits the publication state columns, whatever changed', () => {
        const baseline = formData();
        const current = formData({
            title: 'T',
            summary: 'S',
            content: 'C',
            category: 'NATURE',
            readingTimeMinutes: 9,
            relatedDestinationId: ''
        });

        const payload = buildPostPatchPayload({ current, baseline });

        // §7.6.4: leaving these in the generic payload makes every publication
        // gate bypassable by editing the field directly.
        expect(payload).not.toHaveProperty('visibility');
        expect(payload).not.toHaveProperty('moderationState');
        expect(payload).not.toHaveProperty('lifecycleState');
        // `isPublished` maps to the `publishedAt` timestamp and publishes
        // nothing — it must not travel here either.
        expect(payload).not.toHaveProperty('isPublished');
        // Editorial curation is not the author's to set.
        expect(payload).not.toHaveProperty('isFeatured');
        // The public URL is immutable post-create.
        expect(payload).not.toHaveProperty('slug');
    });

    it('detects a revert against the resynced baseline, not the load-time values', () => {
        // HOS-190 F6: after a save the baseline moves to the persisted values,
        // so typing the ORIGINAL value back is a real change to be sent.
        const saved = formData({ title: 'Título guardado' });
        const revertedToOriginal = formData();

        expect(buildPostPatchPayload({ current: revertedToOriginal, baseline: saved })).toEqual({
            title: 'Una nota'
        });
    });
});
