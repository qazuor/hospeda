import { describe, expect, it } from 'vitest';
import {
    ListingPurgeOnRequestResponseSchema,
    ListingPurgeOnRequestSchema
} from '../../src/common/listing-purge-on-request.schema.js';

const issueMessage = (input: unknown): string | undefined => {
    const result = ListingPurgeOnRequestSchema.safeParse(input);
    return result.success ? undefined : result.error.issues[0]?.message;
};

describe('TEST:V8a:10 ListingPurgeOnRequestSchema (action 23 reason)', () => {
    it('accepts a reason with text and trims it', () => {
        // Arrange
        const input = { reason: '  Juan asked support to delete his listing  ' };

        // Act
        const result = ListingPurgeOnRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.reason).toBe('Juan asked support to delete his listing');
    });

    it.each([
        ['missing', {}],
        ['empty', { reason: '' }],
        ['whitespace only', { reason: '   ' }]
    ])('rejects a %s reason with the required key', (_label, input) => {
        expect(issueMessage(input)).toBe('zodError.common.listingPurgeOnRequest.reason.required');
        expect(ListingPurgeOnRequestSchema.safeParse(input).success).toBe(false);
    });

    it('rejects a reason longer than 2000 characters with the max key', () => {
        expect(issueMessage({ reason: 'x'.repeat(2001) })).toBe(
            'zodError.common.listingPurgeOnRequest.reason.max'
        );
        expect(ListingPurgeOnRequestSchema.safeParse({ reason: 'x'.repeat(2000) }).success).toBe(
            true
        );
    });

    it('accepts only purged: true as the response', () => {
        expect(ListingPurgeOnRequestResponseSchema.safeParse({ purged: true }).success).toBe(true);
        expect(ListingPurgeOnRequestResponseSchema.safeParse({ purged: false }).success).toBe(
            false
        );
    });
});
