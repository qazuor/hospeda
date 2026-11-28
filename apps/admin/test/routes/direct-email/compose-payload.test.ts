/**
 * @file compose-payload.test.ts
 * HOS-2685: the compose form validates with the API's own schema.
 */
import { describe, expect, it } from 'vitest';
import {
    buildSendPayload,
    buildTestSendPayload
} from '@/routes/_authed/direct-emails/-components/compose-payload';

const KEY = '33333333-3333-4333-8333-333333333333';
const BODY = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]
} as const;

describe('buildSendPayload', () => {
    it('builds a typed payload with the template id when present', () => {
        const result = buildSendPayload({
            values: {
                subject: '  Propuesta ',
                bodyJson: BODY,
                recipients: ['a@x.com', 'b@x.com'],
                templateId: '6f1e0b52-6b0a-4c3f-8d8a-1f2a3b4c5d6e',
                idempotencyKey: KEY
            }
        });

        expect(result).toMatchObject({
            success: true,
            payload: {
                subject: 'Propuesta',
                recipients: ['a@x.com', 'b@x.com'],
                templateId: '6f1e0b52-6b0a-4c3f-8d8a-1f2a3b4c5d6e',
                idempotencyKey: KEY
            }
        });
    });

    it('omits templateId when none is selected', () => {
        const result = buildSendPayload({
            values: {
                subject: 'S',
                bodyJson: BODY,
                recipients: ['a@x.com'],
                templateId: null,
                idempotencyKey: KEY
            }
        });

        expect(result.success && 'templateId' in result.payload).toBe(false);
    });

    it('maps each failure to its field with the zodError i18n key', () => {
        const result = buildSendPayload({
            values: {
                subject: '   ',
                bodyJson: null,
                recipients: [],
                templateId: null,
                idempotencyKey: KEY
            }
        });

        expect(result).toEqual({
            success: false,
            errors: {
                subject: 'zodError.entity.directEmail.subject.min',
                bodyJson: 'zodError.entity.directEmail.body.empty',
                recipients: 'zodError.entity.directEmail.recipients.min'
            }
        });
    });

    it('rejects more than 20 recipients', () => {
        const recipients = Array.from({ length: 21 }, (_, index) => `u${index}@x.com`);

        const result = buildSendPayload({
            values: {
                subject: 'S',
                bodyJson: BODY,
                recipients,
                templateId: null,
                idempotencyKey: KEY
            }
        });

        expect(result.success).toBe(false);
        expect(!result.success && result.errors.recipients).toBe(
            'zodError.entity.directEmail.recipients.max'
        );
    });
});

describe('buildTestSendPayload', () => {
    it('omits toEmail when not provided', () => {
        const result = buildTestSendPayload({ subject: 'S', bodyJson: BODY });

        expect(result.success && result.payload).toEqual({ subject: 'S', bodyJson: BODY });
    });

    it('includes a valid override address', () => {
        const result = buildTestSendPayload({ subject: 'S', bodyJson: BODY, toEmail: 'o@x.com' });

        expect(result.success && result.payload.toEmail).toBe('o@x.com');
    });

    it('flags an empty body', () => {
        const result = buildTestSendPayload({ subject: 'S', bodyJson: null });

        expect(!result.success && result.errors.bodyJson).toBe(
            'zodError.entity.directEmail.body.empty'
        );
    });
});
