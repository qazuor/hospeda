/**
 * HOS-2670: `listVenueFaqs` / `listExperienceFaqs` must not answer `[]` when
 * the model returned the listing WITHOUT its `faqs` relation.
 *
 * That `?? []` fallback is what hid the bug: the models' `findWithRelations`
 * ignored `{ faqs: true }` and every listing answered an empty FAQ list. A
 * missing relation is now an INTERNAL_ERROR, and a loaded one passes through.
 * The relation loading itself is covered against a real database by
 * `packages/db/test/integration/listing-faqs-relation.model.integration.test.ts`.
 */
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { listExperienceFaqs } from '../../src/services/experience/experience.faq';
import { listVenueFaqs } from '../../src/services/venue/venue.faq';
import type { Actor } from '../../src/types';

const LISTING_ID = '00000000-0000-4000-a000-000000000001';
const FAQ_ID = '00000000-0000-4000-a000-000000000002';

const actor: Actor = { id: 'tourist-id', roles: [RoleEnum.USER], permissions: [] };

const cases = [
    {
        name: 'listVenueFaqs',
        run: (entity: unknown) =>
            listVenueFaqs(
                { findWithRelations: vi.fn().mockResolvedValue(entity) } as unknown as Parameters<
                    typeof listVenueFaqs
                >[0],
                actor,
                { venueId: LISTING_ID }
            )
    },
    {
        name: 'listExperienceFaqs',
        run: (entity: unknown) =>
            listExperienceFaqs(
                { findWithRelations: vi.fn().mockResolvedValue(entity) } as unknown as Parameters<
                    typeof listExperienceFaqs
                >[0],
                actor,
                { experienceId: LISTING_ID }
            )
    }
] as const;

describe.each(cases)('HOS-2670 $name', ({ run }) => {
    it('returns INTERNAL_ERROR when the listing came back without its faqs relation', async () => {
        // Arrange + Act
        const result = await run({ id: LISTING_ID });

        // Assert
        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });

    it('returns the loaded faqs relation as-is', async () => {
        // Arrange + Act
        const result = await run({ id: LISTING_ID, faqs: [{ id: FAQ_ID }] });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.faqs.map((f) => f.id)).toEqual([FAQ_ID]);
    });
});
