import type { users } from '@repo/db';
import { AuthProviderEnum, PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import type { Actor } from '../../../src/types';
import { ActorFactoryBuilder } from '../../factories/actorFactory';
// import { AccommodationFactoryBuilder } from '../factories/accommodationFactory'; // Descomentar si mockEntity es de tipo Accommodation

export const MOCK_ENTITY_ID = 'test-entity-1';
export const MOCK_USER_ID = 'test-user-1';

export type InferredUser = typeof users.$inferSelect;

export const mockUser: InferredUser = {
    id: MOCK_USER_ID,
    slug: 'test-user',
    authProvider: AuthProviderEnum.CLERK,
    authProviderUserId: 'auth-user-1',
    displayName: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    birthDate: null,
    contactInfo: null,
    location: null,
    socialNetworks: null,
    role: 'USER',
    profile: null,
    settings: {
        notifications: { enabled: true, allowEmails: true, allowSms: false, allowPush: false }
    },
    visibility: VisibilityEnum.PUBLIC,
    lifecycleState: 'ACTIVE',
    adminInfo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
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
    deletedAt: null
};

export const mockDeletedEntity = {
    ...mockEntity,
    deletedAt: new Date() // Simula entidad eliminada para restore
};
