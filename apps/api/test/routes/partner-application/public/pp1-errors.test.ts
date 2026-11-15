import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { classifyPartnerApplicationInsertError } from '../../../../src/services/partner-application/partner-application-errors';

describe('classifyPartnerApplicationInsertError', () => {
    it('recognizes the pending email index in a wrapped PostgreSQL error', () => {
        const error = new Error('Drizzle query failed', {
            cause: { code: '23505', constraint: 'uq_partner_application_pending_email' }
        });
        expect(classifyPartnerApplicationInsertError({ error })).toBe('PENDING_EXISTS');
    });

    it('does not classify a unique violation from another constraint', () => {
        const error = new Error('Drizzle query failed', {
            cause: { code: '23505', constraint: 'another_unique_constraint' }
        });
        expect(classifyPartnerApplicationInsertError({ error })).toBeNull();
    });

    it('recognizes the wait trigger two cause levels down', () => {
        const error = new Error('outer', {
            cause: new Error('inner', {
                cause: { code: 'P0001', message: 'partner_application_wait_active: wait remains' }
            })
        });
        expect(classifyPartnerApplicationInsertError({ error })).toBe('WAIT_ACTIVE');
    });

    it('does not classify another P0001 message', () => {
        const error = new Error('outer', {
            cause: { code: 'P0001', message: 'another_trigger' }
        });
        expect(classifyPartnerApplicationInsertError({ error })).toBeNull();
    });

    it('does not classify an ordinary Error or inspect ServiceError details as causes', () => {
        expect(classifyPartnerApplicationInsertError({ error: new Error('ordinary') })).toBeNull();
        const wrapped = new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'ordinary');
        expect(classifyPartnerApplicationInsertError({ error: wrapped })).toBeNull();
    });
});
