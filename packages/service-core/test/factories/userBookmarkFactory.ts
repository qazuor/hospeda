import type {
    DestinationIdType,
    UserBookmark,
    UserBookmarkIdType,
    UserIdType
} from '@repo/schemas';
import { EntityTypeEnum, LifecycleStatusEnum } from '@repo/schemas';
import { BaseFactoryBuilder } from './baseEntityFactory';
import { getMockId } from './utilsFactory';

/**
 * Devuelve un UserBookmarkId válido para tests.
 * @param id - String opcional para generar un UUID determinista.
 */
export const getMockUserBookmarkId = (id?: string): UserBookmarkIdType => {
    return getMockId('userBookmark', id) as UserBookmarkIdType;
};

/**
 * Base UserBookmarkType para tests.
 */
const baseUserBookmark: UserBookmark = {
    id: getMockUserBookmarkId(),
    userId: getMockId('user') as UserIdType,
    entityId: getMockId('destination') as DestinationIdType,
    entityType: EntityTypeEnum.DESTINATION,
    name: 'My destination',
    description: 'A place I want to visit',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: undefined,
    createdById: getMockId('user') as UserIdType,
    updatedById: getMockId('user') as UserIdType,
    deletedById: undefined,
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    adminInfo: undefined
};

/**
 * Builder para UserBookmarkType (entidad completa, para mocks de modelo y tests de output).
 */
export class UserBookmarkFactoryBuilder extends BaseFactoryBuilder<UserBookmark> {
    constructor() {
        super(baseUserBookmark);
    }
}

/**
 * Crea un UserBookmarkType completo para tests, con overrides opcionales.
 */
export const createMockUserBookmark = (overrides: Partial<UserBookmark> = {}): UserBookmark => {
    return new UserBookmarkFactoryBuilder().with(overrides).build();
};

/**
 * Crea un input válido para crear un UserBookmark (solo campos permitidos por el schema de create).
 * @param overrides - Campos a sobrescribir.
 * @returns Input válido para create (sin campos de auditoría, admin ni userId).
 */
export const createMockUserBookmarkCreateInput = (
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

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use createMockUserBookmark instead
 */
export const createUserBookmark = createMockUserBookmark;

/**
 * @deprecated Use createMockUserBookmarkCreateInput instead
 */
export const createUserBookmarkInput = createMockUserBookmarkCreateInput;
