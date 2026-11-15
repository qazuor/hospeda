import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { describe, expect, it } from 'vitest';
import { createErrorHandler } from '../../../src/middlewares/response';
import { mapListingPublishDenial } from '../../../src/services/listing-publication/listing-publication.service';
import { createRouter } from '../../../src/utils/create-app';

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

    it('maps changed source state to a conflict', () => {
        expect(mapListingPublishDenial('STATE_CHANGED').code).toBe(ServiceErrorCode.ALREADY_EXISTS);
        expect(mapListingPublishDenial('INVALID_FROM').code).toBe(ServiceErrorCode.ALREADY_EXISTS);
    });

    it('maps missing listings and non-owner decisions to the indistinguishable 404 code', () => {
        expect(mapListingPublishDenial('LISTING_NOT_FOUND').code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(mapListingPublishDenial('NOT_OWNER').code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('maps NEW_PAID_SIGNUPS_FROZEN to the 409 code with the FIRST_PUBLISH_PAUSED reason', () => {
        const error = mapListingPublishDenial('NEW_PAID_SIGNUPS_FROZEN');
        expect(error.code).toBe(ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN);
        expect(error.reason).toBe('FIRST_PUBLISH_PAUSED');
    });

    it('keeps NEW_PAID_SIGNUPS_FROZEN at 409 in the application error middleware', async () => {
        const app = createRouter();
        app.onError(createErrorHandler());
        app.get('/freeze', () => {
            throw new ServiceError(
                ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN,
                'New paid signups are paused'
            );
        });

        const response = await app.request('/freeze');
        const body: unknown = await response.json();

        expect(response.status).toBe(409);
        expect(body).toMatchObject({
            success: false,
            error: { code: ServiceErrorCode.NEW_PAID_SIGNUPS_FROZEN }
        });
    });
});
