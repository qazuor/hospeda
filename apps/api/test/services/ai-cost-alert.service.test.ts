/**
 * Tests for createAiCostThresholdAlertHook factory (SPEC-173 T-025).
 *
 * ## Coverage
 *
 * 1. Fires notification for every admin email when no prior record exists (AC-8 de-dup).
 * 2. Second call with the same idempotency key is a complete no-op (de-dup).
 * 3. No-op when HOSPEDA_ADMIN_NOTIFICATION_EMAILS is empty / not configured.
 * 4. sendNotification throw does NOT propagate (best-effort, fire-and-forget).
 * 5. DB query failure allows send through (allow-through on error).
 * 6. Correct idempotency key format for global scope.
 * 7. Correct idempotency key format for feature scope.
 *
 * @module test/services/ai-cost-alert.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state (vi.hoisted ensures these run before vi.mock factories)
// ---------------------------------------------------------------------------

const {
    mockSendNotification,
    mockDbSelect,
    mockDbFrom,
    mockDbWhere,
    mockDbLimit,
    mockGetDb,
    mockEnv
} = vi.hoisted(() => {
    const mockDbLimit = vi.fn().mockResolvedValue([]);
    const mockDbWhere = vi.fn().mockReturnValue({ limit: mockDbLimit });
    const mockDbFrom = vi.fn().mockReturnValue({ where: mockDbWhere });
    const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbFrom });
    const mockGetDb = vi.fn().mockReturnValue({ select: mockDbSelect });

    return {
        mockSendNotification: vi.fn().mockResolvedValue(undefined),
        mockDbLimit,
        mockDbWhere,
        mockDbFrom,
        mockDbSelect,
        mockGetDb,
        mockEnv: {
            HOSPEDA_ADMIN_NOTIFICATION_EMAILS: 'admin@hospeda.com.ar,tech@hospeda.com.ar'
        } as Record<string, string | undefined>
    };
});

// ---------------------------------------------------------------------------
// Mocks — factories can safely reference hoisted vars
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: mockSendNotification
}));

vi.mock('@repo/notifications', () => ({
    NotificationType: {
        AI_COST_THRESHOLD_ALERT: 'ai_cost_threshold_alert'
    }
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    billingNotificationLog: {
        id: 'id',
        type: 'type',
        metadata: 'metadata'
    }
}));

// --- drizzle-orm (and / eq / sql) ---
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        and: vi.fn((...args: unknown[]) => ({ _and: args })),
        eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
        sql: Object.assign(
            vi.fn((_tpl: TemplateStringsArray, ..._vals: unknown[]) => 'sql_expr'),
            { raw: vi.fn() }
        )
    };
});

vi.mock('../../src/utils/env', () => ({
    get env() {
        return mockEnv;
    }
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        error: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Import SUT (after mocks)
// ---------------------------------------------------------------------------

import { createAiCostThresholdAlertHook } from '../../src/services/ai-cost-alert.service';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const GLOBAL_ALERT_INPUT = {
    scope: 'global' as const,
    thresholdPct: 80 as const,
    spentMicroUsd: 160_000_000,
    ceilingMicroUsd: 200_000_000,
    period: '2026-06'
};

const FEATURE_ALERT_INPUT = {
    scope: 'feature' as const,
    feature: 'chat' as const,
    thresholdPct: 50 as const,
    spentMicroUsd: 50_000_000,
    ceilingMicroUsd: 100_000_000,
    period: '2026-06'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ThresholdAlertInput-compatible shape used in tests.
// We use a type alias here so tests don't need to import from @repo/ai-core,
// keeping the test file self-contained (the mock for @repo/ai-core covers the
// runtime module; the type is only used at compile time).
type AlertInput = Parameters<ReturnType<typeof createAiCostThresholdAlertHook>>[0];

/**
 * Calls the hook and waits a tick for the internal async work to complete.
 */
