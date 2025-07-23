import type { DestinationId, UserBookmarkId, UserBookmarkType, UserId } from '@repo/types';
import { EntityTypeEnum, LifecycleStatusEnum } from '@repo/types';
import { BaseFactoryBuilder } from './baseEntityFactory';
import { getMockId } from './utilsFactory';

/**
 * Devuelve un UserBookmarkId válido para tests.
 * @param id - String opcional para generar un UUID determinista.
 */
export const getMockUserBookmarkId = (id?: string): UserBookmarkId => {
    return getMockId('feature', id) as UserBookmarkId;
};

/**
 * Base UserBookmarkType para tests.
 */
const baseUserBookmark: UserBookmarkType = {
    id: getMockUserBookmarkId(),
    userId: getMockId('user') as UserId,
    entityId: getMockId('destination') as DestinationId,
    entityType: EntityTypeEnum.DESTINATION,
    name: 'My destination',
    description: 'A place I want to visit',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: getMockId('user') as UserId,
    updatedById: getMockId('user') as UserId,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

/**
 * Builder para UserBookmarkType (entidad completa, para mocks de modelo y tests de output).
 */
export class UserBookmarkFactoryBuilder extends BaseFactoryBuilder<UserBookmarkType> {
    constructor() {
        super(baseUserBookmark);
    }
}

/**
 * Crea un UserBookmarkType completo para tests, con overrides opcionales.
 */
export const createUserBookmark = (overrides: Partial<UserBookmarkType> = {}): UserBookmarkType => {
    return new UserBookmarkFactoryBuilder().with(overrides).build();
};

/**
 * Crea un input válido para crear un UserBookmark (solo campos permitidos por el schema de create).
 * @param overrides - Campos a sobrescribir.
 * @returns Input válido para create (sin campos de auditoría, admin ni userId).
 */
export const createUserBookmarkInput = (
    overrides: Partial<{
        userId: string;
        entityId: string;
        entityType: EntityTypeEnum;
        name?: string;
        description?: string;
    }> = {}
) => {
    return {
        userId: getMockId('user'),
        entityId: getMockId('destination'),
        entityType: EntityTypeEnum.DESTINATION,
        name: 'My destination',
        description: 'A place I want to visit',
        ...overrides
    };
};
