import { describe, expect, it } from 'vitest';
import {
    ListingModerationActionSchema,
    ListingModerationStateSchema
} from '../../src/common/listing-moderation.schema';

describe('TEST:V6:12 ListingModerationActionSchema', () => {
    it('TEST:V6:12 accepts each moderation action', () => {
        const common = { reason: ' reason ' };
        expect(
            ListingModerationActionSchema.safeParse({
                action: 'REQUEST_FIX',
                ...common,
                suggestedDate: '2026-10-12'
            }).success
        ).toBe(true);
        expect(
            ListingModerationActionSchema.safeParse({ action: 'TAKE_DOWN', ...common }).success
        ).toBe(true);
        expect(
            ListingModerationActionSchema.safeParse({
                action: 'LIFT',
                ...common,
                keepFixRequest: true
            }).success
        ).toBe(true);
        expect(
            ListingModerationActionSchema.safeParse({ action: 'CLOSE_FIX_REQUEST', ...common })
                .success
        ).toBe(true);
    });

    it('TEST:V6:12 rejects empty reasons, unknown actions, and invalid dates', () => {
        expect(
            ListingModerationActionSchema.safeParse({ action: 'TAKE_DOWN', reason: '  ' }).success
        ).toBe(false);
        expect(
            ListingModerationActionSchema.safeParse({ action: 'OTHER', reason: 'x' }).success
        ).toBe(false);
        expect(
            ListingModerationActionSchema.safeParse({
                action: 'REQUEST_FIX',
                reason: 'x',
                suggestedDate: 'not-a-date'
            }).success
        ).toBe(false);
    });
});

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
