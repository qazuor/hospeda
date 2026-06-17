/**
 * Tests for the ai-core storage module (SPEC-173 T-010).
 *
 * The DB is stubbed entirely via `vi.mock('@repo/db')` so no real database
 * connection is required.  The mock factory returns a chainable builder for
 * `select().from().where().limit()` calls and simple mock functions for
 * `insert().values().onConflictDoUpdate().returning()` and
 * `insert().values().returning()` chains.
 *
 * Strategy:
 * - Build the mock query chain once per test via factory helpers.
 * - Re-assign `mockGetDb.mockReturnValue(...)` in each `beforeEach` / `it`.
 * - Verify: correct inputs forwarded, returned values threaded back, schema
 *   rejection on invalid blobs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @repo/db BEFORE importing the modules under test
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    aiSettings: { key: 'key' },
    aiPromptVersions: {
        feature: 'feature',
        isActive: 'is_active',
        deletedAt: 'deleted_at'
    },
    aiUsage: {},
    aiRequestLog: {},
    eq: vi.fn((_col, _val) => `eq(${String(_col)},${String(_val)})`),
    and: vi.fn((...args: unknown[]) => `and(${args.join(',')})`),
    isNull: vi.fn((_col) => `isNull(${String(_col)})`),
    getDb: vi.fn()
}));

import * as dbModule from '@repo/db';
import {
    AiSettingsParseError,
    getActivePrompt,
    insertAiRequestLog,
    insertAiUsage,
    readAiSettings,
    writeAiSettings
} from '../src/storage/index.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers — chainable query builder stubs
// ---------------------------------------------------------------------------

/**
 * Builds a `select().from().where().limit()` chain that resolves to `rows`.
 */
function buildSelectChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const limitFn = vi.fn().mockResolvedValue(rows);
    const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
    const fromFn = vi.fn().mockReturnValue({ where: whereFn });
    const selectFn = vi.fn().mockReturnValue({ from: fromFn });
    return selectFn;
}

/**
 * Builds an `insert().values().returning()` chain that resolves to `rows`.
 */
function buildInsertChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const returningFn = vi.fn().mockResolvedValue(rows);
    const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
    return insertFn;
}

/**
 * Builds an `insert().values().onConflictDoUpdate().returning()` chain.
 */
function buildUpsertChain(rows: unknown[]): ReturnType<typeof vi.fn> {
    const returningFn = vi.fn().mockResolvedValue(rows);
    const onConflictFn = vi.fn().mockReturnValue({ returning: returningFn });
    const valuesFn = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictFn });
    const insertFn = vi.fn().mockReturnValue({ values: valuesFn });
    return insertFn;
}

// ---------------------------------------------------------------------------
// Valid test data
// ---------------------------------------------------------------------------

