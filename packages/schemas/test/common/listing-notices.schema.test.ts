import { describe, expect, it } from 'vitest';
import {
    type ListingNotice,
    ListingNoticeSchema,
    ListingNoticesResponseSchema,
    ReportFixedResponseSchema,
    TrialSummaryResponseSchema
} from '../../src/common/listing-notices.schema';
import { PublicationStatusEnum } from '../../src/enums/publication-status.enum';

const AT = '2026-10-12T15:00:00.000Z';
const LISTING_ID = '0b9f1c2e-6a39-4c55-9a7b-3f1f0f1c2d3e';

/** One valid notice per kind (H2). */
const VALID: Readonly<Record<ListingNotice['kind'], ListingNotice>> = {
    PURGED_BY_INACTIVITY: { kind: 'PURGED_BY_INACTIVITY' },
    PURGED_FROM_MODERATION: { kind: 'PURGED_FROM_MODERATION' },
    PURGED: { kind: 'PURGED' },
    ARCHIVED: { kind: 'ARCHIVED', deletionAnnouncedAt: AT, returnsOnItsOwn: true },
    MODERATED: { kind: 'MODERATED', reason: 'Fotos ajenas', since: AT },
    FIX_REQUESTED: {
        kind: 'FIX_REQUESTED',
        reason: 'Actualizá el horario',
        suggestedDate: '2026-10-20',
        openedAt: AT,
        ownerReportedFixedAt: null
    },
    MODERATION_LIFTED: {
        kind: 'MODERATION_LIFTED',
        returnedTo: PublicationStatusEnum.DRAFT,
        at: AT,
        fixRequestOpen: false
    },
    SURPLUS: { kind: 'SURPLUS' }
};

describe('TEST:V8a:7 listing notices contract (HOS-1492, H2)', () => {
    it.each(Object.entries(VALID))('accepts a valid %s notice', (_kind, notice) => {
        // Arrange + Act
        const result = ListingNoticeSchema.safeParse(notice);

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a kind outside the closed list', () => {
        // Arrange
        const notice = { kind: 'DELETED_BY_ADMIN' };

        // Act
        const result = ListingNoticeSchema.safeParse(notice);

        // Assert
        expect(result.success).toBe(false);
    });

    it('rejects an ARCHIVED notice without returnsOnItsOwn', () => {
        // Arrange
        const notice = { kind: 'ARCHIVED', deletionAnnouncedAt: AT };

        // Act
        const result = ListingNoticeSchema.safeParse(notice);

        // Assert
        expect(result.success).toBe(false);
    });

    it('accepts the response with trialRunning and one item per listing', () => {
        // Arrange
        const body = {
            trialRunning: true,
            items: [
                {
                    listingId: LISTING_ID,
                    publicationStatus: 'PURGED',
                    recurringListingAddons: 0,
                    notices: [{ kind: 'PURGED_BY_INACTIVITY' }]
                }
            ]
        };

        // Act
        const result = ListingNoticesResponseSchema.safeParse(body);

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a negative recurringListingAddons', () => {
        // Arrange
        const body = {
            trialRunning: false,
            items: [
                {
                    listingId: LISTING_ID,
                    publicationStatus: 'DRAFT',
                    recurringListingAddons: -1,
                    notices: []
                }
            ]
        };

        // Act
        const result = ListingNoticesResponseSchema.safeParse(body);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('TEST:V8a:7 trial summary contract (row 4, H3)', () => {
    it('accepts NONE', () => {
        // Arrange + Act
        const result = TrialSummaryResponseSchema.safeParse({ status: 'NONE' });

        // Assert
        expect(result.success).toBe(true);
    });

    it('accepts a running trial with its origins', () => {
        // Arrange
        const body = {
            status: 'TRIAL_ACTIVE',
            startedAt: AT,
            endsAt: '2026-11-26T15:00:00.000Z',
            totalDays: 45,
            origins: { base: 30, promo: 10, support: 5 }
        };

        // Act
        const result = TrialSummaryResponseSchema.safeParse(body);

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a status outside the trial machine', () => {
        // Arrange
        const body = {
            status: 'PRE_TRIAL',
            startedAt: null,
            endsAt: null,
            totalDays: 0,
            origins: { base: 0, promo: 0, support: 0 }
        };

        // Act
        const result = TrialSummaryResponseSchema.safeParse(body);

        // Assert
        expect(result.success).toBe(false);
    });
});

describe('TEST:V8a:7 report-fixed contract (row 30, H4)', () => {
    it('accepts the reported instant', () => {
        // Arrange + Act
        const result = ReportFixedResponseSchema.safeParse({ ownerReportedFixedAt: AT });

        // Assert
        expect(result.success).toBe(true);
    });

    it('rejects a missing instant', () => {
        // Arrange + Act
        const result = ReportFixedResponseSchema.safeParse({ ownerReportedFixedAt: null });

        // Assert
        expect(result.success).toBe(false);
    });
});
