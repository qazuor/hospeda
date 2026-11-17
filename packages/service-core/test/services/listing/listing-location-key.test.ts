import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findOwnOccupant } = vi.hoisted(() => ({ findOwnOccupant: vi.fn() }));
vi.mock('@repo/db', () => ({ listingLocationModel: { findOwnOccupant } }));

import {
    applyLocationRuleOnUpdate,
    asDuplicateLocationError,
    assertNoOwnLocationConflict,
    resolveLocationKeyPatch
} from '../../../src/services/listing/listing-location-key';

const DEST = 'dest-1';

describe('resolveLocationKeyPatch', () => {
    it('computes the key on create from location and destination', () => {
        const patch = resolveLocationKeyPatch({
            payload: { destinationId: DEST, location: { street: 'Av. San Martín', number: '123' } },
            current: null
        });
        expect(patch).toEqual({ locationKey: 'av san martin|123|dest-1' });
    });

    it('does not touch the key when neither location nor destination change', () => {
        const patch = resolveLocationKeyPatch({
            payload: { name: 'x' },
            current: { destinationId: DEST, location: { street: 'a b', number: '1' } }
        });
        expect(patch).toEqual({});
    });

    it('merges a partial location over the stored one on update', () => {
        const patch = resolveLocationKeyPatch({
            payload: { location: { number: '200' } },
            current: { destinationId: DEST, location: { street: 'Mitre', number: '1' } }
        });
        expect(patch).toEqual({ locationKey: 'mitre|200|dest-1' });
    });

    it('recomputes when only the destination changes', () => {
        const patch = resolveLocationKeyPatch({
            payload: { destinationId: 'dest-2' },
            current: { destinationId: DEST, location: { street: 'Mitre', number: '1' } }
        });
        expect(patch).toEqual({ locationKey: 'mitre|1|dest-2' });
    });

    it('clears the key when the number becomes s/n or empty', () => {
        const current = { destinationId: DEST, location: { street: 'Mitre', number: '1' } };
        expect(
            resolveLocationKeyPatch({ payload: { location: { number: 's/n' } }, current })
        ).toEqual({
            locationKey: null
        });
        expect(resolveLocationKeyPatch({ payload: { location: { number: '' } }, current })).toEqual(
            {
                locationKey: null
            }
        );
    });

    it('returns a null key when the stored location is null and the payload has none', () => {
        const patch = resolveLocationKeyPatch({
            payload: { destinationId: DEST },
            current: { destinationId: 'old', location: null }
        });
        expect(patch).toEqual({ locationKey: null });
    });

    // HOS-2318: an explicit `location: null` wipes the address, so the key must go too.
    it('clears the key when the payload sets location to null', () => {
        const patch = resolveLocationKeyPatch({
            payload: { location: null },
            current: { destinationId: DEST, location: { street: 'Mitre', number: '1' } }
        });
        expect(patch).toEqual({ locationKey: null });
    });

    it('clears the key when location is nulled together with a destination change', () => {
        const patch = resolveLocationKeyPatch({
            payload: { location: null, destinationId: 'dest-2' },
            current: { destinationId: DEST, location: { street: 'Mitre', number: '1' } }
        });
        expect(patch).toEqual({ locationKey: null });
    });

    it('clears the key when street and number are blanked through flat fields', () => {
        const patch = resolveLocationKeyPatch({
            payload: { location: { street: '', number: '' } },
            current: { destinationId: DEST, location: { street: 'Mitre', number: '1' } }
        });
        expect(patch).toEqual({ locationKey: null });
    });

    it('clears the key when the destination is explicitly set to null', () => {
        const patch = resolveLocationKeyPatch({
            payload: { destinationId: null },
            current: { destinationId: DEST, location: { street: 'Mitre', number: '1' } }
        });
        expect(patch).toEqual({ locationKey: null });
    });

    it('applies a fresh location over a null stored one on update', () => {
        const patch = resolveLocationKeyPatch({
            payload: { location: { street: 'Mitre', number: '1' } },
            current: { destinationId: DEST, location: null }
        });
        expect(patch).toEqual({ locationKey: 'mitre|1|dest-1' });
    });
});

describe('assertNoOwnLocationConflict', () => {
    beforeEach(() => findOwnOccupant.mockReset());

    it('does nothing without a key', async () => {
        await assertNoOwnLocationConflict({
            vertical: VerticalEnum.VENUE,
            listingId: 'l1',
            ownerId: 'o1',
            locationKey: null
        });
        expect(findOwnOccupant).not.toHaveBeenCalled();
    });

    it('passes when no occupant exists', async () => {
        findOwnOccupant.mockResolvedValue(null);
        await expect(
            assertNoOwnLocationConflict({
                vertical: VerticalEnum.VENUE,
                listingId: 'l1',
                ownerId: 'o1',
                locationKey: 'k'
            })
        ).resolves.toBeUndefined();
        expect(findOwnOccupant).toHaveBeenCalledWith(
            expect.objectContaining({
                vertical: VerticalEnum.VENUE,
                ownerId: 'o1',
                excludeId: 'l1'
            })
        );
    });

    it('throws ALREADY_EXISTS with DUPLICATE_LOCATION and the own existing id', async () => {
        findOwnOccupant.mockResolvedValue('other-id');
        await expect(
            assertNoOwnLocationConflict({
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: 'l1',
                ownerId: 'o1',
                locationKey: 'k'
            })
        ).rejects.toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'DUPLICATE_LOCATION',
            details: { reason: 'DUPLICATE_LOCATION', existingListingId: 'other-id' }
        });
    });
});

