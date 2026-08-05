/**
 * @file transform-post-edit-detail.test.ts
 * @description Unit tests for `transformPostEditDetail` (HOS-374 Phase 2 2C-2),
 * the raw `GET /protected/posts/:id` → `PostEditDetail` mapping that seeds the
 * editor form.
 *
 * Its fallbacks are the point: they decide what the FORM holds before the
 * author touches anything, and therefore what the very first PATCH would send.
 */

import { describe, expect, it } from 'vitest';
import { transformPostEditDetail } from '../../../src/lib/api/transforms';

const DESTINATION_ID = '11111111-1111-4111-8111-111111111111';

const RAW = {
    id: 'post-1',
    slug: 'una-nota',
    title: 'Una nota',
    summary: 'Un resumen',
    content: 'Un cuerpo',
    category: 'CULTURE',
    readingTimeMinutes: 7,
    relatedDestinationId: DESTINATION_ID,
    moderationState: 'APPROVED',
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE'
};

describe('transformPostEditDetail', () => {
    it('maps every editable field plus the three state columns', () => {
        expect(transformPostEditDetail({ item: RAW })).toEqual({
            id: 'post-1',
            slug: 'una-nota',
            title: 'Una nota',
            summary: 'Un resumen',
            content: 'Un cuerpo',
            category: 'CULTURE',
            readingTimeMinutes: 7,
            relatedDestinationId: DESTINATION_ID,
            moderationState: 'APPROVED',
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });
    });

    it('falls back to the most conservative state values when they are missing', () => {
        const result = transformPostEditDetail({ item: { id: 'post-1' } });

        // Never to a value that reads as "already live" — which here would
        // also flip the edit-lock decision the hosting page derives from
        // `moderationState`.
        expect(result.moderationState).toBe('PENDING');
        expect(result.visibility).toBe('PRIVATE');
        expect(result.lifecycleState).toBe('DRAFT');
    });

    it('keeps a missing reading time as null instead of a number', () => {
        const result = transformPostEditDetail({ item: { ...RAW, readingTimeMinutes: undefined } });

        // A `0` here would be a real (and invalid) value the author never
        // typed, and it would ship in the first PATCH as an edit.
        expect(result.readingTimeMinutes).toBeNull();
        expect(result.readingTimeMinutes).not.toBe(0);
    });

    it('keeps a missing related destination as null instead of an empty string', () => {
        const result = transformPostEditDetail({
            item: { ...RAW, relatedDestinationId: null }
        });

        expect(result.relatedDestinationId).toBeNull();
    });

    it('ignores a non-numeric reading time rather than coercing it', () => {
        const result = transformPostEditDetail({ item: { ...RAW, readingTimeMinutes: '7' } });

        expect(result.readingTimeMinutes).toBeNull();
    });
});
