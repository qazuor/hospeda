import { describe, expect, it } from 'vitest';
import {
    CheckDirectEmailRecipientsRequestSchema,
    CreateDirectEmailSuppressionSchema,
    CreateDirectEmailTemplateSchema,
    DIRECT_EMAIL_MAX_RECIPIENTS,
    DirectEmailOptOutBodySchema,
    DirectEmailRecipientsSchema,
    hasTiptapContent,
    PermissionCategoryEnum,
    PermissionEnum,
    SendDirectEmailRequestSchema,
    TestSendDirectEmailRequestSchema,
    UpdateDirectEmailTemplateSchema
} from '../../../src/index.js';
import { PERMISSION_TO_CATEGORY } from '../../../src/utils/permission-grouping.js';

const BODY = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]
};
const EMPTY_BODY = { type: 'doc', content: [{ type: 'paragraph' }] };

describe('hasTiptapContent', () => {
    it('is true for a document with text', () => {
        expect(hasTiptapContent(BODY)).toBe(true);
    });

    it('is false for empty paragraphs and blank text', () => {
        expect(hasTiptapContent(EMPTY_BODY)).toBe(false);
        expect(
            hasTiptapContent({
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '   ' }] }]
            })
        ).toBe(false);
    });

    it('is true for an image-only document', () => {
        expect(hasTiptapContent({ type: 'doc', content: [{ type: 'image' }] })).toBe(true);
    });
});

describe('DirectEmailRecipientsSchema', () => {
    it('lowercases and trims addresses', () => {
        // Arrange / Act
        const result = DirectEmailRecipientsSchema.parse(['  Ana@Example.COM ']);

        // Assert
        expect(result).toEqual(['ana@example.com']);
    });

    it('rejects an empty list', () => {
        expect(DirectEmailRecipientsSchema.safeParse([]).success).toBe(false);
    });

    it('rejects more than the maximum', () => {
        const many = Array.from(
            { length: DIRECT_EMAIL_MAX_RECIPIENTS + 1 },
            (_, i) => `u${i}@example.com`
        );
        expect(DirectEmailRecipientsSchema.safeParse(many).success).toBe(false);
    });

    it('accepts exactly the maximum', () => {
        const max = Array.from(
            { length: DIRECT_EMAIL_MAX_RECIPIENTS },
            (_, i) => `u${i}@example.com`
        );
        expect(DirectEmailRecipientsSchema.safeParse(max).success).toBe(true);
    });

    it('rejects an invalid address', () => {
        expect(DirectEmailRecipientsSchema.safeParse(['not-an-email']).success).toBe(false);
    });

    it('rejects case-insensitive duplicates', () => {
        // Arrange / Act
        const result = DirectEmailRecipientsSchema.safeParse(['a@example.com', 'A@Example.com']);

        // Assert
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe(
            'zodError.entity.directEmail.recipients.duplicate'
        );
    });
});

describe('SendDirectEmailRequestSchema', () => {
    const valid = { subject: 'Propuesta', bodyJson: BODY, recipients: ['a@example.com'] };

    it('accepts a valid request', () => {
        expect(SendDirectEmailRequestSchema.safeParse(valid).success).toBe(true);
    });

    it('rejects an empty subject', () => {
        expect(SendDirectEmailRequestSchema.safeParse({ ...valid, subject: '   ' }).success).toBe(
            false
        );
    });

    it('rejects an empty body', () => {
        expect(
            SendDirectEmailRequestSchema.safeParse({ ...valid, bodyJson: EMPTY_BODY }).success
        ).toBe(false);
    });

    it('rejects unknown fields', () => {
        expect(SendDirectEmailRequestSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    });
});

describe('TestSendDirectEmailRequestSchema', () => {
    it('makes toEmail optional', () => {
        expect(
            TestSendDirectEmailRequestSchema.safeParse({ subject: 'x', bodyJson: BODY }).success
        ).toBe(true);
    });
});

describe('template and suppression schemas', () => {
    it('requires a name on create', () => {
        expect(
            CreateDirectEmailTemplateSchema.safeParse({ name: '', subject: 's', bodyJson: BODY })
                .success
        ).toBe(false);
    });

    it('rejects an empty patch', () => {
        expect(UpdateDirectEmailTemplateSchema.safeParse({}).success).toBe(false);
        expect(UpdateDirectEmailTemplateSchema.safeParse({ name: 'n' }).success).toBe(true);
    });

    it('lowercases a manual suppression address', () => {
        expect(CreateDirectEmailSuppressionSchema.parse({ email: 'X@Y.com' }).email).toBe(
            'x@y.com'
        );
    });

    it('requires a token to opt out', () => {
        expect(DirectEmailOptOutBodySchema.safeParse({ token: '' }).success).toBe(false);
    });

    it('bounds the recipient check list', () => {
        expect(CheckDirectEmailRecipientsRequestSchema.safeParse({ emails: [] }).success).toBe(
            false
        );
    });
});

describe('direct email permissions', () => {
    it('declares the three values', () => {
        expect(PermissionEnum.DIRECT_EMAIL_VIEW).toBe('directEmail.view');
        expect(PermissionEnum.DIRECT_EMAIL_SEND).toBe('directEmail.send');
        expect(PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE).toBe('directEmail.template.write');
    });

    it('groups them under the DIRECT_EMAIL category', () => {
        for (const permission of [
            PermissionEnum.DIRECT_EMAIL_VIEW,
            PermissionEnum.DIRECT_EMAIL_SEND,
            PermissionEnum.DIRECT_EMAIL_TEMPLATE_WRITE
        ]) {
            expect(PERMISSION_TO_CATEGORY[permission]).toBe(PermissionCategoryEnum.DIRECT_EMAIL);
        }
    });
});
