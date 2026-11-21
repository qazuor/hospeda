/**
 * Test fixture: one `accommodation_media` row (HOS-2331). It lives in a media
 * file because the photo keeps its own moderation state, which the listing
 * old-columns guard (TEST:V6:18) allows only in sub-entity files.
 *
 * @module test/services/accommodation/accommodation-media-row.fixture
 */

import type { AccommodationMedia } from '@repo/schemas';

/** Input to {@link accommodationMediaRow}. */
export interface AccommodationMediaRowInput {
    /** The accommodation the photo belongs to. */
    readonly accommodationId: string;
    /** The photo's own moderation state. Defaults to `APPROVED`. */
    readonly moderation?: 'APPROVED' | 'PENDING' | 'REJECTED';
    /** Other fields to override. */
    readonly overrides?: Partial<AccommodationMedia>;
}

/**
 * Builds a featured, visible media row, approved unless told otherwise.
 *
 * @param input - {@link AccommodationMediaRowInput}
 * @returns The media row
 */
export function accommodationMediaRow(input: AccommodationMediaRowInput): AccommodationMedia {
    const { accommodationId, moderation = 'APPROVED', overrides = {} } = input;
    return {
        id: '00000000-0000-4000-8000-000000000001',
        accommodationId,
        url: 'https://cdn.example.com/featured.jpg',
        moderationState: moderation,
        state: 'visible',
        isFeatured: true,
        sortOrder: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides
    } as unknown as AccommodationMedia;
}
