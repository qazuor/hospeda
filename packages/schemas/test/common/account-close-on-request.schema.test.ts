import { describe, expect, it } from 'vitest';
import {
    AccountCloseOnRequestResponseSchema,
    AccountCloseOnRequestSchema,
    AccountClosurePreviewSchema,
    PartnerApplicationEmailReplacementPreviewSchema,
    PartnerApplicationEmailReplacementResponseSchema
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

describe('TEST:V8a:14 action 24 over a partner application made without an account', () => {
    const preview = {
        applicationId: '33333333-3333-4333-8333-333333333333',
        email: 'ana@example.com',
        status: 'PENDING',
        createdAt: '2026-10-12T12:00:00.000Z'
    } as const;

    it('accepts the preview for each application status', () => {
        // Arrange
        const statuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;

        // Act
        const results = statuses.map(
            (status) =>
                PartnerApplicationEmailReplacementPreviewSchema.safeParse({ ...preview, status })
                    .success
        );

        // Assert
        expect(results).toEqual([true, true, true]);
    });

    it('rejects an unknown status, a non-uuid id and a non-ISO creation date', () => {
        expect(
            PartnerApplicationEmailReplacementPreviewSchema.safeParse({
                ...preview,
                status: 'CANCELLED'
            }).success
        ).toBe(false);
        expect(
            PartnerApplicationEmailReplacementPreviewSchema.safeParse({
                ...preview,
                applicationId: 'app-1'
            }).success
        ).toBe(false);
        expect(
            PartnerApplicationEmailReplacementPreviewSchema.safeParse({
                ...preview,
                createdAt: '12/10/2026'
            }).success
        ).toBe(false);
    });

    it('accepts only replaced: true as the response', () => {
        expect(
            PartnerApplicationEmailReplacementResponseSchema.safeParse({ replaced: true }).success
        ).toBe(true);
        expect(
            PartnerApplicationEmailReplacementResponseSchema.safeParse({ replaced: false }).success
        ).toBe(false);
    });
});
