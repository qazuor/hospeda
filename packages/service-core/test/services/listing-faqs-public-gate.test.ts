/**
 * HOS-2670 follow-up: the PUBLIC FAQ read must not serve the FAQs of a parent
 * listing that the public detail read would not show.
 *
 * Before HOS-2670 the FAQ relation never loaded, so this gap was invisible:
 * every listing answered `[]`. Once FAQs loaded, `listVenueFaqs` /
 * `listExperienceFaqs` served the FAQs of drafts and soft-deleted listings,
 * because `checkVenueCanView` is a no-op. `listPublicVenueFaqs` /
 * `listPublicExperienceFaqs` gate the parent with `check{Venue,Experience}CanViewEntity`,
 * the predicate the public detail read (`_canView`) uses.
 */
import { PublicationStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { listExperienceFaqs } from '../../src/services/experience/experience.faq';
import { listPublicExperienceFaqs } from '../../src/services/experience/experience.faq-public';
import { listVenueFaqs } from '../../src/services/venue/venue.faq';
import { listPublicVenueFaqs } from '../../src/services/venue/venue.faq-public';
import type { Actor } from '../../src/types';

const LISTING_ID = '00000000-0000-4000-a000-000000000001';
const FAQ_ID = '00000000-0000-4000-a000-000000000002';
const OWNER_ID = '00000000-0000-4000-a000-000000000003';
const STRANGER_ID = '00000000-0000-4000-a000-000000000004';

const stranger: Actor = { id: STRANGER_ID, roles: [RoleEnum.USER], permissions: [] };

function makeListing(overrides: Record<string, unknown> = {}) {
    return {
        id: LISTING_ID,
        ownerId: OWNER_ID,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        deletedAt: null,
        ...overrides
    };
}

function makeModel(listing: Record<string, unknown> | null) {
    return {
        findById: vi.fn().mockResolvedValue(listing),
        findWithRelations: vi
            .fn()
            .mockResolvedValue(listing ? { ...listing, faqs: [{ id: FAQ_ID }] } : null)
    };
}

type AnyList = (
    model: never,
    actor: Actor,
    data: never
) => Promise<{ data?: { faqs: { id: string }[] }; error?: { code: string } }>;

const cases = [
    {
        name: 'venue',
        gated: listPublicVenueFaqs as unknown as AnyList,
        shared: listVenueFaqs as unknown as AnyList,
        input: { venueId: LISTING_ID }
    },
    {
        name: 'experience',
        gated: listPublicExperienceFaqs as unknown as AnyList,
        shared: listExperienceFaqs as unknown as AnyList,
        input: { experienceId: LISTING_ID }
    }
] as const;

describe.each(cases)('HOS-2670 public $name FAQ read gates the parent listing', ({
    gated,
    shared,
    input
}) => {
    const run = (fn: AnyList, listing: Record<string, unknown> | null, actor = stranger) =>
        fn(makeModel(listing) as never, actor, input as never);

    it('returns the FAQs of a PUBLISHED listing', async () => {
        const result = await run(gated, makeListing());

        expect(result.error).toBeUndefined();
        expect(result.data?.faqs.map((f) => f.id)).toEqual([FAQ_ID]);
    });

    it('answers NOT_FOUND for a DRAFT listing', async () => {
        const draft = makeListing({ publicationStatus: PublicationStatusEnum.DRAFT });

        const result = await run(gated, draft);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('answers NOT_FOUND for a listing unpublished by billing', async () => {
        const unpublished = makeListing({
            publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });

        const result = await run(gated, unpublished);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('answers NOT_FOUND for a soft-deleted listing that was never published', async () => {
        const deleted = makeListing({
            publicationStatus: PublicationStatusEnum.DRAFT,
            deletedAt: new Date('2026-11-01')
        });

        const result = await run(gated, deleted);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('answers GONE for a soft-deleted listing that was published, like the detail read', async () => {
        const deleted = makeListing({ deletedAt: new Date('2026-11-01') });

        const result = await run(gated, deleted);

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.GONE);
    });

    it('answers NOT_FOUND when the listing does not exist', async () => {
        const result = await run(gated, null);

        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('lets the owner read the FAQs of their own DRAFT, like the detail read', async () => {
        const owner: Actor = { id: OWNER_ID, roles: [RoleEnum.USER], permissions: [] };
        const draft = makeListing({ publicationStatus: PublicationStatusEnum.DRAFT });

        const result = await run(gated, draft, owner);

        expect(result.data?.faqs.map((f) => f.id)).toEqual([FAQ_ID]);
    });

    it('keeps the shared (admin) helper ungated: it still returns a DRAFT listing FAQs', async () => {
        const draft = makeListing({ publicationStatus: PublicationStatusEnum.DRAFT });

        const result = await run(shared, draft);

        expect(result.data?.faqs.map((f) => f.id)).toEqual([FAQ_ID]);
    });
});
