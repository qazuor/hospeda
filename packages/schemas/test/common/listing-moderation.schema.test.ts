import { describe, expect, it } from 'vitest';
import { ListingModerationStateSchema } from '../../src/common/listing-moderation.schema';

describe('TEST:1760:1b listing moderation state schema', () => {
    it('accepts no open fix request', () => {
        expect(
            ListingModerationStateSchema.safeParse({
                publicationStatus: 'PUBLISHED',
                fixRequest: null
            }).success
        ).toBe(true);
    });
    it('rejects a fix request without its reason', () => {
        expect(
            ListingModerationStateSchema.safeParse({
                publicationStatus: 'PUBLISHED',
                fixRequest: {
                    suggestedDate: null,
                    openedAt: '2026-10-24T00:00:00.000Z',
                    ownerReportedFixedAt: null
                }
            }).success
        ).toBe(false);
    });
});
