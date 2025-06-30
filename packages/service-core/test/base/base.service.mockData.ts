import type { users } from '@repo/db';
import { PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/types';
import type { Actor } from '../../src/types';
import { ActorFactoryBuilder } from '../factories/actorFactory';
// import { AccommodationFactoryBuilder } from '../factories/accommodationFactory'; // Descomentar si mockEntity es de tipo Accommodation

export const MOCK_ENTITY_ID = 'test-entity-1';
export const MOCK_USER_ID = 'test-user-1';

export type InferredUser = typeof users.$inferSelect;

export const mockUser: InferredUser = {
    id: MOCK_USER_ID,
    authId: 'auth-user-1',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    emailVerified: true,
    avatar: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'ACTIVE',
    bio: null
};

export const mockActor: Actor = new ActorFactoryBuilder()
    .withId(MOCK_USER_ID)
    .withRole(RoleEnum.USER)
    .withPermissions([])
    .build();

export const mockAdminActor: Actor = new ActorFactoryBuilder()
    .superAdmin()
    .withId('admin-user-1')
    .withPermissions([PermissionEnum.ACCOMMODATION_CREATE, PermissionEnum.ACCOMMODATION_UPDATE_ANY])
    .build();

export const mockEntity = {
    id: MOCK_ENTITY_ID,
    name: 'Test Entity',
    value: 123,
    visibility: VisibilityEnum.PUBLIC,
    ownerId: MOCK_USER_ID,
    createdById: MOCK_USER_ID,
    updatedById: MOCK_USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: new Date()
};
