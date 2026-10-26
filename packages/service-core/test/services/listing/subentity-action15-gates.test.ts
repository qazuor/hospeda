/**
 * ACC:15 (HOS-1493) on the gastronomy and experience sub-entity gates: photos
 * and FAQ entries are listing content, so action 15 passes their gates — only
 * inside the scope a route's listing-access chain opened for the listing's
 * owner. The sibling gate shared by menu, events and certificates does not
 * change, and a photo written by action 15 never carries a moderation verdict.
 */
import { PermissionEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    checkExperienceCanEditFaqEntries,
    checkExperienceCanEditFaqs,
    checkExperienceCanEditMedia
} from '../../../src/services/experience/experience.permissions';
import { assertSupportEditContentOnly } from '../../../src/services/listing/listing-support-edit';
import {
    checkVenueCanEditFaqEntries,
    checkVenueCanEditFaqs,
    checkVenueCanEditMedia
} from '../../../src/services/venue/venue.permissions';
import type { Actor } from '../../../src/types';
import { runWithAdministrativeAuthorization } from '../../../src/utils/administrative-authorization';

const OWNER_ID = 'owner-1';
const listing = { ownerId: OWNER_ID };

/** No role at all: the decision reads permissions and the scope only. */
const admin15: Actor = {
    id: 'admin-1',
    roles: [],
    permissions: [PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT]
};

const inScope = <T>(subjectId: string, run: () => T): Promise<T> =>
    runWithAdministrativeAuthorization({
        authorization: { action: 'ACC_15', subjectId },
        run: async () => run()
    });

const CONTENT_GATES = {
    checkVenueCanEditMedia,
    checkVenueCanEditFaqEntries,
    checkExperienceCanEditMedia,
    checkExperienceCanEditFaqEntries
} as const;

const forbidden = expect.objectContaining({ code: ServiceErrorCode.FORBIDDEN });

describe('ACC:15 sub-entity content gates', () => {
    for (const [name, gate] of Object.entries(CONTENT_GATES)) {
        it(`${name} lets action 15 pass inside the scope of the listing owner`, async () => {
            // Act
            const run = inScope(OWNER_ID, () => gate(admin15, listing));

            // Assert
            await expect(run).resolves.toBeUndefined();
        });

        it(`${name} refuses action 15 outside any scope`, () => {
            expect(() => gate(admin15, listing)).toThrow(forbidden);
        });

        it(`${name} refuses a scope bound to another owner`, async () => {
            await expect(inScope('owner-2', () => gate(admin15, listing))).rejects.toThrow(
                forbidden
            );
        });
    }

    it('keeps the gate shared by menu, events and certificates closed to action 15', async () => {
        // Act
        const venue = inScope(OWNER_ID, () => checkVenueCanEditFaqs(admin15, listing));
        const experience = inScope(OWNER_ID, () => checkExperienceCanEditFaqs(admin15, listing));

        // Assert
        await expect(venue).rejects.toThrow(forbidden);
        await expect(experience).rejects.toThrow(forbidden);
    });
});

describe('ACC:15 photo payload carries no moderation verdict', () => {
    it('refuses an approved photo inside the action-15 scope', async () => {
        // Arrange
        const media = { url: 'https://example.test/a.jpg', moderationState: 'APPROVED' };

        // Act
        const run = inScope(OWNER_ID, () => assertSupportEditContentOnly({ data: { media } }));

        // Assert
        await expect(run).rejects.toThrow(forbidden);
    });

    it('accepts a pending or unmoderated photo inside the scope, and anything outside it', async () => {
        // Arrange
        const pending = { url: 'https://example.test/a.jpg', moderationState: 'PENDING' };
        const approved = { url: 'https://example.test/a.jpg', moderationState: 'APPROVED' };

        // Act
        const results = await inScope(OWNER_ID, () => [
            assertSupportEditContentOnly({ data: { media: pending } }),
            assertSupportEditContentOnly({ data: { media: { url: pending.url } } })
        ]);
        const outside = assertSupportEditContentOnly({ data: { media: approved } });

        // Assert
        expect(results).toEqual([{ rejectedFields: [] }, { rejectedFields: [] }]);
        expect(outside).toEqual({ rejectedFields: [] });
    });
});
