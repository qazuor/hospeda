import { describe, expect, it } from 'vitest';
import { SignupNoticeResponseSchema } from '../../../src/api/billing/signup-notice.schema.js';

describe('TEST:B13a:21b AC:B13a:5 the signup notice contract', () => {
    it.each([
        [
            'running trial',
            {
                vertical: 'accommodation',
                trial: {
                    status: 'RUNNING',
                    endsAt: '2026-10-20T08:00:00.000Z',
                    daysLeft: 11
                }
            }
        ],
        ['no running trial', { vertical: 'gastronomy', trial: { status: 'NOT_RUNNING' } }]
    ])('accepts %s', (_label, value) => {
        expect(SignupNoticeResponseSchema.parse(value)).toEqual(value);
    });

    it.each([
        [
            'running without endsAt',
            {
                vertical: 'accommodation',
                trial: { status: 'RUNNING', daysLeft: 1 }
            }
        ],
        [
            'zero remaining days',
            {
                vertical: 'accommodation',
                trial: {
                    status: 'RUNNING',
                    endsAt: '2026-10-20T08:00:00.000Z',
                    daysLeft: 0
                }
            }
        ],
        ['unknown vertical', { vertical: 'unknown', trial: { status: 'NOT_RUNNING' } }]
    ])('rejects %s', (_label, value) => {
        expect(() => SignupNoticeResponseSchema.parse(value)).toThrow();
    });
});
