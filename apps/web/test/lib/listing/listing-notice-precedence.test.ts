import type { ListingNotice } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createTranslations } from '@/lib/i18n';
import { buildListingNoticeViews } from '@/lib/listing/listing-notices';

const lifted: ListingNotice = {
    kind: 'MODERATION_LIFTED',
    returnedTo: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    at: '2026-11-25T12:00:00Z',
    unpublishedBecause: 'QUOTA_FULL',
    fixRequestOpen: false
};
const surplus: ListingNotice = { kind: 'SURPLUS' };
const fix: ListingNotice = {
    kind: 'FIX_REQUESTED',
    reason: 'Hours',
    suggestedDate: null,
    openedAt: '2026-11-25T12:00:00Z',
    ownerReportedFixedAt: null
};

function views(notices: readonly ListingNotice[]) {
    return buildListingNoticeViews({
        locale: 'en',
        ...createTranslations('en'),
        item: {
            listingId: 'listing',
            publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
            recurringListingAddons: 0,
            recurringListingAddonItems: [],
            notices: [...notices]
        }
    });
}

describe('CARD-145 H-3 notice precedence', () => {
    it.each([
        [lifted, surplus],
        [surplus, lifted]
    ])('shows the current plan blocker instead of historical approval regardless of API ordering', (...notices) => {
        expect(views(notices).map((view) => view.kind)).toEqual(['SURPLUS']);
    });
    it('retains a standalone moderation lift and unrelated actionable notices', () => {
        expect(views([lifted]).map((view) => view.kind)).toEqual(['MODERATION_LIFTED']);
        const result = views([surplus, lifted, fix]);
        expect(result.map((view) => view.kind)).toEqual(['SURPLUS', 'FIX_REQUESTED']);
        expect(result[1]?.reportFixed).toEqual({ reportedAt: null });
    });
    it.each([
        'PURGED',
        'PURGED_BY_INACTIVITY',
        'PURGED_FROM_MODERATION'
    ] as const)('maps deleted notice %s to the kit danger tone', (kind) => {
        expect(views([{ kind }])[0]?.tone).toBe('danger');
    });
});
