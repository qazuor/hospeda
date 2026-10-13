import { describe, expect, it } from 'vitest';
import {
    AccountCloseOnRequestResponseSchema,
    AccountCloseOnRequestSchema,
    AccountClosurePreviewSchema
} from '../../src/common/account-close-on-request.schema.js';

const AccountClosePreviewFixture = {
    userId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Juan Pérez',
    email: 'juan@example.com',
    canCharge: false,
    listingsNotPurged: 0,
    partnerPresenceWithContent: false,
    ready: true
} as const;

const issueMessage = (input: unknown): string | undefined => {
    const result = AccountCloseOnRequestSchema.safeParse(input);
    return result.success ? undefined : result.error.issues[0]?.message;
};

describe('TEST:V8a:13 AccountCloseOnRequestSchema (action 24 reason)', () => {
    it('accepts a reason with text and trims it', () => {
        // Arrange
        const input = { reason: '  Juan asked support to close his account  ' };

        // Act
        const result = AccountCloseOnRequestSchema.safeParse(input);

        // Assert
        expect(result.success).toBe(true);
        expect(result.data?.reason).toBe('Juan asked support to close his account');
    });

    it.each([
        ['missing', {}],
        ['empty', { reason: '' }],
        ['whitespace only', { reason: '   ' }]
    ])('rejects a %s reason with the required key', (_label, input) => {
        expect(issueMessage(input)).toBe('zodError.common.accountCloseOnRequest.reason.required');
        expect(AccountCloseOnRequestSchema.safeParse(input).success).toBe(false);
    });

    it('rejects a reason longer than 2000 characters with the max key', () => {
        expect(issueMessage({ reason: 'x'.repeat(2001) })).toBe(
            'zodError.common.accountCloseOnRequest.reason.max'
        );
        expect(AccountCloseOnRequestSchema.safeParse({ reason: 'x'.repeat(2000) }).success).toBe(
            true
        );
    });

    it('accepts only closed: true as the response', () => {
        expect(AccountCloseOnRequestResponseSchema.safeParse({ closed: true }).success).toBe(true);
        expect(AccountCloseOnRequestResponseSchema.safeParse({ closed: false }).success).toBe(
            false
        );
    });

    it('accepts the preview with a null display name and rejects a negative listing count', () => {
        expect(AccountClosurePreviewSchema.safeParse(AccountClosePreviewFixture).success).toBe(
            true
        );
        expect(
            AccountClosurePreviewSchema.safeParse({
                ...AccountClosePreviewFixture,
                displayName: null
            }).success
        ).toBe(true);
        expect(
            AccountClosurePreviewSchema.safeParse({
                ...AccountClosePreviewFixture,
                listingsNotPurged: -1
            }).success
        ).toBe(false);
    });
});
