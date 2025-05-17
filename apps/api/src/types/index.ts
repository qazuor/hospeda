// apps/api/src/types/index.ts
import { StateEnum, type UserType } from '@repo/types';

// Define the public user for non-authenticated endpoints
export const publicUser: UserType = {
    id: 'public',
    roleId: 'USER',
    permissions: [],
    userName: '',
    passwordHash: '',
    state: StateEnum.ACTIVE,
    name: '',
    displayName: '',
    createdAt: new Date(),
    createdById: '',
    updatedAt: new Date(),
    updatedById: ''
};

// Extend Hono's types to include our custom properties
// This needs to be in a .d.ts file to properly extend the global namespace
