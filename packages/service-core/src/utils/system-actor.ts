import { PermissionEnum, RoleEnum } from '@repo/schemas';
import {
    ADMINISTRATIVE_ACTION_PERMISSION_SET,
    ADMINISTRATIVE_ACTION_PERMISSIONS,
    ADMINISTRATIVE_ACTIONS
} from '@repo/verticals';
import { z } from 'zod';
import type { Actor } from '../types/index.js';

const SystemActorInputSchema = z.object({
    jobId: z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/),
    permissions: z.array(z.nativeEnum(PermissionEnum))
});

/**
 * Shared identity for system jobs under V5.md §3.3.
 * GUARD:G19 reserves system actor construction for this production file.
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001' as const;

/**
 * Typed failure for an invalid job, an administrative permission, or the full permission set.
 * V5.md §3.3 requires rejection at construction; GUARD:G19 reserves construction for this file.
 */
export class SystemActorDefinitionError extends Error {
    readonly code: 'INVALID_INPUT' | 'ADMINISTRATIVE_PERMISSION' | 'ALL_PERMISSIONS';
    readonly permissions: readonly PermissionEnum[];

    constructor(
        code: SystemActorDefinitionError['code'],
        message: string,
        permissions: readonly PermissionEnum[] = []
    ) {
        super(message);
        this.name = 'SystemActorDefinitionError';
        this.code = code;
        this.permissions = Object.freeze([...permissions]);
    }
}

/**
 * Build an immutable SYSTEM actor with only the permissions declared by its job.
 * V5.md §3.3 and GUARD:G19 make this the only production file allowed to build one.
 *
 * @param input - Stable job ID and explicit permissions used by that job.
 * @returns A frozen actor with a frozen permission list and SYSTEM role.
 * @throws {SystemActorDefinitionError} For invalid input, all permissions, or an administrative permission.
 */
export function createSystemActor(input: {
    readonly jobId: string;
    readonly permissions: readonly PermissionEnum[];
}): Actor {
    const parsed = SystemActorInputSchema.safeParse(input);
    if (!parsed.success) {
        throw new SystemActorDefinitionError('INVALID_INPUT', 'Invalid system actor input');
    }

    const declared = new Set(parsed.data.permissions);
    if (Object.values(PermissionEnum).every((permission) => declared.has(permission))) {
        throw new SystemActorDefinitionError(
            'ALL_PERMISSIONS',
            'A system actor cannot hold every permission',
            parsed.data.permissions
        );
    }

    const administrative = parsed.data.permissions.filter((permission) =>
        ADMINISTRATIVE_ACTION_PERMISSION_SET.has(permission)
    );
    if (administrative.length > 0) {
        const permission = administrative[0] as PermissionEnum;
        const action = ADMINISTRATIVE_ACTIONS.find((candidate) =>
            ADMINISTRATIVE_ACTION_PERMISSIONS[candidate].permissions.includes(permission)
        );
        throw new SystemActorDefinitionError(
            'ADMINISTRATIVE_PERMISSION',
            `System actor permission ${permission} belongs to administrative action ${action}`,
            administrative
        );
    }

    return Object.freeze({
        id: SYSTEM_ACTOR_ID,
        roles: Object.freeze([RoleEnum.SYSTEM]),
        permissions: Object.freeze([...parsed.data.permissions]),
        _isSystemActor: true,
        _systemJobId: parsed.data.jobId
    });
}

/**
 * Read the system marker for V5.md §3.3 authorization callers.
 * GUARD:G19 reserves construction of marked actors for this production file.
 *
 * @param actor - Actor whose system marker is being checked.
 * @returns Whether the marker is exactly true.
 */
export function isSystemActor(actor: Pick<Actor, '_isSystemActor'>): boolean {
    return actor._isSystemActor === true;
}
