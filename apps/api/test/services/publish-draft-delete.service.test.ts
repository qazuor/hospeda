/**
 * @file publish-draft-delete.service.test.ts
 * @description The vertical dispatch behind `DELETE /protected/commerce/listings/
 * {vertical}/{id}` (HOS-1156 T-015, AC-14).
 *
 * Four lines of switch, and worth pinning: it decides WHICH vertical's listing a
 * delete lands on. A mis-routed delete does not error — the other service simply
 * answers NOT_FOUND for an id it has never seen — so the failure mode is a button
 * that quietly does nothing, on the one branch of the precheck matrix that costs
 * the owner no money.
 *
 * The two services are mocked: what is under test is the routing and the
 * pass-through of the service's own result, not the delete itself (covered by
 * `base-commerce-listing.soft-delete-own-draft.test.ts` in `@repo/service-core`).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { gastronomySoftDeleteOwnDraft, experienceSoftDeleteOwnDraft } = vi.hoisted(() => ({
    gastronomySoftDeleteOwnDraft: vi.fn(),
    experienceSoftDeleteOwnDraft: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    GastronomyService: class {
        softDeleteOwnDraft = gastronomySoftDeleteOwnDraft;
    },
    ExperienceService: class {
        softDeleteOwnDraft = experienceSoftDeleteOwnDraft;
    }
}));

import { deleteOwnCommerceDraft } from '../../src/services/publish-draft-delete.service';

const ACTOR = { id: 'owner-1', roles: [], permissions: [] } as never;
const LISTING_ID = '00000000-0000-4000-a000-000000000001';

beforeEach(() => {
    vi.clearAllMocks();
    gastronomySoftDeleteOwnDraft.mockResolvedValue({ data: { deleted: true } });
    experienceSoftDeleteOwnDraft.mockResolvedValue({ data: { deleted: true } });
});

describe('deleteOwnCommerceDraft — vertical dispatch (HOS-1156 AC-14)', () => {
    it('sends a gastronomy delete to the gastronomy service, and nowhere else', async () => {
        const result = await deleteOwnCommerceDraft({
            actor: ACTOR,
            vertical: 'gastronomy',
            id: LISTING_ID
        });

        expect(result.data).toEqual({ deleted: true });
        expect(gastronomySoftDeleteOwnDraft).toHaveBeenCalledWith(ACTOR, LISTING_ID);
        // The negative half is the load-bearing one: a delete that reached both
        // services, or the wrong one, would still look like a success here.
        expect(experienceSoftDeleteOwnDraft).not.toHaveBeenCalled();
    });

    it('sends an experience delete to the experience service, and nowhere else', async () => {
        const result = await deleteOwnCommerceDraft({
            actor: ACTOR,
            vertical: 'experience',
            id: LISTING_ID
        });

        expect(result.data).toEqual({ deleted: true });
        expect(experienceSoftDeleteOwnDraft).toHaveBeenCalledWith(ACTOR, LISTING_ID);
        expect(gastronomySoftDeleteOwnDraft).not.toHaveBeenCalled();
    });

    it('passes the service’s refusal through unchanged rather than inventing one', async () => {
        gastronomySoftDeleteOwnDraft.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'gastronomy not found' }
        });

        const result = await deleteOwnCommerceDraft({
            actor: ACTOR,
            vertical: 'gastronomy',
            id: LISTING_ID
        });

        expect(result.data).toBeUndefined();
        expect(result.error?.code).toBe('NOT_FOUND');
    });
});
