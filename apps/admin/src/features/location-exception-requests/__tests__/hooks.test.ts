/**
 * @file hooks.test.ts
 * Path builder and API-error reader of the location-exception feature.
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/errors';
import { buildLocationExceptionPath, readLocationExceptionError } from '../hooks';

describe('buildLocationExceptionPath', () => {
    it('builds the queue, decision and listing paths per vertical', () => {
        expect(buildLocationExceptionPath({ vertical: 'venues' })).toBe(
            '/api/v1/admin/venues/location-exception-requests'
        );
        expect(
            buildLocationExceptionPath({
                vertical: 'accommodations',
                requestId: 'r',
                decision: 'reject'
            })
        ).toBe('/api/v1/admin/accommodations/location-exception-requests/r/reject');
        expect(buildLocationExceptionPath({ vertical: 'venues', listingId: 'x' })).toBe(
            '/api/v1/admin/venues/x/location-exception'
        );
    });
});

describe('readLocationExceptionError', () => {
    it('reads reason and existingListingId from the error envelope', () => {
        const error = new ApiError('conflict', {
            status: 409,
            body: {
                error: {
                    reason: 'LOCATION_EXCEPTION_REVOKE_CONFLICT',
                    details: { existingListingId: 'abc' }
                }
            }
        });
        expect(readLocationExceptionError(error)).toEqual({
            status: 409,
            reason: 'LOCATION_EXCEPTION_REVOKE_CONFLICT',
            existingListingId: 'abc'
        });
    });

    it('returns empty info for a non-API error', () => {
        expect(readLocationExceptionError(new Error('x'))).toEqual({
            status: undefined,
            reason: undefined,
            existingListingId: undefined
        });
    });
});
