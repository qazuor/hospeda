/**
 * Trusted-editor schemas (HOS-374 §5.1.2 / OQ-1).
 *
 * A "trusted editor" is NOT a role and NOT a column: it is the same `EDITOR`
 * holding four extra per-user permission overrides in `user_permission`
 * (grant/deny, SPEC-170). Because "publish but not delete" is a state nobody
 * intends, the four are applied and removed as ONE atomic admin action rather
 * than four independent checkboxes in the generic `PermissionPicker`.
 *
 * {@link TRUSTED_EDITOR_PERMISSIONS} is the single source of truth for which
 * permissions make up that bundle. Nothing anywhere may restate the list —
 * derive from this tuple (or from {@link isTrustedEditorFromGrants}) instead.
 *
 * @module permission.trusted-editor.schema
 */
import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { PermissionEnum } from '../../enums/permission.enum.js';

/**
 * The four per-user grants that together make an `EDITOR` a trusted editor.
 *
 * Order is meaningful only for deterministic iteration (audit ordering); the
 * bundle is applied atomically, so no partial subset is ever a valid state.
 */
export const TRUSTED_EDITOR_PERMISSIONS = [
    PermissionEnum.POST_PUBLISH_OWN,
    PermissionEnum.EVENT_PUBLISH_OWN,
    PermissionEnum.POST_DELETE_OWN,
    PermissionEnum.EVENT_DELETE_OWN
] as const;

/** One of the four permissions in {@link TRUSTED_EDITOR_PERMISSIONS}. */
export type TrustedEditorPermission = (typeof TRUSTED_EDITOR_PERMISSIONS)[number];

/**
 * Input for the atomic mark/unmark trusted-editor action.
 *
 * Deliberately carries only the target user: the permission set is fixed by
 * {@link TRUSTED_EDITOR_PERMISSIONS} and is never caller-supplied.
 */
export const TrustedEditorInputSchema = z
    .object({
        userId: UserIdSchema
    })
    .strict();

export type TrustedEditorInput = z.infer<typeof TrustedEditorInputSchema>;

/**
 * Result of the atomic mark/unmark trusted-editor action.
 *
 * - `isTrustedEditor`: the resulting state (`true` after a successful mark,
 *   `false` after a successful unmark).
 * - `changed`: whether any override row was actually written or deleted. Both
 *   actions are idempotent, so a repeated call returns `changed: false`.
 */
export const TrustedEditorResultSchema = z.object({
    isTrustedEditor: z.boolean(),
    changed: z.boolean()
});

export type TrustedEditorResult = z.infer<typeof TrustedEditorResultSchema>;

/**
 * Derives whether a user is a trusted editor from their granted permissions.
 *
 * True iff EVERY permission in {@link TRUSTED_EDITOR_PERMISSIONS} is present.
 * Callers must pass the `grant`-effect override list (a role-inherited or
 * `deny`-effect permission is not a trusted-editor grant).
 *
 * @param params.grantedPermissions - Permissions held as `grant` overrides.
 * @returns `true` when the full bundle is present, `false` otherwise.
 */
export const isTrustedEditorFromGrants = (params: {
    readonly grantedPermissions: readonly PermissionEnum[];
}): boolean => {
    const granted = new Set<PermissionEnum>(params.grantedPermissions);
    return TRUSTED_EDITOR_PERMISSIONS.every((permission) => granted.has(permission));
};