async function callAndFlush(
    hook: ReturnType<typeof createAiCostThresholdAlertHook>,
    input: AlertInput
): Promise<void> {
    hook(input);
    // Wait one microtask-tick so the enqueued `void handleAlert(input)` resolves.
    await Promise.resolve();
    // A second tick ensures the internal awaits inside handleAlert also resolve.
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createAiCostThresholdAlertHook', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset: default DB — no prior record (allow send)
        mockDbLimit.mockResolvedValue([]);
        mockDbWhere.mockReturnValue({ limit: mockDbLimit });
        mockDbFrom.mockReturnValue({ where: mockDbWhere });
        mockDbSelect.mockReturnValue({ from: mockDbFrom });
        mockGetDb.mockReturnValue({ select: mockDbSelect });

        // Reset env
        mockEnv.HOSPEDA_ADMIN_NOTIFICATION_EMAILS = 'admin@hospeda.com.ar,tech@hospeda.com.ar';
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // 1. Sends to all admin emails when no prior record
    // -----------------------------------------------------------------------

    describe('when no prior alert exists for this period', () => {
        it('should call sendNotification once per admin email', async () => {
            // Arrange
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);

            // Assert — two admin emails → two sendNotification calls
            expect(mockSendNotification).toHaveBeenCalledTimes(2);
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'ai_cost_threshold_alert',
                    recipientEmail: 'admin@hospeda.com.ar',
                    scope: 'global',
                    thresholdPct: 80,
                    period: '2026-06'
                })
            );
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'ai_cost_threshold_alert',
                    recipientEmail: 'tech@hospeda.com.ar',
                    scope: 'global',
                    thresholdPct: 80,
                    period: '2026-06'
                })
            );
        });

        it('should include the idempotency key in the payload', async () => {
            // Arrange
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);

            // Assert
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    idempotencyKey: 'ai_cost_alert:global:global:80:2026-06'
                })
            );
        });

        it('should include feature in the payload for feature scope', async () => {
            // Arrange
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, FEATURE_ALERT_INPUT);

            // Assert
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    scope: 'feature',
                    feature: 'chat',
                    thresholdPct: 50,
                    idempotencyKey: 'ai_cost_alert:feature:chat:50:2026-06'
                })
            );
        });
    });

    // -----------------------------------------------------------------------
    // 2. De-dup: second call with same key → no-op
    // -----------------------------------------------------------------------

    describe('when a prior alert already exists (de-dup)', () => {
        it('should NOT call sendNotification on the second call for the same key', async () => {
            // Arrange — simulate existing record in DB
            mockDbLimit.mockResolvedValue([{ id: 'existing-record-uuid' }]);
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);

            // Assert
            expect(mockSendNotification).not.toHaveBeenCalled();
        });

        it('should send on first call and skip on second call within same period', async () => {
            // Arrange — first call: no record; second call: record found
            mockDbLimit
                .mockResolvedValueOnce([]) // first call: no prior record
                .mockResolvedValueOnce([{ id: 'existing-record-uuid' }]); // second call: already sent

            const hook = createAiCostThresholdAlertHook();

            // Act — first call
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);
            const firstCallCount = mockSendNotification.mock.calls.length;

            // Act — second call (same input)
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);
            const secondCallCount = mockSendNotification.mock.calls.length;

            // Assert — only first call triggered sends
            expect(firstCallCount).toBeGreaterThan(0);
            expect(secondCallCount).toBe(firstCallCount); // no new calls on second
        });
    });

    // -----------------------------------------------------------------------
    // 3. No-op when no admin emails configured
    // -----------------------------------------------------------------------

    describe('when HOSPEDA_ADMIN_NOTIFICATION_EMAILS is empty', () => {
        it('should NOT call sendNotification when env is empty string', async () => {
            // Arrange
            mockEnv.HOSPEDA_ADMIN_NOTIFICATION_EMAILS = '';
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);

            // Assert
            expect(mockSendNotification).not.toHaveBeenCalled();
        });

        it('should NOT call sendNotification when env is undefined', async () => {
            // Arrange
            mockEnv.HOSPEDA_ADMIN_NOTIFICATION_EMAILS = undefined;
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);

            // Assert
            expect(mockSendNotification).not.toHaveBeenCalled();
        });

        it('should skip empty entries in comma-separated list', async () => {
            // Arrange — list with only whitespace/empty after split+trim
            mockEnv.HOSPEDA_ADMIN_NOTIFICATION_EMAILS = '  ,  ,  ';
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);

            // Assert
            expect(mockSendNotification).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // 4. sendNotification throw does NOT propagate
    // -----------------------------------------------------------------------

    describe('when sendNotification throws', () => {
        it('should not throw from the hook', async () => {
            // Arrange
            mockSendNotification.mockRejectedValueOnce(new Error('transport error'));
            const hook = createAiCostThresholdAlertHook();

            // Act + Assert — hook itself should not throw
            expect(() => hook(GLOBAL_ALERT_INPUT)).not.toThrow();
            // Flush async — should also not throw
            await expect(callAndFlush(hook, GLOBAL_ALERT_INPUT)).resolves.toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------
    // 5. DB query failure allows send through
    // -----------------------------------------------------------------------

    describe('when the DB query for de-dup fails', () => {
        it('should still call sendNotification (allow-through on error)', async () => {
            // Arrange — simulate DB failure
            mockDbLimit.mockRejectedValueOnce(new Error('DB connection error'));
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, GLOBAL_ALERT_INPUT);

            // Assert — send proceeds despite DB failure
            expect(mockSendNotification).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // 6. Idempotency key format — global scope
    // -----------------------------------------------------------------------

    describe('idempotency key format', () => {
        it('should use format ai_cost_alert:global:global:pct:period for global scope', async () => {
            // Arrange
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, {
                scope: 'global',
                thresholdPct: 100,
                spentMicroUsd: 200_000_000,
                ceilingMicroUsd: 200_000_000,
                period: '2026-01'
            });

            // Assert
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    idempotencyKey: 'ai_cost_alert:global:global:100:2026-01'
                })
            );
        });

        it('should use format ai_cost_alert:feature:<feature>:pct:period for feature scope', async () => {
            // Arrange
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, {
                scope: 'feature',
                feature: 'text_improve' as const,
                thresholdPct: 50,
                spentMicroUsd: 25_000_000,
                ceilingMicroUsd: 50_000_000,
                period: '2026-06'
            });

            // Assert
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    idempotencyKey: 'ai_cost_alert:feature:text_improve:50:2026-06'
                })
            );
        });

        it('should use "global" as the feature segment for global scope', async () => {
            // Arrange — for global scope, the key should contain 'global' as the feature segment
            const hook = createAiCostThresholdAlertHook();

            // Act
            await callAndFlush(hook, {
                scope: 'global',
                thresholdPct: 80,
                spentMicroUsd: 80_000_000,
                ceilingMicroUsd: 100_000_000,
                period: '2026-06'
            });

            // Assert — key uses 'global' for the feature segment
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    idempotencyKey: 'ai_cost_alert:global:global:80:2026-06'
                })
            );
        });
    });
});
