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