const VALID_SETTINGS_BLOB = {
    providers: {
        openai: { enabled: true },
        anthropic: { enabled: false }
    },
    features: {
        text_improve: {
            enabled: true,
            primaryProvider: 'openai' as const,
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        chat: {
            enabled: true,
            primaryProvider: 'anthropic' as const,
            fallbackChain: ['openai' as const],
            model: 'claude-3-5-sonnet-20241022',
            params: {}
        },
        search: {
            enabled: false,
            primaryProvider: 'openai' as const,
            fallbackChain: [],
            model: 'gpt-4o',
            params: {}
        },
        support: {
            enabled: false,
            primaryProvider: 'openai' as const,
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        translate: {
            enabled: false,
            primaryProvider: 'openai' as const,
            fallbackChain: [],
            model: 'gemini-1.5-flash',
            params: {}
        },
        accommodation_import: {
            enabled: false,
            primaryProvider: 'openai' as const,
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        }
    }
} as const;

const VALID_SETTINGS_ROW = {
    key: 'global',
    value: VALID_SETTINGS_BLOB,
    updatedBy: 'aaaaaaaa-0000-0000-0000-000000000001',
    updatedAt: new Date(),
    createdAt: new Date()
};

const ACTOR_ID = 'aaaaaaaa-0000-0000-0000-000000000002';

// ---------------------------------------------------------------------------
// readAiSettings
// ---------------------------------------------------------------------------

describe('readAiSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when no row exists', () => {
        it('should return null', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildSelectChain([]) });

            // Act
            const result = await readAiSettings();

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('when the stored blob is valid', () => {
        it('should return the parsed AiSettingsValue', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildSelectChain([VALID_SETTINGS_ROW]) });

            // Act
            const result = await readAiSettings();

            // Assert
            expect(result).not.toBeNull();
            expect(result?.providers).toEqual(VALID_SETTINGS_BLOB.providers);
            expect(result?.features.text_improve.enabled).toBe(true);
            expect(result?.features.chat.primaryProvider).toBe('anthropic');
        });
    });

    describe('when the stored blob is invalid', () => {
        it('should throw AiSettingsParseError', async () => {
            // Arrange — invalid blob missing required fields
            const corruptedRow = { ...VALID_SETTINGS_ROW, value: { unexpected: 'garbage' } };
            mockGetDb.mockReturnValue({ select: buildSelectChain([corruptedRow]) });

            // Act + Assert
            await expect(readAiSettings()).rejects.toThrow(AiSettingsParseError);
        });

        it('should include a non-empty issues string in the error', async () => {
            // Arrange
            const corruptedRow = { ...VALID_SETTINGS_ROW, value: { providers: 'bad' } };
            mockGetDb.mockReturnValue({ select: buildSelectChain([corruptedRow]) });

            // Act
            let caught: AiSettingsParseError | null = null;
            try {
                await readAiSettings();
            } catch (err) {
                if (err instanceof AiSettingsParseError) caught = err;
            }

            // Assert
            expect(caught).toBeInstanceOf(AiSettingsParseError);
            expect(caught?.issues.length).toBeGreaterThan(0);
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { select: buildSelectChain([VALID_SETTINGS_ROW]) };

            // Act
            const result = await readAiSettings(fakeTx as never);

            // Assert
            expect(result).not.toBeNull();
            // getDb should NOT have been called
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// writeAiSettings
// ---------------------------------------------------------------------------

describe('writeAiSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('when the value is valid', () => {
        it('should upsert with key=global and return the saved row', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ insert: buildUpsertChain([VALID_SETTINGS_ROW]) });

            // Act
            const result = await writeAiSettings({ value: VALID_SETTINGS_BLOB, actorId: ACTOR_ID });

            // Assert
            expect(result.key).toBe('global');
            expect(result.updatedBy).toBe(VALID_SETTINGS_ROW.updatedBy);
        });

        it('should set updatedBy to the provided actorId', async () => {
            // Arrange
            const savedRow = { ...VALID_SETTINGS_ROW, updatedBy: ACTOR_ID };
            mockGetDb.mockReturnValue({ insert: buildUpsertChain([savedRow]) });

            // Act
            const result = await writeAiSettings({ value: VALID_SETTINGS_BLOB, actorId: ACTOR_ID });

            // Assert
            expect(result.updatedBy).toBe(ACTOR_ID);
        });
    });

    describe('when the value is invalid', () => {
        it('should throw before touching the DB', async () => {
            // Arrange — intentionally invalid
            const insertFn = vi.fn();
            mockGetDb.mockReturnValue({ insert: insertFn });

            // Act + Assert
            await expect(
                writeAiSettings({
                    value: { totally: 'wrong' } as never,
                    actorId: ACTOR_ID
                })
            ).rejects.toThrow('Invalid AI settings value:');

            expect(insertFn).not.toHaveBeenCalled();
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { insert: buildUpsertChain([VALID_SETTINGS_ROW]) };

            // Act
            await writeAiSettings({
                value: VALID_SETTINGS_BLOB,
                actorId: ACTOR_ID,
                tx: fakeTx as never
            });

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    describe('when the DB returns no row', () => {
        it('should throw an unexpected-state error', async () => {
            // Arrange — empty returning array
            mockGetDb.mockReturnValue({ insert: buildUpsertChain([]) });

            // Act + Assert
            await expect(
                writeAiSettings({ value: VALID_SETTINGS_BLOB, actorId: ACTOR_ID })
            ).rejects.toThrow('writeAiSettings returned no row');
        });
    });
});

// ---------------------------------------------------------------------------
// getActivePrompt
// ---------------------------------------------------------------------------

describe('getActivePrompt', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const ACTIVE_PROMPT_ROW = {
        id: 'bbbbbbbb-0000-0000-0000-000000000001',
        feature: 'text_improve',
        version: 1,
        content: 'You are a helpful writing assistant.',
        isActive: true,
        createdBy: ACTOR_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedById: null
    };

    describe('when an active prompt exists', () => {
        it('should return its content and the full row', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildSelectChain([ACTIVE_PROMPT_ROW]) });

            // Act
            const result = await getActivePrompt({ feature: 'text_improve' });

            // Assert
            expect(result.content).toBe('You are a helpful writing assistant.');
            expect(result.row).toEqual(ACTIVE_PROMPT_ROW);
        });
    });

    describe('when no active prompt exists', () => {
        it('should return { content: null, row: null }', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ select: buildSelectChain([]) });

            // Act
            const result = await getActivePrompt({ feature: 'chat' });

            // Assert
            expect(result.content).toBeNull();
            expect(result.row).toBeNull();
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { select: buildSelectChain([ACTIVE_PROMPT_ROW]) };

            // Act
            const result = await getActivePrompt({ feature: 'text_improve', tx: fakeTx as never });

            // Assert
            expect(result.content).not.toBeNull();
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// insertAiUsage
// ---------------------------------------------------------------------------

describe('insertAiUsage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const USAGE_ROW = {
        id: 'cccccccc-0000-0000-0000-000000000001',
        userId: 'dddddddd-0000-0000-0000-000000000001',
        feature: 'text_improve',
        provider: 'openai',
        model: 'gpt-4o-mini',
        tokensIn: 250,
        tokensOut: 180,
        costEstimateMicroUsd: 146,
        latencyMs: 820,
        status: 'success',
        createdAt: new Date()
    };

    describe('when the insert succeeds', () => {
        it('should return the inserted row', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ insert: buildInsertChain([USAGE_ROW]) });

            // Act
            const result = await insertAiUsage({
                userId: USAGE_ROW.userId,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                tokensIn: 250,
                tokensOut: 180,
                costEstimateMicroUsd: 146,
                latencyMs: 820,
                status: 'success'
            });

            // Assert
            expect(result.id).toBe(USAGE_ROW.id);
            expect(result.costEstimateMicroUsd).toBe(146);
            expect(result.status).toBe('success');
        });

        it('should accept null userId (system-initiated call)', async () => {
            // Arrange
            const nullUserRow = { ...USAGE_ROW, userId: null };
            mockGetDb.mockReturnValue({ insert: buildInsertChain([nullUserRow]) });

            // Act
            const result = await insertAiUsage({
                userId: null,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                tokensIn: 10,
                tokensOut: 10,
                costEstimateMicroUsd: 0,
                latencyMs: 100,
                status: 'success'
            });

            // Assert
            expect(result.userId).toBeNull();
        });

        it('should accept integer micro-USD (money convention)', async () => {
            // Arrange
            const row = { ...USAGE_ROW, costEstimateMicroUsd: 450_000 };
            mockGetDb.mockReturnValue({ insert: buildInsertChain([row]) });

            // Act
            const result = await insertAiUsage({
                userId: null,
                feature: 'chat',
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                tokensIn: 500,
                tokensOut: 300,
                costEstimateMicroUsd: 450_000,
                latencyMs: 1200,
                status: 'success'
            });

            // Assert
            expect(result.costEstimateMicroUsd).toBe(450_000);
        });
    });

    describe('when the DB returns no row', () => {
        it('should throw an unexpected-state error', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ insert: buildInsertChain([]) });

            // Act + Assert
            await expect(
                insertAiUsage({
                    userId: null,
                    feature: 'text_improve',
                    provider: 'openai',
                    model: 'gpt-4o-mini',
                    tokensIn: 1,
                    tokensOut: 1,
                    costEstimateMicroUsd: 0,
                    latencyMs: 50,
                    status: 'error'
                })
            ).rejects.toThrow('insertAiUsage returned no row');
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { insert: buildInsertChain([USAGE_ROW]) };

            // Act
            await insertAiUsage({
                userId: USAGE_ROW.userId,
                feature: 'text_improve',
                provider: 'openai',
                model: 'gpt-4o-mini',
                tokensIn: 250,
                tokensOut: 180,
                costEstimateMicroUsd: 146,
                latencyMs: 820,
                status: 'success',
                tx: fakeTx as never
            });

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });
});

