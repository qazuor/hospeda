/**
 * Unit tests for the system user seed (SPEC-086 R-1).
 *
 * The seed accepts an optional `UserModelPort` override, so all tests use an
 * in-memory stub and never require a live database connection.
 *
 * References: AC-F20, D-005, R-1
 */
import { RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserModelPort } from '../../src/required/systemUser.seed.js';
import { seedSystemUser } from '../../src/required/systemUser.seed.js';

// Use literal constant values to avoid workspace module resolution issues in
// the Vitest test runner. These MUST match packages/db/src/constants/index.ts.
const SYSTEM_USER_ID = 'a0000000-0000-4000-8000-000000000001' as const;
const SYSTEM_USER_EMAIL = 'system@hospeda.internal' as const;

// ---------------------------------------------------------------------------
// Mock the logger and summaryTracker so tests do not produce terminal noise.
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/summaryTracker.js', () => ({
    summaryTracker: {
        trackSuccess: vi.fn(),
        trackError: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// In-memory stub that satisfies UserModelPort — no real DB required.
// ---------------------------------------------------------------------------

/**
 * Captures the most recent argument passed to `create`.
 */
let capturedCreateArg: Record<string, unknown> | null = null;

/**
 * Controls what `findOne` returns.
 * Set to a truthy object to simulate an already-existing system user.
 */
let findOneReturnValue: Record<string, unknown> | null = null;

/**
 * Tracks the number of times `create` was called.
 */
let createCallCount = 0;

/**
 * When set, `create` throws this error instead of returning normally.
 */
let createShouldThrow: Error | null = null;

/** Builds a fresh stub for each test. */
function buildStubModel(): UserModelPort {
    return {
        async findOne(_filter: Partial<Record<string, unknown>>) {
            return findOneReturnValue;
        },
        async create(data: Partial<Record<string, unknown>>) {
            createCallCount++;
            capturedCreateArg = data as Record<string, unknown>;
            if (createShouldThrow) {
                throw createShouldThrow;
            }
            return data as Record<string, unknown>;
        }
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('seedSystemUser (SPEC-086 R-1)', () => {
    let model: UserModelPort;

    beforeEach(() => {
        // Reset all shared state and build a fresh stub for each test.
        capturedCreateArg = null;
        findOneReturnValue = null;
        createCallCount = 0;
        createShouldThrow = null;
        model = buildStubModel();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('when the system user does not yet exist', () => {
        it('should insert a user row with id equal to SYSTEM_USER_ID', async () => {
            // Arrange: findOne returns null — user does not exist
            findOneReturnValue = null;

            // Act
            await seedSystemUser(model);

            // Assert: create was called exactly once with the correct id
            expect(createCallCount).toBe(1);
            expect(capturedCreateArg?.id).toBe(SYSTEM_USER_ID);
        });

        it('should insert a user row with email equal to SYSTEM_USER_EMAIL', async () => {
            findOneReturnValue = null;

            await seedSystemUser(model);

            expect(capturedCreateArg?.email).toBe(SYSTEM_USER_EMAIL);
        });

        it('should insert a user row with role SYSTEM', async () => {
            findOneReturnValue = null;

            await seedSystemUser(model);

            expect(capturedCreateArg?.role).toBe(RoleEnum.SYSTEM);
        });

        it('should set emailVerified to false (non-loginable account)', async () => {
            findOneReturnValue = null;

            await seedSystemUser(model);

            expect(capturedCreateArg?.emailVerified).toBe(false);
        });

        it('should set banned to true (extra non-loginable safeguard)', async () => {
            findOneReturnValue = null;

            await seedSystemUser(model);

            expect(capturedCreateArg?.banned).toBe(true);
        });

        it('should set visibility to PRIVATE', async () => {
            findOneReturnValue = null;

            await seedSystemUser(model);

            expect(capturedCreateArg?.visibility).toBe('PRIVATE');
        });

        it('should set lifecycleState to ACTIVE so FK references remain valid', async () => {
            findOneReturnValue = null;

            await seedSystemUser(model);

            expect(capturedCreateArg?.lifecycleState).toBe('ACTIVE');
        });
    });

    describe('idempotency — when the system user already exists', () => {
        it('should NOT call create when the user already exists', async () => {
            // Arrange: findOne returns an existing user
            findOneReturnValue = { id: SYSTEM_USER_ID, email: SYSTEM_USER_EMAIL };

            // Act
            await seedSystemUser(model);

            // Assert: no insert occurred
            expect(createCallCount).toBe(0);
        });

        it('should resolve without error when called a second time', async () => {
            findOneReturnValue = { id: SYSTEM_USER_ID, email: SYSTEM_USER_EMAIL };

            // Act & Assert — must not throw
            await expect(seedSystemUser(model)).resolves.toBeUndefined();
        });

        it('should remain idempotent across multiple invocations', async () => {
            // First call — user does not exist, will create
            findOneReturnValue = null;
            await seedSystemUser(model);
            expect(createCallCount).toBe(1);

            // Second call — user now exists
            findOneReturnValue = { id: SYSTEM_USER_ID, email: SYSTEM_USER_EMAIL };
            await seedSystemUser(model);

            // create must not have been called again
            expect(createCallCount).toBe(1);
        });
    });

    describe('error handling', () => {
        it('should propagate errors thrown by the DB create call', async () => {
            // Arrange: user does not exist, but insert fails
            findOneReturnValue = null;
            createShouldThrow = new Error('DB connection lost');

            // Act & Assert
            await expect(seedSystemUser(model)).rejects.toThrow('DB connection lost');
        });
    });
});
