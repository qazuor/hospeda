import { describe, expect, it } from 'vitest';
import { describeProviderRejection } from '../../../../src/services/billing/refund/refund-provider-rejection-reason.js';

describe('describeProviderRejection', () => {
    it('keeps an adapter status beside the original payment body shape', () => {
        expect(
            describeProviderRejection({
                error: Object.assign(new Error('request failed'), {
                    httpStatus: 401,
                    cause: {
                        status: 'REJECTED',
                        message: 'Unauthorized',
                        payer: { email: 'private@example.com' }
                    }
                })
            })
        ).toEqual({
            message: 'request failed',
            cause: { httpStatus: 401, message: 'Unauthorized' }
        });
    });

    it('keeps only the approved provider fields and truncates strings', () => {
        const { message, cause } = describeProviderRejection({
            error: Object.assign(new Error('request failed'), {
                cause: {
                    status: 401,
                    body: {
                        message: 'm'.repeat(600),
                        error: 'unauthorized',
                        payer: { email: 'private@example.com' },
                        cause: [{ code: 4010, description: 'd'.repeat(600), card_id: 'secret' }]
                    }
                }
            })
        });
        expect(message).toBe('request failed');
        expect(cause).toEqual({
            httpStatus: 401,
            message: 'm'.repeat(500),
            error: 'unauthorized',
            cause: [{ code: 4010, description: 'd'.repeat(500) }]
        });
        expect(JSON.stringify(cause).length).toBeLessThanOrEqual(2000);
    });

    it('stringifies a non-serializable cause and handles an absent cause', () => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        expect(
            describeProviderRejection({
                error: Object.assign(new Error('failed'), { cause: cyclic })
            })
        ).toEqual({ message: 'failed', cause: { message: '[object Object]' } });
        expect(describeProviderRejection({ error: new Error('failed') })).toEqual({
            message: 'failed'
        });
    });

    it('filters root cause arrays through the provider whitelist', () => {
        const { cause } = describeProviderRejection({
            error: Object.assign(new Error('failed'), {
                cause: [
                    {
                        code: 'REJECTED',
                        description: 'declined',
                        payer: { email: 'private@example.com' },
                        card_id: 'secret-card'
                    },
                    { code: 4010, email: 'private@example.com' },
                    'untrusted text'
                ]
            })
        });

        expect(cause).toEqual([{ code: 'REJECTED', description: 'declined' }, { code: 4010 }]);
        expect(JSON.stringify(cause)).not.toContain('private@example.com');
        expect(JSON.stringify(cause)).not.toContain('secret-card');
    });

    it('sanitizes primitive and non-serializable fallback causes', () => {
        expect(
            describeProviderRejection({ error: Object.assign(new Error('failed'), { cause: 42 }) })
        ).toEqual({ message: 'failed', cause: { message: '42' } });

        const cyclic: Record<string, unknown> = { email: 'private@example.com' };
        cyclic.self = cyclic;
        expect(
            describeProviderRejection({
                error: Object.assign(new Error('failed'), { cause: cyclic })
            })
        ).toEqual({ message: 'failed', cause: { message: '[object Object]' } });
    });
});
