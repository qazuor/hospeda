/**
 * Tests for the atomic trusted-editor action (HOS-374 §5.1.2 / OQ-1).
 *
 * ## Why the fake store instead of plain `vi.fn()` mocks
 *
 * A test that asserts "all four rows exist after a successful call" does NOT
 * test atomicity — it passes just as well against a non-transactional `for`
 * loop. The claim that actually needs proving is the negative one: when the
 * THIRD write fails, NONE of the four rows survive.
 *
 * So `@repo/db`'s `withTransaction` is replaced by a fake transaction manager
 * over an in-memory store with two tiers:
 *
 *   - `committed` — what survives a rollback.
 *   - `staged`    — a copy taken when the boundary opens; promoted to
 *                   `committed` on success, DISCARDED on throw.
 *
 * The model mock routes each write by whether it received a `tx`:
 * `tx` present → `staged`, `tx` absent → straight into `committed`. That makes
 * two distinct production bugs observable as a RED rollback assertion:
 *
 *   1. No transaction at all (plain loop)      → everything lands in `committed`.
 *   2. A transaction opened but `tx` dropped   → that one write lands in
 *      `committed` and survives the rollback.
 *
 * Both are exactly the "publish but not delete" state OQ-1 forbids.
 */
import type { RRolePermissionModel, RUserPermissionModel, UserModel } from '@repo/db';
import {
    PermissionEnum,
    RoleEnum,
    ServiceErrorCode,
    TRUSTED_EDITOR_PERMISSIONS,
    type UserIdType
} from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Fake transactional store (see module docblock)
// ---------------------------------------------------------------------------

interface OverrideRow {
    readonly userId: string;
    readonly permission: PermissionEnum;
    readonly effect: string;
}

type Store = Map<PermissionEnum, OverrideRow>;

const state = vi.hoisted(() => ({
    committed: new Map() as Map<PermissionEnum, OverrideRow>,
    staged: null as Map<PermissionEnum, OverrideRow> | null,
    /** The tx object handed to the callback by the fake boundary. */
    lastTx: null as unknown
}));

const withTransactionMock = vi.hoisted(() =>
    vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        state.staged = new Map(state.committed);
        const tx = { __fakeTx: true, execute: vi.fn(async () => undefined) };
        state.lastTx = tx;
        try {
            const out = await fn(tx);
            // COMMIT — promote the staged copy.
            state.committed = state.staged;
            state.staged = null;
            return out;
        } catch (error) {
            // ROLLBACK — discard the staged copy entirely.
            state.staged = null;
            throw error;
        }
    })
);

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, withTransaction: withTransactionMock };
});

const getUserRolesMock = vi.hoisted(() => vi.fn(async () => [] as unknown[]));
vi.mock('../../../src/services/user-role/user-role.service.js', () => ({
    getUserRoles: getUserRolesMock
}));

import {
    _resetPermissionEffects,
    setPermissionChangeAuditEmitter,
    setUserPermissionsCacheInvalidator
} from '../../../src/services/permission/permission.effects';
import { PermissionService } from '../../../src/services/permission/permission.service';
import { createActor } from '../../factories/actorFactory';
import { getMockId } from '../../factories/utilsFactory';
import { createLoggerMock, createModelMock } from '../../utils/modelMockFactory';

/** Which tier a write with (or without) a `tx` must land in. */
const storeFor = (tx: unknown): Store => (tx && state.staged ? state.staged : state.committed);

const userId = getMockId('user', 'trusted-editor-target') as UserIdType;

const [P1, P2, P3, P4] = TRUSTED_EDITOR_PERMISSIONS;

