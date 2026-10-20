import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { serviceErrorReason } from '../../../src/services/cutover-b9a/step-3b.errors.js';

describe('serviceErrorReason', () => {
    it('returns the reason for a ServiceError', () => {
        const error = new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Service failure',
            undefined,
            'SERVICE_FAILURE'
        );

        expect(serviceErrorReason({ error })).toEqual({ reason: 'SERVICE_FAILURE' });
    });

    it('does not return a reason from another Error class', () => {
        class ErrorWithReason extends Error {
            readonly reason = 'UNTRUSTED_REASON';
        }

        expect(serviceErrorReason({ error: new ErrorWithReason('Failure') })).toEqual({});
    });
});