describe('applyLocationRuleOnUpdate', () => {
    beforeEach(() => findOwnOccupant.mockReset());
    const published = {
        id: 'l1',
        ownerId: 'o1',
        publicationStatus: 'PUBLISHED',
        destinationId: DEST,
        location: { street: 'Mitre', number: '1' },
        locationKey: 'mitre|1|dest-1',
        locationExceptionAt: null
    };
    const payload = { location: { number: '2' } };

    it('blocks moving a PUBLISHED listing onto an occupied place', async () => {
        findOwnOccupant.mockResolvedValue('other');
        await expect(
            applyLocationRuleOnUpdate({ vertical: VerticalEnum.VENUE, payload, current: published })
        ).rejects.toMatchObject({ reason: 'DUPLICATE_LOCATION' });
    });

    it('does not block a DRAFT', async () => {
        findOwnOccupant.mockResolvedValue('other');
        const patch = await applyLocationRuleOnUpdate({
            vertical: VerticalEnum.VENUE,
            payload,
            current: { ...published, publicationStatus: 'DRAFT' }
        });
        expect(patch).toEqual({ locationKey: 'mitre|2|dest-1' });
        expect(findOwnOccupant).not.toHaveBeenCalled();
    });

    it('does not block moving to the address the exception was granted for', async () => {
        findOwnOccupant.mockResolvedValue('other');
        const patch = await applyLocationRuleOnUpdate({
            vertical: VerticalEnum.VENUE,
            payload,
            current: {
                ...published,
                locationExceptionAt: new Date(),
                locationExceptionKey: 'mitre|2|dest-1'
            }
        });
        expect(patch.locationKey).toBe('mitre|2|dest-1');
        expect(findOwnOccupant).not.toHaveBeenCalled();
    });

    it('blocks moving an excepted listing to ANOTHER address its owner already publishes', async () => {
        findOwnOccupant.mockResolvedValue('other');
        await expect(
            applyLocationRuleOnUpdate({
                vertical: VerticalEnum.VENUE,
                payload,
                current: {
                    ...published,
                    locationExceptionAt: new Date(),
                    locationExceptionKey: 'mitre|1|dest-1'
                }
            })
        ).rejects.toMatchObject({ reason: 'DUPLICATE_LOCATION' });
    });

    it('does not check when the key is unchanged or the body has no address', async () => {
        await applyLocationRuleOnUpdate({
            vertical: VerticalEnum.VENUE,
            payload: { name: 'x' },
            current: published
        });
        await applyLocationRuleOnUpdate({
            vertical: VerticalEnum.VENUE,
            payload: { location: { number: '1' } },
            current: published
        });
        expect(findOwnOccupant).not.toHaveBeenCalled();
    });
});

describe('asDuplicateLocationError', () => {
    const pgError = (constraint: string, code = '23505') => {
        const driver = Object.assign(new Error('duplicate key'), { code, constraint });
        return new Error('Failed query: insert ...', { cause: driver });
    };

    it.each([
        'accommodations_ownerId_locationKey_published_uniq',
        'venues_ownerId_locationKey_published_uniq'
    ])('maps a 23505 on %s (found in error.cause) to the 409', (constraint) => {
        const mapped = asDuplicateLocationError(pgError(constraint), 'own-id');
        expect(mapped).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'DUPLICATE_LOCATION',
            details: { reason: 'DUPLICATE_LOCATION', existingListingId: 'own-id' }
        });
    });

    it('omits the id when the occupant is unknown', () => {
        const mapped = asDuplicateLocationError(
            pgError('venues_ownerId_locationKey_published_uniq')
        );
        expect(mapped?.details).toEqual({ reason: 'DUPLICATE_LOCATION' });
    });

    it('ignores other constraints, other SQLSTATEs and plain errors', () => {
        expect(asDuplicateLocationError(pgError('venues_slug_unique'))).toBeNull();
        expect(
            asDuplicateLocationError(pgError('venues_ownerId_locationKey_published_uniq', '23503'))
        ).toBeNull();
        expect(asDuplicateLocationError(new Error('boom'))).toBeNull();
        expect(asDuplicateLocationError(null)).toBeNull();
    });
});
