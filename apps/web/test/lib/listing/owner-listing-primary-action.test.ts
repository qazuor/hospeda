/**
 * @file owner-listing-primary-action.test.ts
 * @description HOS-2484 AC-7: one primary action per venue/experience card,
 * decided by the same rules as the `ListingActions` publish button.
 */
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { resolveOwnerListingPrimaryAction } from '../../../src/lib/listing/owner-listing-primary-action';
import type { OwnerListingSummaryWithState } from '../../../src/lib/listing/owner-listings';
import {
    type PublishAffordance,
    UNKNOWN_PUBLISH_AFFORDANCE
} from '../../../src/lib/publish/subscribe-button';

const listing = (overrides: Partial<OwnerListingSummaryWithState>): OwnerListingSummaryWithState =>
    ({
        id: 'l1',
        vertical: 'venue',
        name: 'La Parrilla',
        slug: 'la-parrilla',
        type: 'PARRILLA',
        isPublic: false,
        hasPublicPage: false,
        publicationStatus: PublicationStatusEnum.DRAFT,
        completeness: null,
        ...overrides
    }) as OwnerListingSummaryWithState;

const PUBLISHABLE = {
    kind: 'publish',
    canPublish: true,
    startsTrial: false,
    trialDays: null
} as PublishAffordance;

describe('resolveOwnerListingPrimaryAction', () => {
    it.each([
        ['purged → none', listing({ publicationStatus: PublicationStatusEnum.PURGED }), 'none'],
        [
            'published → edit',
            listing({ publicationStatus: PublicationStatusEnum.PUBLISHED, isPublic: true }),
            'edit'
        ],
        [
            'complete draft → publish',
            listing({ completeness: { complete: true, missing: [] } }),
            'publish'
        ],
        [
            'incomplete draft → edit',
            listing({ completeness: { complete: false, missing: ['name'] } }),
            'edit'
        ],
        ['unknown completeness → edit', listing({ completeness: null }), 'edit'],
        [
            'taken down by billing → publish (republish)',
            listing({ publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING }),
            'publish'
        ],
        ['archived → edit', listing({ publicationStatus: PublicationStatusEnum.ARCHIVED }), 'edit']
    ] as const)('%s', (_name, input, expected) => {
        expect(resolveOwnerListingPrimaryAction({ listing: input, affordance: PUBLISHABLE })).toBe(
            expected
        );
    });

    it('republish is offered even with an unknown affordance (the server reports what is missing)', () => {
        expect(
            resolveOwnerListingPrimaryAction({
                listing: listing({
                    publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
                }),
                affordance: UNKNOWN_PUBLISH_AFFORDANCE
            })
        ).toBe('publish');
    });
});
