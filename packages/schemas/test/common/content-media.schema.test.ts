/**
 * @file content-media.schema.test.ts
 * @description Tests for the editorial-content media row shape (HOS-390) and,
 * more importantly, a drift guard against its commerce twin.
 *
 * `BaseContentMediaSchema` is deliberately a copy of `BaseCommerceMediaSchema`
 * (see that file's doc for why it is not shared yet). A copy with no guard is a
 * copy that diverges silently, so the parity test below is the point of this
 * file — the validation cases are the easy part.
 */

import { describe, expect, it } from 'vitest';
import { BaseCommerceMediaSchema } from '../../src/common/commerce-media.schema';
import { BaseContentMediaSchema } from '../../src/common/content-media.schema';
import { EventMediaSchema } from '../../src/entities/event/subtypes/event.media.schema';
import { PostMediaSchema } from '../../src/entities/post/subtypes/post.media.schema';

const UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const OTHER_UUID = 'a1b2c3d4-e5f6-4890-abcd-ef1234567890';

/** A row that satisfies every required field of the base shape. */
const validRow = {
    url: 'https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/post/photo.jpg',
    moderationState: 'APPROVED',
    state: 'visible',
    isFeatured: false,
    sortOrder: 0,
    createdAt: new Date('2026-08-05T00:00:00.000Z'),
    updatedAt: new Date('2026-08-05T00:00:00.000Z')
};

describe('BaseContentMediaSchema — parity with the commerce twin', () => {
    it('carries exactly the same field set', () => {
        const contentKeys = Object.keys(BaseContentMediaSchema.shape).sort();
        const commerceKeys = Object.keys(BaseCommerceMediaSchema.shape).sort();

        // If this fails, one of the two shapes grew or lost a field. Change
        // both, or collapse them into one base (the follow-up documented in
        // `content-media.schema.ts`) — do not just update this expectation.
        expect(contentKeys).toEqual(commerceKeys);
    });

    it('accepts and rejects the same rows as the commerce twin', () => {
        const cases: Array<{ label: string; row: Record<string, unknown> }> = [
            { label: 'valid row', row: validRow },
            { label: 'bad url', row: { ...validRow, url: 'not-a-url' } },
            { label: 'caption too short', row: { ...validRow, caption: 'ab' } },
            { label: 'caption too long', row: { ...validRow, caption: 'x'.repeat(101) } },
            { label: 'description too short', row: { ...validRow, description: 'short' } },
            { label: 'alt too long', row: { ...validRow, alt: 'x'.repeat(201) } },
            { label: 'unknown state', row: { ...validRow, state: 'hidden' } },
            { label: 'fractional sortOrder', row: { ...validRow, sortOrder: 1.5 } },
            { label: 'missing moderationState', row: { ...validRow, moderationState: undefined } }
        ];

        for (const { label, row } of cases) {
            expect(
                BaseContentMediaSchema.safeParse(row).success,
                `content vs commerce disagreed on: ${label}`
            ).toBe(BaseCommerceMediaSchema.safeParse(row).success);
        }
    });
});

describe('PostMediaSchema', () => {
    it('accepts a full row', () => {
        const result = PostMediaSchema.safeParse({ ...validRow, id: UUID, postId: OTHER_UUID });

        expect(result.success).toBe(true);
    });

    it('requires the parent post id', () => {
        const result = PostMediaSchema.safeParse({ ...validRow, id: UUID });

        expect(result.success).toBe(false);
    });

    it('does not accept an event id in its place', () => {
        // The two schemas are structurally similar; this pins that they are not
        // interchangeable, so a copy-paste between the two editors fails loudly.
        const result = PostMediaSchema.safeParse({ ...validRow, id: UUID, eventId: OTHER_UUID });

        expect(result.success).toBe(false);
    });

    it('coerces ISO timestamps, because the pg driver may return either', () => {
        const result = PostMediaSchema.safeParse({
            ...validRow,
            id: UUID,
            postId: OTHER_UUID,
            createdAt: '2026-08-05T00:00:00.000Z',
            updatedAt: '2026-08-05T00:00:00.000Z'
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.createdAt).toBeInstanceOf(Date);
        }
    });
});

describe('EventMediaSchema', () => {
    it('accepts a full row', () => {
        const result = EventMediaSchema.safeParse({ ...validRow, id: UUID, eventId: OTHER_UUID });

        expect(result.success).toBe(true);
    });

    it('requires the parent event id', () => {
        const result = EventMediaSchema.safeParse({ ...validRow, id: UUID });

        expect(result.success).toBe(false);
    });
});
