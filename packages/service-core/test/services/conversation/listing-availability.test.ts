/**
 * Unit tests for resolveConversationListingAvailability (HOS-1492, V8a rows 28 and 35).
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveConversationListingAvailability } from '../../../src/services/conversation/listing-availability.js';

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GUEST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function listing(publicationStatus: PublicationStatusEnum) {
    return { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', ownerId: OWNER_ID, publicationStatus };
}

describe('resolveConversationListingAvailability', () => {
    describe('GUEST viewer', () => {
        it('TEST:V8a:6 answers GONE on a PURGED listing', () => {
            // Arrange
            const input = {
                viewer: 'GUEST' as const,
                actorId: GUEST_ID,
                listing: listing(PublicationStatusEnum.PURGED)
            };

            // Act
            const availability = resolveConversationListingAvailability(input);

            // Assert
            expect(availability).toBe('GONE');
        });

        it.each([
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.ARCHIVED,
            PublicationStatusEnum.MODERATED,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        ])('answers NOT_PUBLISHED on a %s listing, never saying which', (status) => {
            // Arrange
            const input = { viewer: 'GUEST' as const, actorId: GUEST_ID, listing: listing(status) };

            // Act
            const availability = resolveConversationListingAvailability(input);

            // Assert
            expect(availability).toBe('NOT_PUBLISHED');
        });

        it('answers NOT_PUBLISHED when the listing could not be read', () => {
            // Act
            const availability = resolveConversationListingAvailability({
                viewer: 'GUEST',
                actorId: null,
                listing: null
            });

            // Assert
            expect(availability).toBe('NOT_PUBLISHED');
        });

        it('answers AVAILABLE on a PUBLISHED listing (also for an anonymous guest)', () => {
            // Act
            const signedIn = resolveConversationListingAvailability({
                viewer: 'GUEST',
                actorId: GUEST_ID,
                listing: listing(PublicationStatusEnum.PUBLISHED)
            });
            const anonymous = resolveConversationListingAvailability({
                viewer: 'GUEST',
                actorId: null,
                listing: listing(PublicationStatusEnum.PUBLISHED)
            });

            // Assert
            expect(signedIn).toBe('AVAILABLE');
            expect(anonymous).toBe('AVAILABLE');
        });
    });

    describe('OWNER viewer', () => {
        it('TEST:V8a:6 answers GONE on a PURGED listing', () => {
            // Act
            const availability = resolveConversationListingAvailability({
                viewer: 'OWNER',
                actorId: OWNER_ID,
                listing: listing(PublicationStatusEnum.PURGED)
            });

            // Assert
            expect(availability).toBe('GONE');
        });

        it('answers AVAILABLE on a DRAFT listing (row 35 is the tourist side only)', () => {
            // Act
            const availability = resolveConversationListingAvailability({
                viewer: 'OWNER',
                actorId: OWNER_ID,
                listing: listing(PublicationStatusEnum.DRAFT)
            });

            // Assert
            expect(availability).toBe('AVAILABLE');
        });
    });
});
