import { PermissionEnum, RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { AccommodationService } from '../../../services/accommodation/accommodation.service';
import { expectInfoLog, expectPermissionLog } from '../../utils/logAssertions';
import {
    getMockAccommodationPrivate,
    getMockAccommodationPublic,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../mockData';

vi.mock('../../../models/accommodation/accommodation.model', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        AccommodationModel: {
            ...((actual as Record<string, unknown>).AccommodationModel ?? {}),
            create: vi.fn(),
            getById: vi.fn(),
            getByName: vi.fn(),
            search: vi.fn(),
            update: vi.fn(),
            hardDelete: vi.fn(),
            getByDestination: vi.fn()
        },
        ACCOMMODATION_ORDERABLE_COLUMNS: [
            'ownerId',
            'destinationId',
            'averageRating',
            'visibility',
            'lifecycle',
            'name',
            'type'
        ]
    };
});

describe('accommodation.service.list', () => {
    const publicUser = getMockPublicUser();
    const user = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const accommodationPublic = getMockAccommodationPublic();
    const accommodationPrivate = getMockAccommodationPrivate();
    const accommodations = [accommodationPublic, accommodationPrivate];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return only PUBLIC accommodations for public user', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([accommodationPublic]);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, publicUser);
        expect(result.accommodations).toEqual([accommodationPublic]);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: publicUser }, 'list:start');
        expectInfoLog({ result: { accommodations: [accommodationPublic] } }, 'list:end');
    });

    it('should log permission if public user requests PRIVATE visibility', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([accommodationPublic]);
        await AccommodationService.list(
            { limit: 10, offset: 0, visibility: 'PRIVATE' },
            publicUser
        );
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_VIEW_ALL,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.objectContaining({ override: expect.any(String) })
        });
    });

    it('should return all accommodations for logged in user', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue(accommodations);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, user);
        expect(result.accommodations).toEqual(accommodations);
        expectInfoLog({ input: { limit: 10, offset: 0 }, actor: user }, 'list:start');
        expectInfoLog({ result: { accommodations: accommodations } }, 'list:end');
    });

    it('should apply filters (type, q, order)', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([accommodationPublic]);
        const result = await AccommodationService.list(
            {
                limit: 5,
                offset: 0,
                type: 'HOTEL',
                q: 'Hotel',
                order: 'asc',
                orderBy: 'name'
            },
            user
        );
        expectInfoLog(
            {
                input: {
                    type: 'HOTEL',
                    q: 'Hotel',
                    order: 'asc',
                    orderBy: 'name',
                    limit: 5,
                    offset: 0
                },
                actor: user
            },
            'list:start'
        );
        expect(result.accommodations).toEqual([accommodationPublic]);
        expectInfoLog({ result: { accommodations: [accommodationPublic] } }, 'list:end');
    });

    it('should return empty array if no accommodations found', async () => {
        (AccommodationModel.search as Mock).mockResolvedValue([]);
        const result = await AccommodationService.list({ limit: 10, offset: 0 }, user);
        expect(result.accommodations).toEqual([]);
        expectInfoLog({ result: { accommodations: [] } }, 'list:end');
    });
});
