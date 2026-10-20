import { PublicationStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ServiceError } from '../../src/types';
import { assertListingReadable } from '../../src/utils/listing-readable';

const actor = { id: 'visitor', roles: [RoleEnum.USER], permissions: [] };

describe('assertListingReadable', () => {
    it('reads a published foreign listing and an owned draft', () => {
        expect(() =>
            assertListingReadable({
                actor,
                entity: { ownerId: 'owner', publicationStatus: PublicationStatusEnum.PUBLISHED },
                entityName: 'gastronomy'
            })
        ).not.toThrow();
        expect(() =>
            assertListingReadable({
                actor,
                entity: { ownerId: 'visitor', publicationStatus: PublicationStatusEnum.DRAFT },
                entityName: 'gastronomy'
            })
        ).not.toThrow();
    });

    it('masks hidden and absent rows with the same NOT_FOUND error', () => {
        const capture = (entity: unknown) => {
            try {
                assertListingReadable({ actor, entity, entityName: 'gastronomy' });
            } catch (error) {
                if (error instanceof ServiceError)
                    return { code: error.code, message: error.message };
            }
            throw new Error('Expected ServiceError');
        };
        expect(
            capture({ ownerId: 'owner', publicationStatus: PublicationStatusEnum.DRAFT })
        ).toEqual(capture(null));
        expect(capture(null)).toEqual({
            code: ServiceErrorCode.NOT_FOUND,
            message: 'gastronomy not found'
        });
    });
});
