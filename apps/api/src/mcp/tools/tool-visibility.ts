/**
 * @file tool-visibility.ts
 * @description Which tools an actor may see (HOS-2184 T-042).
 *
 * Decided by `PermissionEnum` only, never by role (G6,
 * `check-role-never-decides`). A tool with no `requiredPermissions` is visible
 * to any authenticated account; one with some needs at least one of them.
 * Visibility hides what the account could never use; the handler's own
 * permission check still refuses on its own.
 */

import type { Actor } from '@repo/service-core';
import type { ToolDefinition } from './tool-definition';

/**
 * Whether the actor may see the tool.
 *
 * @param args - The tool and the actor
 * @returns `true` when the tool declares no permission or the actor holds one of them
 *
 * @example
 * ```typescript
 * const visible = tools.filter((definition) => isToolVisibleTo({ definition, actor }));
 * ```
 */
export function isToolVisibleTo({
    definition,
    actor
}: {
    readonly definition: Pick<ToolDefinition, 'requiredPermissions'>;
    readonly actor: Pick<Actor, 'permissions'>;
}): boolean {
    const required = definition.requiredPermissions ?? [];
    return (
        required.length === 0 ||
        required.some((permission) => actor.permissions.includes(permission))
    );
}
