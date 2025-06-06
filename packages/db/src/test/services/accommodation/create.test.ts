import { PermissionEnum, RoleEnum } from '@repo/types';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationModel } from '../../../models/accommodation/accommodation.model';
import { AccommodationService } from '../../../services/accommodation/accommodation.service';
import * as permissionManager from '../../../utils/permission-manager';
import {
    getExpectedCreatedAccommodationMatchObject,
    getMockAccommodationCreated,
    getMockAccommodationInput,
    getMockPublicUser,
    getMockUser,
    getMockUserId
} from '../../mockData';
import type { TestAccommodationCreateInput } from '../../types/testAccommodation.types';
import { expectInfoLog, expectPermissionLog } from '../../utils/logAssertions';

vi.mock('../../../utils/logger', async (importOriginal) => {
    const actualImport = await importOriginal();
    const actual = typeof actualImport === 'object' && actualImport !== null ? actualImport : {};
    return {
        ...actual,
        dbLogger: {
            info: vi.fn(),
            error: vi.fn(),
            permission: vi.fn()
        }
    };
});

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

describe('accommodation.service.create', () => {
    const user = getMockUser({
        id: getMockUserId(),
        role: RoleEnum.ADMIN,
        permissions: [PermissionEnum.ACCOMMODATION_CREATE]
    });
    const noPermUser = getMockUser({ id: getMockUserId(), role: RoleEnum.USER });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create accommodation and log start/end', async () => {
        (AccommodationModel.create as Mock).mockResolvedValue(getMockAccommodationCreated());
        const input: TestAccommodationCreateInput = getMockAccommodationInput();
        const result = await AccommodationService.create(input, user);
        expect(result.accommodation).toMatchObject(getExpectedCreatedAccommodationMatchObject());
        expectInfoLog(
            {
                input: expect.objectContaining({
                    name: 'Nuevo Hotel',
                    createdAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                }),
                actor: expect.any(Object)
            },
            'create:start'
        );
        expectInfoLog(
            {
                result: expect.objectContaining({
                    accommodation: expect.objectContaining({
                        name: 'Nuevo Hotel',
                        createdAt: expect.any(Date),
                        updatedAt: expect.any(Date)
                    })
                })
            },
            'create:end'
        );
    });

    it('should throw and log permission if user has no permission', async () => {
        (AccommodationModel.create as Mock).mockResolvedValue(getMockAccommodationCreated());
        vi.spyOn(permissionManager, 'hasPermission').mockImplementation(() => {
            throw new Error('Forbidden: User does not have permission to create accommodation');
        });
        const input: TestAccommodationCreateInput = getMockAccommodationInput();
        await expect(AccommodationService.create(input, noPermUser)).rejects.toThrow(/Forbidden/);
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: noPermUser.id,
            role: noPermUser.role,
            extraData: expect.objectContaining({ error: expect.stringContaining('Forbidden') })
        });
    });

    it('should throw on invalid input', async () => {
        const base = getMockAccommodationInput();
        const input: TestAccommodationCreateInput = {
            ...base,
            name: '',
            seo: { ...base.seo, keywords: base.seo.keywords ?? ['hotel', 'nuevo', 'moderno'] }
        };
        await expect(AccommodationService.create(input, user)).rejects.toThrow();
    });

    it('should throw and log permission if actor is public user', async () => {
        const input: TestAccommodationCreateInput = getMockAccommodationInput();
        await expect(AccommodationService.create(input, getMockPublicUser())).rejects.toThrow(
            /Public user cannot create/
        );
        expectPermissionLog({
            permission: PermissionEnum.ACCOMMODATION_CREATE,
            userId: 'public',
            role: RoleEnum.GUEST,
            extraData: expect.objectContaining({
                override: expect.stringContaining('Public user cannot create')
            })
        });
    });
});