describe('PermissionService trusted-editor action (HOS-374 OQ-1)', () => {
    let service: PermissionService;
    let userPermissionModelMock: ReturnType<typeof createModelMock>;
    let cacheSpy: Mock;
    let auditSpy: Mock;
    /** Every `tx` argument each model write received, in call order. */
    let seenTxArgs: unknown[];

    beforeEach(() => {
        vi.clearAllMocks();
        state.committed = new Map();
        state.staged = null;
        state.lastTx = null;
        seenTxArgs = [];
        getUserRolesMock.mockResolvedValue([RoleEnum.EDITOR]);

        userPermissionModelMock = createModelMock(['findOne', 'create', 'update', 'hardDelete']);
        userPermissionModelMock.findOne.mockImplementation(
            async (where: { permission: PermissionEnum }, tx?: unknown) => {
                seenTxArgs.push(tx);
                return storeFor(tx).get(where.permission) ?? null;
            }
        );
        userPermissionModelMock.create.mockImplementation(
            async (data: OverrideRow, tx?: unknown) => {
                seenTxArgs.push(tx);
                storeFor(tx).set(data.permission, { ...data });
                return data;
            }
        );
        userPermissionModelMock.update.mockImplementation(
            async (
                where: { permission: PermissionEnum },
                data: { effect: string },
                tx?: unknown
            ) => {
                seenTxArgs.push(tx);
                const store = storeFor(tx);
                const current = store.get(where.permission);
                if (!current) return null;
                const next = { ...current, ...data };
                store.set(where.permission, next);
                return next;
            }
        );
        userPermissionModelMock.hardDelete.mockImplementation(
            async (where: { permission: PermissionEnum }, tx?: unknown) => {
                seenTxArgs.push(tx);
                return storeFor(tx).delete(where.permission) ? 1 : 0;
            }
        );

        service = new PermissionService(
            { logger: createLoggerMock() },
            {
                rolePermissionModel: createModelMock([]) as unknown as RRolePermissionModel,
                userPermissionModel: userPermissionModelMock as unknown as RUserPermissionModel,
                userModel: createModelMock(['findById']) as unknown as UserModel
            }
        );

        cacheSpy = vi.fn();
        auditSpy = vi.fn();
        setUserPermissionsCacheInvalidator(cacheSpy);
        setPermissionChangeAuditEmitter(auditSpy);
    });

    afterEach(() => {
        _resetPermissionEffects();
    });

    const assignActor = () => createActor({ permissions: [PermissionEnum.PERMISSION_ASSIGN] });
    const revokeActor = () => createActor({ permissions: [PermissionEnum.PERMISSION_REVOKE] });

    // -----------------------------------------------------------------------
    // setTrustedEditor
    // -----------------------------------------------------------------------

    describe('setTrustedEditor', () => {
        it('grants all four permissions and commits them together', async () => {
            const result = await service.setTrustedEditor(assignActor(), { userId });

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual({ isTrustedEditor: true, changed: true });
            expect([...state.committed.keys()].sort()).toEqual(
                [...TRUSTED_EDITOR_PERMISSIONS].sort()
            );
            for (const permission of TRUSTED_EDITOR_PERMISSIONS) {
                expect(state.committed.get(permission)?.effect).toBe('grant');
            }
        });

        it('opens exactly ONE transaction boundary and threads its tx to every model call', async () => {
            await service.setTrustedEditor(assignActor(), { userId });

            expect(withTransactionMock).toHaveBeenCalledTimes(1);
            expect(seenTxArgs.length).toBe(TRUSTED_EDITOR_PERMISSIONS.length * 2); // findOne + create
            for (const tx of seenTxArgs) {
                expect(tx).toBe(state.lastTx);
            }
        });

        it('ROLLS BACK every earlier grant when the THIRD write fails', async () => {
            const failing = vi.fn(async (data: OverrideRow, tx?: unknown) => {
                if (data.permission === P3) {
                    throw new Error('connection lost mid-transaction');
                }
                storeFor(tx).set(data.permission, { ...data });
                return data;
            });
            userPermissionModelMock.create.mockImplementation(failing);

            const result = await service.setTrustedEditor(assignActor(), { userId });

            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            // The whole point: not "three rows", not "two rows" — ZERO rows.
            // A publish-without-delete state is exactly what OQ-1 forbids.
            expect([...state.committed.keys()]).toEqual([]);
        });

        it('does not invalidate the cache or emit audits for a rolled-back attempt', async () => {
            userPermissionModelMock.create.mockImplementation(async (data: OverrideRow) => {
                if (data.permission === P3) throw new Error('boom');
                return data;
            });

            await service.setTrustedEditor(assignActor(), { userId });

            expect(cacheSpy).not.toHaveBeenCalled();
            expect(auditSpy).not.toHaveBeenCalled();
        });

        it('NORMALIZES a pre-existing deny into a grant', async () => {
            state.committed.set(P2, { userId, permission: P2, effect: 'deny' });

            const result = await service.setTrustedEditor(assignActor(), { userId });

            expect(result.data).toEqual({ isTrustedEditor: true, changed: true });
            expect(state.committed.get(P2 as never)?.effect).toBe('grant');
            expect(userPermissionModelMock.update).toHaveBeenCalledTimes(1);
            expect(userPermissionModelMock.create).toHaveBeenCalledTimes(3);
        });

        it('is idempotent — a second call writes nothing and reports changed: false', async () => {
            await service.setTrustedEditor(assignActor(), { userId });
            vi.clearAllMocks();

            const result = await service.setTrustedEditor(assignActor(), { userId });

            expect(result.data).toEqual({ isTrustedEditor: true, changed: false });
            expect(userPermissionModelMock.create).not.toHaveBeenCalled();
            expect(userPermissionModelMock.update).not.toHaveBeenCalled();
            expect(cacheSpy).not.toHaveBeenCalled();
            expect(auditSpy).not.toHaveBeenCalled();
        });

        it('invalidates the user cache ONCE and emits one audit per changed permission', async () => {
            await service.setTrustedEditor(assignActor(), { userId });

            expect(cacheSpy).toHaveBeenCalledTimes(1);
            expect(cacheSpy).toHaveBeenCalledWith({ userId });
            expect(auditSpy).toHaveBeenCalledTimes(TRUSTED_EDITOR_PERMISSIONS.length);
            expect(auditSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetUserId: userId,
                    changeType: 'permission_grant',
                    oldValue: 'none',
                    newValue: `${P1}:grant`
                })
            );
        });

        it('returns FORBIDDEN when the actor lacks PERMISSION_ASSIGN', async () => {
            const result = await service.setTrustedEditor(createActor({ permissions: [] }), {
                userId
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(withTransactionMock).not.toHaveBeenCalled();
            expect(state.committed.size).toBe(0);
        });

        it('returns VALIDATION_ERROR (400) when the target user HOLDS SUPER_ADMIN', async () => {
            getUserRolesMock.mockResolvedValue([RoleEnum.EDITOR, RoleEnum.SUPER_ADMIN]);

            const result = await service.setTrustedEditor(assignActor(), { userId });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(withTransactionMock).not.toHaveBeenCalled();
            expect(state.committed.size).toBe(0);
        });

        it('returns VALIDATION_ERROR for a malformed userId', async () => {
            const result = await service.setTrustedEditor(assignActor(), {
                userId: 'not-a-uuid' as UserIdType
            });

            expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(withTransactionMock).not.toHaveBeenCalled();
        });

        it('JOINS a caller-provided transaction instead of opening a nested boundary', async () => {
            // withServiceTransaction does not create savepoints, so a nested
            // boundary would roll back independently of the caller's — silently
            // defeating the atomicity guarantee this action exists to give.
            const outerTx = { __outerTx: true };
            state.staged = new Map(state.committed);

            const result = await service.setTrustedEditor(
                assignActor(),
                { userId },
                { tx: outerTx as never, hookState: {} }
            );

            expect(result.error).toBeUndefined();
            expect(withTransactionMock).not.toHaveBeenCalled();
            // Writes went to the OUTER boundary's staged tier, not straight to committed.
            expect(state.staged?.size).toBe(TRUSTED_EDITOR_PERMISSIONS.length);
            expect(state.committed.size).toBe(0);
            for (const tx of seenTxArgs) {
                expect(tx).toBe(outerTx);
            }
        });
    });

    // -----------------------------------------------------------------------
    // unsetTrustedEditor
    // -----------------------------------------------------------------------

    describe('unsetTrustedEditor', () => {
        const seedAllFour = (effect = 'grant'): void => {
            for (const permission of TRUSTED_EDITOR_PERMISSIONS) {
                state.committed.set(permission, { userId, permission, effect });
            }
        };

        it('hard-deletes all four override rows', async () => {
            seedAllFour();

            const result = await service.unsetTrustedEditor(revokeActor(), { userId });

            expect(result.error).toBeUndefined();
            expect(result.data).toEqual({ isTrustedEditor: false, changed: true });
            expect(state.committed.size).toBe(0);
            expect(userPermissionModelMock.hardDelete).toHaveBeenCalledTimes(4);
        });

        it('deletes rows regardless of their current effect (a hand-made deny is cleaned up too)', async () => {
            seedAllFour('deny');

            const result = await service.unsetTrustedEditor(revokeActor(), { userId });

            expect(result.data).toEqual({ isTrustedEditor: false, changed: true });
            expect(state.committed.size).toBe(0);
        });

        it('ROLLS BACK every earlier delete when the THIRD delete fails', async () => {
            seedAllFour();
            userPermissionModelMock.hardDelete.mockImplementation(
                async (where: { permission: PermissionEnum }, tx?: unknown) => {
                    if (where.permission === P3) {
                        throw new Error('connection lost mid-transaction');
                    }
                    return storeFor(tx).delete(where.permission) ? 1 : 0;
                }
            );

            const result = await service.unsetTrustedEditor(revokeActor(), { userId });

            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            // All four rows must still be there — a half-revoked trusted editor
            // (delete-own gone, publish-own retained) is the forbidden state.
            expect([...state.committed.keys()].sort()).toEqual(
                [...TRUSTED_EDITOR_PERMISSIONS].sort()
            );
            expect(cacheSpy).not.toHaveBeenCalled();
            expect(auditSpy).not.toHaveBeenCalled();
        });

        it('opens exactly ONE transaction boundary and threads its tx to every model call', async () => {
            seedAllFour();

            await service.unsetTrustedEditor(revokeActor(), { userId });

            expect(withTransactionMock).toHaveBeenCalledTimes(1);
            expect(seenTxArgs.length).toBe(TRUSTED_EDITOR_PERMISSIONS.length * 2); // findOne + hardDelete
            for (const tx of seenTxArgs) {
                expect(tx).toBe(state.lastTx);
            }
        });

        it('is idempotent — no rows means no writes and changed: false', async () => {
            const result = await service.unsetTrustedEditor(revokeActor(), { userId });

            expect(result.data).toEqual({ isTrustedEditor: false, changed: false });
            expect(userPermissionModelMock.hardDelete).not.toHaveBeenCalled();
            expect(cacheSpy).not.toHaveBeenCalled();
            expect(auditSpy).not.toHaveBeenCalled();
        });

        it('invalidates the user cache ONCE and emits one audit per removed permission', async () => {
            seedAllFour();

            await service.unsetTrustedEditor(revokeActor(), { userId });

            expect(cacheSpy).toHaveBeenCalledTimes(1);
            expect(cacheSpy).toHaveBeenCalledWith({ userId });
            expect(auditSpy).toHaveBeenCalledTimes(TRUSTED_EDITOR_PERMISSIONS.length);
            expect(auditSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    targetUserId: userId,
                    changeType: 'permission_revoke',
                    oldValue: `${P4}:grant`,
                    newValue: 'none'
                })
            );
        });

        it('returns FORBIDDEN when the actor lacks PERMISSION_REVOKE', async () => {
            seedAllFour();

            const result = await service.unsetTrustedEditor(createActor({ permissions: [] }), {
                userId
            });

            expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
            expect(withTransactionMock).not.toHaveBeenCalled();
            expect(state.committed.size).toBe(TRUSTED_EDITOR_PERMISSIONS.length);
        });
    });
});
