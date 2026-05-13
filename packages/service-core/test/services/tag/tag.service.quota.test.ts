/**
 * Tests for TagService USER tag quota enforcement (SPEC-086 T-019).
 *
 * Acceptance Criteria:
 * - AC-F09: At quota (50), 51st create returns QUOTA_EXCEEDED, no row inserted.
 * - AC-F17: Env var HOSPEDA_TAG_USER_QUOTA_PER_USER overrides default 50.
 * - AC-F10 (concurrent race): Two simultaneous creates at boundary (49→50→51).
 *
 * Advisory lock integration note:
 * Unit tests here mock `withTransaction` from `@repo/db` to avoid needing a real
 * PostgreSQL connection. The mock captures the callback and calls it with a fake
 * transaction object, allowing us to assert the lock SQL was issued and the quota
 * count was checked. Full end-to-end race prevention (AC-F10) requires a real DB
 * and is exercised in the integration test suite. See comment on the race test below.
 */
import { withTransaction as mockWithTx } from '@repo/db';
import { REntityTagModel, TagModel } from '@repo/db';
import {
    LifecycleStatusEnum,
    PermissionEnum,
    ServiceErrorCode,
    TagColorEnum,
    TagTypeEnum
} from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createActor } from '../../factories/actorFactory';
import { TagFactoryBuilder } from '../../factories/tagFactory';
import { createLoggerMock, createTypedModelMock } from '../../utils/modelMockFactory';
import { asMock } from '../../utils/test-utils';

// ---------------------------------------------------------------------------
// Mock @repo/db to intercept withTransaction and sql template tag
// ---------------------------------------------------------------------------

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        /**
         * Intercept withTransaction so tests can control the callback execution
         * without a real PostgreSQL connection.
         *
         * The mock calls the callback with a fake DrizzleClient that has an
         * `execute` stub. This lets the service issue the advisory lock SQL and
         * countActiveByOwner without a live DB, while still exercising the full
         * service code path.
         */
        withTransaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
            const fakeTx = {
                execute: vi.fn().mockResolvedValue([])
            };
            return callback(fakeTx);
        }),
        sql: actual.sql
    };
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const OWNER_ID = 'a1b2c3d4-0000-4000-a000-000000000099';

