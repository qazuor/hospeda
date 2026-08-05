/**
 * The atomic "trusted editor" action (HOS-374 §5.1.2 / OQ-1).
 *
 * A trusted editor is the same `EDITOR` holding the four per-user overrides in
 * {@link TRUSTED_EDITOR_PERMISSIONS}. The whole point of this module is that the
 * four move TOGETHER: a user holding publish but not delete is a state nobody
 * intends, so every write here runs inside ONE transaction boundary and a
 * failure on the third permission rolls back the first two.
 *
 * Lives in its own module (rather than inline in `permission.service.ts`) to
 * keep that file under the 500-line ceiling, following the same split the
 * sibling `permission.service.permission.ts` / `permission.service.normalizer.ts`
 * modules already use.
 *
 * @module permission.service.trusted-editor
 */
import type { RUserPermissionModel } from '@repo/db';
import type { TrustedEditorResult, UserIdType } from '@repo/schemas';
import {
    PermissionEffectEnum,
    type PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    TRUSTED_EDITOR_PERMISSIONS
} from '@repo/schemas';
import type { Actor, DrizzleClient, ServiceContext } from '../../types';
import { ServiceError } from '../../types';
import { withServiceTransaction } from '../../utils/transaction.js';
import { getUserRoles } from '../user-role/user-role.service.js';
import {
    emitPermissionChangeAudit,
    invalidateUserPermissionsOverrides
} from './permission.effects';
import { canAssignPermissions, canRevokePermissions } from './permission.service.permission';

/** Models the trusted-editor action needs. */
export interface TrustedEditorDeps {
    readonly userPermissionModel: RUserPermissionModel;
}

/**
 * One override transition performed inside the transaction, buffered so the
 * audit events are emitted only AFTER the boundary commits — a rolled-back
 * write must never leave an audit trail claiming it happened.
 */
interface PendingAudit {
    readonly permission: PermissionEnum;
    readonly oldValue: string;
    readonly newValue: string;
}

/**
 * Runs `work` inside a transaction boundary.
 *
 * When the caller already provided one (`ctx.tx`), the work JOINS it instead of
 * opening a nested boundary — `withServiceTransaction` does not create
 * savepoints, so nesting would make the inner rollback independent of the outer
 * one and silently defeat the atomicity guarantee this module exists to give.
 */
const runInTransaction = async <T>(
    ctx: ServiceContext | undefined,
    work: (tx: DrizzleClient) => Promise<T>
): Promise<T> => {
    if (ctx?.tx) return work(ctx.tx);
    return withServiceTransaction(async (txCtx) =>
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        work(txCtx.tx!)
    );
};

/**
 * Rejects a target user that holds SUPER_ADMIN.
 *
 * Same guard as `assignPermissionToUser`: a SUPER_ADMIN short-circuits to all
 * permissions at auth resolution, so any override written for them is silent
 * orphan data. Fail loud with a 400 instead of persisting a no-op.
 *
 * @throws {ServiceError} VALIDATION_ERROR when the target holds SUPER_ADMIN.
 */
const assertTargetIsNotSuperAdmin = async (userId: UserIdType): Promise<void> => {
    const targetUserRoles = await getUserRoles({ userId });
    if (targetUserRoles.includes(RoleEnum.SUPER_ADMIN)) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'cannot assign overrides to a SUPER_ADMIN'
        );
    }
};

/**
 * Fires the post-commit side effects for a trusted-editor transition.
 *
 * Cache invalidation is per-USER, so it fires exactly ONCE per call regardless
 * of how many overrides moved. Audit emission is per-PERMISSION because the
 * audit contract (`PermissionChangeAuditPayload`) carries a single
 * `oldValue`/`newValue` string pair encoded as `permission:effect` — it has no
 * field able to express a four-permission bundle, and its consumer
 * (`auditLog` → structured log + Sentry) reads exactly that encoding.
 */
const emitEffects = (params: {
    readonly actorId: string;
    readonly userId: UserIdType;
    readonly changeType: 'permission_grant' | 'permission_revoke';
    readonly audits: readonly PendingAudit[];
}): void => {
    if (params.audits.length === 0) return;
    invalidateUserPermissionsOverrides({ userId: params.userId });
    for (const audit of params.audits) {
        emitPermissionChangeAudit({
            actorId: params.actorId,
            targetUserId: params.userId,
            changeType: params.changeType,
            oldValue: audit.oldValue,
            newValue: audit.newValue
        });
    }
};

