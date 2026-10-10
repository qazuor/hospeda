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

/** Shared system identity for jobs; V5.md §3.3 and GUARD:G19 require this to be the only production file that builds a system actor. */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000001' as const;

/** Invalid system actor definition under V5.md §3.3; GUARD:G19 limits construction to this production file. */
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

/** Build a SYSTEM actor with explicit job permissions under V5.md §3.3; GUARD:G19 makes this the only production file allowed to build one. */
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
        const permission = administrative[0];
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

/** Read the system marker for V5.md §3.3 callers; GUARD:G19 reserves actor construction for this file. */
export function isSystemActor(actor: Pick<Actor, '_isSystemActor'>): boolean {
    return actor._isSystemActor === true;
}
