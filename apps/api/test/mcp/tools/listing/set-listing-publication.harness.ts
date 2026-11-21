/**
 * Shared fixtures of the `set_listing_publication` tests (HOS-2184 T-018):
 * ids, the actor builder, and the listing-access port answers (facts,
 * coverage, effective set). Each test file keeps its own `vi.mock` calls,
 * which vitest hoists per file; this module only fills the mocks they hand in.
 *
 * Since publishing is two steps (HOS-2247, D-19) it also holds the in-memory
 * Redis fake the confirmation store runs over, and {@link throughPreview},
 * which confirms a publish preview with its token the way a model would after
 * the user said yes.
 *
 * @module test/mcp/tools/listing/set-listing-publication.harness
 */

import { type PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { type Mock, vi } from 'vitest';
import type { ToolRunOutcome } from '../../../../src/mcp/tools/run-tool';

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

/** Per vertical, the capabilities the three publication routes ask for at step 6. */
const CAPABILITIES: Readonly<Record<Vertical, readonly string[]>> = {
    [VerticalEnum.ACCOMMODATION]: ['edit_accommodation_info', 'publish_accommodations'],
    [VerticalEnum.VENUE]: ['edit_venue_info', 'publish_venue'],
    [VerticalEnum.EXPERIENCE]: ['edit_experience_info', 'publish_experience']
};

const OWNER_ID = '1f2e3d4c-5b6a-4789-8abc-def012345678';
const CLIENT = 'https://claude.ai/oauth/mcp-client-metadata';

/** In-memory Redis fake with TTL driven by an injected clock. */
function makeFakeRedis() {
    let nowMs = 0;
    const data = new Map<string, { value: string; expiresAt: number }>();
    return {
        redis: {
            set: vi.fn(async (key: string, value: string, _ex: string, seconds: number) => {
                data.set(key, { value, expiresAt: nowMs + seconds * 1000 });
                return 'OK';
            }),
            getdel: vi.fn(async (key: string) => {
                const entry = data.get(key);
                data.delete(key);
                return entry && entry.expiresAt > nowMs ? entry.value : null;
            })
        },
        data,
        advance: (ms: number) => {
            nowMs += ms;
        }
    };
}

/** Narrows a success payload to a publish preview (token flow). */
function previewTokenOf(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null || !('status' in data)) {
        return undefined;
    }
    return data.status === 'confirmation_required' &&
        'confirmationToken' in data &&
        typeof data.confirmationToken === 'string'
        ? data.confirmationToken
        : undefined;
}

/**
 * Runs a call; when it answers a publish preview, confirms it with its token
 * (the second call a model makes once the user said yes). Any other outcome is
 * returned as is, so one-step calls and refusals read exactly as before.
 */
async function throughPreview<TData>(
    run: (input: Record<string, unknown>) => Promise<ToolRunOutcome<TData>>,
    input: Record<string, unknown>
): Promise<ToolRunOutcome<TData>> {
    const first = await run(input);
    if (!first.ok) {
        return first;
    }
    const token = previewTokenOf(first.data);
    return token === undefined ? first : run({ ...input, confirmationToken: token });
}

export const harness = {
    OWNER_ID,
    CLIENT,
    makeFakeRedis,
    previewTokenOf,
    throughPreview,
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