/**
 * Marks a user as a trusted editor: writes `grant` for all four permissions in
 * {@link TRUSTED_EDITOR_PERMISSIONS}, atomically.
 *
 * NORMALIZES rather than merely adding: a permission already present as a
 * hand-made `deny` is flipped to `grant`, so the result is always the full
 * bundle at `grant`. Idempotent — a user who already holds all four returns
 * `{ isTrustedEditor: true, changed: false }` with no writes.
 *
 * @param deps - Models the action operates on.
 * @param actor - The actor performing the action (needs `PERMISSION_ASSIGN`).
 * @param input - `{ userId }` of the target user.
 * @param ctx - Optional service context; its `tx` is JOINED when present.
 * @returns The resulting trusted-editor state and whether anything changed.
 * @throws {ServiceError} FORBIDDEN when the actor cannot assign permissions,
 *   VALIDATION_ERROR when the target holds SUPER_ADMIN.
 */
export const applySetTrustedEditor = async (
    deps: TrustedEditorDeps,
    actor: Actor,
    input: { readonly userId: UserIdType },
    ctx?: ServiceContext
): Promise<TrustedEditorResult> => {
    if (!canAssignPermissions(actor)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to assign permissions.'
        );
    }
    await assertTargetIsNotSuperAdmin(input.userId);

    const audits = await runInTransaction(ctx, async (tx) => {
        const performed: PendingAudit[] = [];
        for (const permission of TRUSTED_EDITOR_PERMISSIONS) {
            const existing = await deps.userPermissionModel.findOne(
                { userId: input.userId, permission },
                tx
            );
            if (existing?.effect === PermissionEffectEnum.GRANT) continue;

            if (existing) {
                await deps.userPermissionModel.update(
                    { userId: input.userId, permission },
                    { effect: PermissionEffectEnum.GRANT },
                    tx
                );
            } else {
                await deps.userPermissionModel.create(
                    {
                        userId: input.userId,
                        permission,
                        effect: PermissionEffectEnum.GRANT
                    },
                    tx
                );
            }
            performed.push({
                permission,
                oldValue: existing ? existing.effect : 'none',
                newValue: `${permission}:${PermissionEffectEnum.GRANT}`
            });
        }
        return performed;
    });

    emitEffects({
        actorId: actor.id,
        userId: input.userId,
        changeType: 'permission_grant',
        audits
    });

    return { isTrustedEditor: true, changed: audits.length > 0 };
};

/**
 * Un-marks a trusted editor: hard-DELETES all four override rows, atomically.
 *
 * Deletion (not an explicit `deny`) is the owner decision for HOS-374: it leaves
 * no residue, and if the `EDITOR` role itself ever grants one of these the user
 * follows role policy instead of silently fighting a stale per-user deny.
 * Rows are removed regardless of their current effect, so a hand-made `deny` is
 * cleaned up too. Idempotent — a user holding none of the four returns
 * `{ isTrustedEditor: false, changed: false }`.
 *
 * @param deps - Models the action operates on.
 * @param actor - The actor performing the action (needs `PERMISSION_REVOKE`).
 * @param input - `{ userId }` of the target user.
 * @param ctx - Optional service context; its `tx` is JOINED when present.
 * @returns The resulting trusted-editor state and whether anything changed.
 * @throws {ServiceError} FORBIDDEN when the actor cannot revoke permissions.
 */
export const applyUnsetTrustedEditor = async (
    deps: TrustedEditorDeps,
    actor: Actor,
    input: { readonly userId: UserIdType },
    ctx?: ServiceContext
): Promise<TrustedEditorResult> => {
    if (!canRevokePermissions(actor)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You do not have permission to revoke permissions.'
        );
    }

    const audits = await runInTransaction(ctx, async (tx) => {
        const performed: PendingAudit[] = [];
        for (const permission of TRUSTED_EDITOR_PERMISSIONS) {
            const existing = await deps.userPermissionModel.findOne(
                { userId: input.userId, permission },
                tx
            );
            if (!existing) continue;

            await deps.userPermissionModel.hardDelete({ userId: input.userId, permission }, tx);
            performed.push({
                permission,
                oldValue: `${permission}:${existing.effect}`,
                newValue: 'none'
            });
        }
        return performed;
    });

    emitEffects({
        actorId: actor.id,
        userId: input.userId,
        changeType: 'permission_revoke',
        audits
    });

    return { isTrustedEditor: false, changed: audits.length > 0 };
};
