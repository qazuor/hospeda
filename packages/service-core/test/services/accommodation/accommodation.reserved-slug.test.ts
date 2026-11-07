/**
 * accommodation.reserved-slug.test.ts
 *
 * HOS-1862 (AC:6:6) for the accommodation vertical. The generator already
 * prefixes the type, so a reserved word rarely survives it; the real risk is
 * the explicit admin slug (`mapa`, `comparar`, `tipo`, ...). The generated
 * path is still covered: `generateSlug('', 'Mapa')` must append a suffix.
 */

import { AccommodationModel } from '@repo/db';
import type { AccommodationCreateInput, AccommodationUpdateInput } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { generateSlug } from '../../../src/services/accommodation/accommodation.helpers';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { Actor, ServiceConfig } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

const DEST_ID_CITY = '00000000-0000-4000-a000-000000000002';

class MockAccommodationModel {
    findAllWithRelations = vi.fn();
    findAll = vi.fn();
    getTable = vi.fn().mockReturnValue({});
    findById = vi.fn();
    findOne = vi.fn();
    count = vi.fn();
    create = vi.fn();
    update = vi.fn();
    delete = vi.fn();
    softDelete = vi.fn();
    restore = vi.fn();
    hardDelete = vi.fn();
}

class TestAccommodationService extends AccommodationService {
    public callBeforeCreate(
        data: AccommodationCreateInput,
        actor: Actor,
        ctx: { hookState: Record<string, unknown>; tx?: unknown }
    ) {
        return this._beforeCreate(data, actor, ctx as Parameters<typeof this._beforeCreate>[2]);
    }

    public callBeforeUpdate(
        data: AccommodationUpdateInput,
        actor: Actor,
        ctx: { hookState: Record<string, unknown>; tx?: unknown }
    ) {
        return this._beforeUpdate(data, actor, ctx as Parameters<typeof this._beforeUpdate>[2]);
    }
}

const ACTOR: Actor = {
    id: '00000000-0000-4000-a000-000000000010',
    roles: [],
    permissions: []
};

function makeService() {
    const model = new MockAccommodationModel();
    const service = new TestAccommodationService(
        { logger: createLoggerMock() } as ServiceConfig,
        model as unknown as AccommodationModel
    );
    const destinationFindById = vi.fn();
    const serviceWithDestination = service as unknown as {
        _destinationModel: { findById: Mock };
    };
    serviceWithDestination._destinationModel = { findById: destinationFindById };
    return { service, model, destinationFindById };
}

describe('AccommodationService — reserved listing slugs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects an explicit reserved slug on create before reading the destination', async () => {
        const { service, destinationFindById } = makeService();

        await expect(
            service.callBeforeCreate(
                {
                    name: 'Mapa Hostel',
                    slug: 'mapa',
                    type: 'HOTEL',
                    destinationId: DEST_ID_CITY
                } as unknown as AccommodationCreateInput,
                ACTOR,
                { hookState: {} }
            )
        ).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            details: { field: 'slug', reason: 'RESERVED' }
        });
        expect(destinationFindById).not.toHaveBeenCalled();
    });

    it('rejects an explicit reserved slug on update before reading the destination', async () => {
        const { service, destinationFindById } = makeService();

        await expect(
            service.callBeforeUpdate(
                { slug: 'tipo', destinationId: DEST_ID_CITY } as AccommodationUpdateInput,
                ACTOR,
                { hookState: {} }
            )
        ).rejects.toMatchObject({
            code: ServiceErrorCode.VALIDATION_ERROR,
            details: { field: 'slug', reason: 'RESERVED' }
        });
        expect(destinationFindById).not.toHaveBeenCalled();
    });

    it('suffixes a generated slug that lands on a reserved word', async () => {
        const findOneMock = vi.fn().mockResolvedValue(null);
        vi.spyOn(AccommodationModel.prototype, 'findOne').mockImplementation(findOneMock);

        const slug = await generateSlug('', 'Mapa');

        expect(slug).toBe('mapa-2');
        expect(findOneMock).not.toHaveBeenCalledWith({ slug: 'mapa' });
    });
});