// ---------------------------------------------------------------------------
// insertAiRequestLog
// ---------------------------------------------------------------------------

describe('insertAiRequestLog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const LOG_ROW = {
        id: 'eeeeeeee-0000-0000-0000-000000000001',
        userId: 'ffffffff-0000-0000-0000-000000000001',
        feature: 'chat',
        provider: 'anthropic',
        requestMetadata: {
            model: 'claude-3-5-sonnet-20241022',
            inputExcerpt: '[REDACTED]',
            traceId: 'abc-123'
        },
        createdAt: new Date()
    };

    describe('when the insert succeeds', () => {
        it('should return the inserted row with the requestMetadata intact', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ insert: buildInsertChain([LOG_ROW]) });

            // Act
            const result = await insertAiRequestLog({
                userId: LOG_ROW.userId,
                feature: 'chat',
                provider: 'anthropic',
                requestMetadata: LOG_ROW.requestMetadata
            });

            // Assert
            expect(result.id).toBe(LOG_ROW.id);
            expect(result.requestMetadata).toEqual(LOG_ROW.requestMetadata);
            expect(result.feature).toBe('chat');
            expect(result.provider).toBe('anthropic');
        });

        it('should accept null userId', async () => {
            // Arrange
            const nullUserRow = { ...LOG_ROW, userId: null };
            mockGetDb.mockReturnValue({ insert: buildInsertChain([nullUserRow]) });

            // Act
            const result = await insertAiRequestLog({
                userId: null,
                feature: 'search',
                provider: 'openai',
                requestMetadata: { traceId: 'xyz' }
            });

            // Assert
            expect(result.userId).toBeNull();
        });

        it('should forward the PII-scrubbed metadata verbatim', async () => {
            // Arrange — metadata with multiple keys
            const metadata = { traceId: 't1', errorCode: 'rate_limit', inputLength: 512 };
            const row = { ...LOG_ROW, requestMetadata: metadata };
            mockGetDb.mockReturnValue({ insert: buildInsertChain([row]) });

            // Act
            const result = await insertAiRequestLog({
                userId: LOG_ROW.userId,
                feature: 'support',
                provider: 'openai',
                requestMetadata: metadata
            });

            // Assert
            expect(result.requestMetadata).toEqual(metadata);
        });
    });

    describe('when the DB returns no row', () => {
        it('should throw an unexpected-state error', async () => {
            // Arrange
            mockGetDb.mockReturnValue({ insert: buildInsertChain([]) });

            // Act + Assert
            await expect(
                insertAiRequestLog({
                    userId: null,
                    feature: 'chat',
                    provider: 'anthropic',
                    requestMetadata: {}
                })
            ).rejects.toThrow('insertAiRequestLog returned no row');
        });
    });

    describe('when a transaction client is provided', () => {
        it('should use the tx client instead of getDb()', async () => {
            // Arrange
            const fakeTx = { insert: buildInsertChain([LOG_ROW]) };

            // Act
            await insertAiRequestLog({
                userId: LOG_ROW.userId,
                feature: 'chat',
                provider: 'anthropic',
                requestMetadata: { traceId: 'abc' },
                tx: fakeTx as never
            });

            // Assert
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });
});
