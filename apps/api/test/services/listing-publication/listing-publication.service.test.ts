import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { mapListingPublishDenial } from '../../../src/services/listing-publication/listing-publication.service';

describe('listing publication HTTP mapping', () => {
    it('maps absent coverage and exhausted trial to subscription_required', () => {
        const error = mapListingPublishDenial('TRIAL_LIMIT_REACHED');
        expect(error.code).toBe(ServiceErrorCode.FORBIDDEN);
        expect(error.message).toBe('subscription_required');
    });

    it('maps full quota to LIMIT_REACHED with the accommodation limit key', () => {
        const error = mapListingPublishDenial('LIMIT_REACHED');
        expect(error.code).toBe(ServiceErrorCode.LIMIT_REACHED);
        expect(error.details).toMatchObject({ limitKey: expect.any(String) });
    });

    it('maps changed source state and the PB3-only covered case to conflicts', () => {
        expect(mapListingPublishDenial('STATE_CHANGED').code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(mapListingPublishDenial('COVERED_USE_PB3').code).toBe(
            ServiceErrorCode.ALREADY_EXISTS
        );
    });

    it('maps missing listings and non-owner decisions to the indistinguishable 404 code', () => {
        expect(mapListingPublishDenial('LISTING_NOT_FOUND').code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mapListingPublishDenial('NOT_OWNER').code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});