function buildUserTagInput(ownerId: string = OWNER_ID) {
    return {
        name: 'My Tag',
        type: TagTypeEnum.USER,
        color: TagColorEnum.BLUE,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ownerId
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagService — USER tag quota enforcement (T-019, SPEC-086)', () => {
    let service: TagService;
    let tagModelMock: TagModel;
    let relatedModelMock: REntityTagModel;
    let loggerMock: ReturnType<typeof createLoggerMock>;
    let actor: Actor;

    beforeEach(() => {
        tagModelMock = createTypedModelMock(TagModel, [
            'create',
            'findByType',
            'countActiveByOwner'
        ]);
        relatedModelMock = createTypedModelMock(REntityTagModel, []);
        loggerMock = createLoggerMock();
        service = new TagService({ logger: loggerMock }, tagModelMock, relatedModelMock);
        actor = createActor({ id: OWNER_ID, permissions: [PermissionEnum.TAG_USER_CREATE] });

        // No cross-type collision by default
        asMock(tagModelMock.findByType).mockResolvedValue([]);
    });

    afterEach(() => {
        // Restore env var override after each test
        process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = undefined;
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // AC-F09: At quota, next create is rejected
    // -------------------------------------------------------------------------
    describe('AC-F09: Create at quota boundary returns QUOTA_EXCEEDED', () => {
        it('should return QUOTA_EXCEEDED when count equals default quota (50)', async () => {
            // Arrange: user already has exactly 50 ACTIVE USER tags
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(50);

            // Act
            const result = await service.create(actor, buildUserTagInput());

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
            expect(result.error?.message).toMatch(/50/);
            // model.create must NOT have been called
            expect(asMock(tagModelMock.create)).not.toHaveBeenCalled();
        });

        it('should return QUOTA_EXCEEDED when count exceeds default quota', async () => {
            // Arrange: user already has 51 (edge case — should not happen normally)
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(51);

            const result = await service.create(actor, buildUserTagInput());

            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
        });

        it('should succeed when count is below default quota', async () => {
            // Arrange: user has 49 ACTIVE USER tags — one slot remaining
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(49);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID, { name: 'My Tag' });
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.create(actor, buildUserTagInput());

            expect(result.error).toBeUndefined();
            expect(result.data?.type).toBe(TagTypeEnum.USER);
            expect(asMock(tagModelMock.create)).toHaveBeenCalledOnce();
        });

        it('should succeed when count is zero (first USER tag)', async () => {
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID, { name: 'First Tag' });
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.create(actor, {
                ...buildUserTagInput(),
                name: 'First Tag'
            });

            expect(result.error).toBeUndefined();
            expect(result.data?.ownerId).toBe(OWNER_ID);
        });
    });

    // -------------------------------------------------------------------------
    // AC-F17: Env var overrides default quota
    // -------------------------------------------------------------------------
    describe('AC-F17: HOSPEDA_TAG_USER_QUOTA_PER_USER overrides default 50', () => {
        it('should reject 6th create when quota env var is set to 5', async () => {
            // Arrange
            process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = '5';
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(5);

            // Act
            const result = await service.create(actor, buildUserTagInput());

            // Assert
            expect(result.error?.code).toBe(ServiceErrorCode.QUOTA_EXCEEDED);
            expect(result.error?.message).toMatch(/5/);
        });

        it('should allow 5th create when quota env var is 5 and count is 4', async () => {
            process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = '5';
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(4);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID);
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.create(actor, buildUserTagInput());

            expect(result.error).toBeUndefined();
        });

        it('should fall back to 50 when env var is not a valid integer', async () => {
            process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = 'not-a-number';
            // Count at 49 → should succeed (quota falls back to 50)
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(49);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID);
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.create(actor, buildUserTagInput());

            expect(result.error).toBeUndefined();
        });

        it('should fall back to 50 when env var is zero or negative', async () => {
            process.env.HOSPEDA_TAG_USER_QUOTA_PER_USER = '0';
            // Count at 49 → should succeed (fallback quota = 50)
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(49);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID);
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            const result = await service.create(actor, buildUserTagInput());

            expect(result.error).toBeUndefined();
        });
    });

    // -------------------------------------------------------------------------
    // Advisory lock invocation verification
    // -------------------------------------------------------------------------
    describe('Advisory lock: SQL is issued inside a transaction', () => {
        it('should call withTransaction when no ctx.tx is provided', async () => {
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID);
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            await service.create(actor, buildUserTagInput());

            expect(asMock(mockWithTx)).toHaveBeenCalled();
        });

        it('should call execute with pg_advisory_xact_lock SQL inside the transaction', async () => {
            let capturedFakeTx: { execute: ReturnType<typeof vi.fn> } | undefined;

            asMock(mockWithTx).mockImplementation(
                async (
                    callback: (tx: { execute: ReturnType<typeof vi.fn> }) => Promise<unknown>
                ) => {
                    const fakeTx = { execute: vi.fn().mockResolvedValue([]) };
                    capturedFakeTx = fakeTx;
                    return callback(fakeTx);
                }
            );

            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID);
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            await service.create(actor, buildUserTagInput());

            expect(capturedFakeTx?.execute).toHaveBeenCalledOnce();
            const callArg = capturedFakeTx?.execute.mock.calls[0]?.[0];
            // The SQL object from Drizzle's sql tag is a SQL instance with queryChunks.
            // JSON.stringify flattens the internal structure; the static SQL text fragments
            // are stored as { value: "..." } chunks inside queryChunks.
            const sqlJson = JSON.stringify(callArg);
            expect(sqlJson).toMatch(/pg_advisory_xact_lock/i);
        });

        it('should NOT call withTransaction when ctx.tx is already set', async () => {
            asMock(mockWithTx).mockClear();

            const fakeTx = { execute: vi.fn().mockResolvedValue([]) };
            asMock(tagModelMock.countActiveByOwner).mockResolvedValue(0);
            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID);
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            // Pass a ctx with tx already set — service should skip withTransaction
            await service.create(actor, buildUserTagInput(), {
                tx: fakeTx as unknown as import('@repo/db').DrizzleClient
            });

            expect(asMock(mockWithTx)).not.toHaveBeenCalled();
            // The fake tx execute should have been called for the advisory lock
            expect(fakeTx.execute).toHaveBeenCalledOnce();
        });
    });

    // -------------------------------------------------------------------------
    // AC-F10: Concurrent race at quota boundary
    // -------------------------------------------------------------------------
    describe('AC-F10: Concurrent race protection', () => {
        /**
         * Full end-to-end race prevention (where two concurrent goroutine-style
         * creates at count=49 both see count < 50 before the lock) requires a real
         * PostgreSQL connection and concurrent transaction boundaries. That scenario
         * is covered by the service-core integration test suite.
         *
         * This unit test verifies that the advisory lock SQL IS issued before the
         * count check, which is the necessary precondition for the lock to prevent
         * overcounting at the DB level.
         */
        it('should issue advisory lock BEFORE countActiveByOwner (lock-then-count order)', async () => {
            const callOrder: string[] = [];
            const fakeTx = {
                execute: vi.fn().mockImplementation(() => {
                    callOrder.push('lock');
                    return Promise.resolve([]);
                })
            };

            asMock(mockWithTx).mockImplementation(
                async (callback: (tx: typeof fakeTx) => Promise<unknown>) => callback(fakeTx)
            );

            asMock(tagModelMock.countActiveByOwner).mockImplementation(() => {
                callOrder.push('count');
                return Promise.resolve(0);
            });

            const createdTag = TagFactoryBuilder.createUserTag(OWNER_ID);
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            await service.create(actor, buildUserTagInput());

            // Verify lock was acquired BEFORE count was checked
            expect(callOrder[0]).toBe('lock');
            expect(callOrder[1]).toBe('count');
        });

        it('should not check quota for SYSTEM tags (advisory lock not used)', async () => {
            asMock(mockWithTx).mockClear();

            const systemActor = createActor({
                permissions: [PermissionEnum.TAG_SYSTEM_CREATE]
            });
            const createdTag = TagFactoryBuilder.create({ name: 'System Tag' });
            asMock(tagModelMock.create).mockResolvedValue(createdTag);

            await service.create(systemActor, {
                name: 'System Tag',
                type: TagTypeEnum.SYSTEM,
                color: TagColorEnum.BLUE,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: null
            });

            // No advisory lock or quota check for non-USER tags
            expect(asMock(mockWithTx)).not.toHaveBeenCalled();
            expect(asMock(tagModelMock.countActiveByOwner)).not.toHaveBeenCalled();
        });
    });
});
