/**
 * Shared fixtures of the `set_listing_publication` tests (HOS-2184 T-018):
 * ids, the actor builder, and the listing-access port answers (facts,
 * coverage, effective set). Each test file keeps its own `vi.mock` calls,
 * which vitest hoists per file; this module only fills the mocks they hand in.
 *
 * @module test/mcp/tools/listing/set-listing-publication.harness
 */

import { type PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import type { Mock } from 'vitest';

/** The listing-access port mocks a test file declares. */
export interface ListingAccessPortMocks {
    readonly loadFacts: Mock;
    readonly coverage: Mock;
    readonly effectiveSet: Mock;
    readonly preTrialDraftLimits: Mock;
}

const VERTICALS = [
    VerticalEnum.ACCOMMODATION,
    VerticalEnum.VENUE,
    VerticalEnum.EXPERIENCE
] as const;

type Vertical = (typeof VERTICALS)[number];

/**
 * Per vertical, the capabilities the publication routes ask for at step 6. `UNPUBLISH`
 * asks for none (HOS-2244); `REACTIVATE`'s `recover_own_listing` is added below.
 */
const CAPABILITIES: Readonly<Record<Vertical, readonly string[]>> = {
    [VerticalEnum.ACCOMMODATION]: ['publish_accommodations'],
    [VerticalEnum.VENUE]: ['publish_venue'],
    [VerticalEnum.EXPERIENCE]: ['publish_experience']
};

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';

export const harness = {
    OWNER_ID,
    OTHER_ID: '2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d',
    LISTING_ID: '9a1f5c2e-6b7d-4e8f-a0b1-c2d3e4f5a6b7',
    VERTICALS,

    /** An actor; verified email and no permissions unless told otherwise. */
    actorFor(
        id: string,
        options: { readonly permissions?: readonly string[]; readonly emailVerified?: boolean } = {}
    ): Actor {
        return {
            id,
            roles: ['HOST'],
            permissions: options.permissions ?? [],
            emailVerified: options.emailVerified ?? true
        } as unknown as Actor;
    },

    /** Listing-access facts: the listing exists in `status`, owned by `ownerId`. */
    givenFacts(
        mocks: ListingAccessPortMocks,
        args: {
            readonly vertical: Vertical;
            readonly status: PublicationStatusEnum;
            readonly ownerId?: string;
        }
    ): void {
        const ownerId = args.ownerId ?? OWNER_ID;
        mocks.loadFacts.mockResolvedValue({
            facts: {
                ownerId,
                publicationStatus: args.status,
                businessLines: args.vertical === VerticalEnum.VENUE ? ['food'] : ['standard']
            },
            ownerId
        });
    },

    /**
     * Billing as listing access reads it: coverage (step 5) and the effective
     * set (step 6). `granted` grants every capability the three routes need,
     * plus `recover_own_listing`.
     */
    givenBilling(
        mocks: ListingAccessPortMocks,
        args: {
            readonly covered: boolean;
            readonly granted: boolean;
            readonly hasLiveNonTrialTitle?: boolean;
        }
    ): void {
        mocks.coverage.mockResolvedValue(
            args.covered
                ? { covered: true, sources: [{ type: 'BASE' }] }
                : { covered: false, sources: [] }
        );
        mocks.preTrialDraftLimits.mockResolvedValue(new Map());
        mocks.effectiveSet.mockImplementation(
            async ({ userId, vertical }: { userId: string; vertical: Vertical }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: args.hasLiveNonTrialTitle ?? true,
                    inheritsTouristVip: false,
                    entries: args.granted
                        ? [...CAPABILITIES[vertical], 'recover_own_listing'].map((key) => ({
                              key,
                              value: 1,
                              strategy: 'MAX' as const
                          }))
                        : []
                })
        );
    }
} as const;
