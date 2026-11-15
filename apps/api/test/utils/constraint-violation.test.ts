import { describe, expect, it } from 'vitest';
import { buildConstraintViolationResponse } from '../../src/utils/constraint-violation';

describe('TEST:1820:5 AC:1:7 — venue featured media constraint', () => {
    it('TEST:1820:5 AC:1:7 maps the renamed unique index to the featured image conflict response', () => {
        const error = new Error('Failed query', {
            cause: {
                code: '23505',
                constraint: 'uq_venue_media_single_featured',
                table: 'venue_media'
            }
        });

        expect(buildConstraintViolationResponse(error, 'venue')).toEqual({
            payload: {
                code: 'ALREADY_EXISTS',
                message: 'This listing already has a featured image. Unset the current one first.',
                details: undefined
            },
            status: 409
        });
    });
});

describe('HOS-1810 one-address unique index', () => {
    it.each([
        'accommodations_ownerId_locationKey_published_uniq',
        'venues_ownerId_locationKey_published_uniq'
    ])('maps %s to 409 ALREADY_EXISTS with reason DUPLICATE_LOCATION', (constraint) => {
        const error = new Error('Failed query', { cause: { code: '23505', constraint } });

        expect(buildConstraintViolationResponse(error, 'venue')).toEqual({
            payload: {
                code: 'ALREADY_EXISTS',
                message: 'Another published listing of yours already occupies this address',
                details: undefined,
                reason: 'DUPLICATE_LOCATION'
            },
            status: 409
        });
    });

    it('leaves any other unique violation without that reason', () => {
        const error = new Error('Failed query', {
            cause: { code: '23505', constraint: 'venues_slug_unique', table: 'venues' }
        });
        expect(buildConstraintViolationResponse(error, 'venue')?.payload.reason).toBeUndefined();
    });
});
