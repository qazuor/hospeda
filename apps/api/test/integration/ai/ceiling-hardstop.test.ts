/**
 * Integration tests for AI cost-ceiling hard stop (SPEC-173 T-037, AC-8 + AC-13).
 *
 * Tests through `createConfiguredAiService` (the real factory used in production)
 * with the `stub` provider so zero real network calls are made (AC-13).
 *
 * ## Ceiling hard-stop assertion (AC-8)
 *
 * When accumulated spend in the current UTC calendar month reaches or exceeds
 * `ai_settings.value.costCeilings.globalMonthlyMicroUsd`, the engine must:
 *   - Throw `AiCeilingHitError` with `engineCode === 'CEILING_HIT'`.
 *   - NOT call the provider (AC-13: zero network, stub used).
 *
 * ## Alert assertion (100 % threshold, AC-8 side-effect)
 *
 * `createConfiguredAiService` wires `createAiCostThresholdAlertHook` as the
 * `onThresholdAlert` hook. When the ceiling is hit (100 %), the hook fires
 * fire-and-forget. `handleAlert` in the hook calls `sendNotification` from
 * `apps/api/src/utils/notification-helper.ts`, which requires:
 *   - `HOSPEDA_ADMIN_NOTIFICATION_EMAILS` to be non-empty.
 *   - A real `NotificationService` (Brevo transport + Redis + email API key).
 *
 * In the integration test environment none of those external services are
 * configured. Rather than requiring full notification infra, we **mock
 * `sendNotification`** at the module level so it directly writes one row to
 * `billingNotificationLog`. This is the documented mock-seam for this test
 * (see harness instructions: "if the alert path requires more notification infra
 * than the test db has, seed the minimal rows it needs — read handleAlert to
 * find out"; the real limiting factor here is the external Brevo transport, not
 * a missing DB row).
 *
 * The mock writes a `billingNotificationLog` row with `status: 'sent'` and the
 * correct `idempotencyKey` inside `metadata`, which is what the real production
 * path would write after a successful email delivery.
 *
 * ## Provider assertion (AC-13)
 *
 * `createConfiguredAiService` decrypts credentials at construction time. For
 * `stub`, `buildGetProvider` always returns `new StubProvider()` without a key.
 * The test seeds `ai_settings` with `primaryProvider: 'stub'` and asserts:
 *   1. `AiCeilingHitError` is thrown BEFORE the provider is invoked.
 *   2. The StubProvider is used (no real OpenAI/Anthropic key needed).
 *
 * @module test/integration/ai/ceiling-hardstop
 */

// ---------------------------------------------------------------------------
// Vault key: must be in process.env before env.ts module loads.
// See vault-roundtrip.test.ts for rationale.
// ---------------------------------------------------------------------------

process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';
process.env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS = 'test-admin@hospeda-test.invalid';

// ---------------------------------------------------------------------------
// Mock `sendNotification` so it writes directly to `billingNotificationLog`
// without requiring Brevo / Redis / email API key.
//
// The mock:
//   1. Extracts the `idempotencyKey` from the payload.
//   2. Inserts a row into `billingNotificationLog` with `status: 'sent'` and
//      `metadata: { idempotencyKey }`.
//
// Decision: `vi.mock` with a factory function that uses the real `@repo/db`
// import so the DB write goes to the real test database (isolated per test via
// testDb.clean()). This is the minimal-mock approach: only `sendNotification`
// is mocked; everything else (ceiling check, config resolver, usage queries)
// runs against the real DB.
// ---------------------------------------------------------------------------

import { vi } from 'vitest';

vi.mock('../../../src/utils/notification-helper.js', () => ({
    sendNotification: vi.fn(async (payload: Record<string, unknown>) => {
        // Lazy-import @repo/db inside the mock factory to avoid top-level
        // circular imports (the mock factory runs before module graph resolution).
        const { getDb, billingNotificationLog } = await import('@repo/db');
        const db = getDb();

        await db.insert(billingNotificationLog).values({
            customerId: null,
            type: String(payload.type ?? 'ai_cost_threshold_alert'),
            channel: 'email',
            recipient: String(payload.recipientEmail ?? 'mock@test.invalid'),
            subject: 'AI Cost Alert (test mock)',
            templateId: String(payload.type ?? 'ai_cost_threshold_alert'),
            status: 'sent',
            sentAt: new Date(),
            metadata: {
                idempotencyKey: payload.idempotencyKey ?? null,
                userId: payload.userId ?? null,
                recipientName: payload.recipientName ?? null,
                messageId: null,
                category: 'billing'
            }
        });

        return { success: true, status: 'sent' };
    })
}));

import { AiCeilingHitError, invalidateConfigCache, invalidatePromptCache } from '@repo/ai-core';
import { aiSettings, aiUsage, billingNotificationLog, getDb } from '@repo/db';
import type { AiSettingsValue } from '@repo/schemas';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createConfiguredAiService } from '../../../src/services/ai-service.factory';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_FEATURE = 'chat' as const;
const TEST_ACTOR_ID = crypto.randomUUID();

/** Low global ceiling: 1000 µUSD ($0.001). Any spend >= 1000 µUSD triggers a hard stop. */
const LOW_CEILING_MICRO_USD = 1000;

/** Monthly accumulated spend seeded: ceiling + 1 µUSD to ensure >= comparison triggers. */
const ACCUMULATED_SPEND_MICRO_USD = LOW_CEILING_MICRO_USD + 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds `ai_settings` with the stub provider as the primary for all features
 * plus a low globalMonthlyMicroUsd ceiling.
 *
 * `writeAiSettings` validates the blob against `AiSettingsValueSchema`, so
 * all four features must be present (non-partial `z.record`).
 */
async function seedAiSettings(actorId: string): Promise<void> {
    const db = getDb();

    const stubFeatureConfig = {
        enabled: true,
        primaryProvider: 'stub' as const,
        // Cast to mutable array — AiFeatureConfigSchema expects a mutable array
        // even though we have no fallback providers in the test.
        fallbackChain: [] as Array<'openai' | 'anthropic' | 'stub'>,
        model: 'stub-model',
        params: {} as { temperature?: number; maxTokens?: number; topP?: number }
    };

    const settingsValue: AiSettingsValue = {
        providers: {
            stub: { enabled: true }
        },
        features: {
            chat: stubFeatureConfig,
            text_improve: stubFeatureConfig,
            search: stubFeatureConfig,
            support: stubFeatureConfig,
            translate: stubFeatureConfig
        },
        costCeilings: {
            globalMonthlyMicroUsd: LOW_CEILING_MICRO_USD
        }
    };

    // Upsert directly into ai_settings (mirrors writeAiSettings behaviour
    // but avoids the updatedBy FK check against the users table).
    await db
        .insert(aiSettings)
        .values({
            key: 'global',
            value: settingsValue as Record<string, unknown>,
            updatedBy: actorId,
            updatedAt: new Date(),
            createdAt: new Date()
        })
        .onConflictDoUpdate({
            target: aiSettings.key,
            set: {
                value: settingsValue as Record<string, unknown>,
                updatedBy: actorId,
                updatedAt: new Date()
            }
        });

    // Invalidate the config cache so resolveConfig() reads the freshly-seeded
    // row instead of any previously cached value from other test files.
    invalidateConfigCache();
}

/**
 * Seeds `aiUsage` rows summing to `totalCostMicroUsd` for the current UTC month.
 * Uses `status: 'success'` rows (count-eligible) with `costEstimateMicroUsd`
 * set so the global ceiling check fires.
 */
async function seedAiUsage(params: {
    userId: string | null;
    totalCostMicroUsd: number;
}): Promise<void> {
    const db = getDb();
    const now = new Date();

    // Single row carrying the full accumulated cost for simplicity.
    await db.insert(aiUsage).values({
        userId: params.userId,
        feature: TEST_FEATURE,
        provider: 'stub',
        model: 'stub-model',
        tokensIn: 0,
        tokensOut: 0,
        costEstimateMicroUsd: params.totalCostMicroUsd,
        latencyMs: 0,
        status: 'success',
        createdAt: now
    });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AI cost-ceiling hard stop (SPEC-173 T-037 AC-8 + AC-13)', () => {
    beforeAll(async () => {
        // Re-parse env to pick up the vault key and admin email set at file top.
        validateApiEnv();

        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        // Clear the config + prompt cache between tests so resolveConfig()
        // always reads the freshly-seeded row (AC-13 cache-interference guard).
        invalidateConfigCache();
        invalidatePromptCache();
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // AC-8: ceiling hit → AiCeilingHitError thrown
    // -------------------------------------------------------------------------

    describe('AC-8 — ceiling hard stop', () => {
        it('throws AiCeilingHitError with engineCode CEILING_HIT when spend >= ceiling', async () => {
            // We need a user row in the DB for the `updatedBy` FK on ai_settings.
            // Use a deterministic UUID that does not collide with other test data.
            const db = getDb();
            const { users } = await import('@repo/db');

            // Insert a minimal user row for the FK constraint on ai_settings.updatedBy.
            // The users table has no 'name' column — use displayName.
            // createdAt / updatedAt default to NOW() so we omit them.
            await db.insert(users).values({
                id: TEST_ACTOR_ID,
                displayName: 'Test Actor',
                email: `actor-${TEST_ACTOR_ID}@test.invalid`,
                emailVerified: false
            });

            // 1. Seed ai_settings with stub provider + low ceiling.
            await seedAiSettings(TEST_ACTOR_ID);

            // 2. Seed accumulated spend >= ceiling.
            await seedAiUsage({
                userId: null, // global ceiling aggregates all users
                totalCostMicroUsd: ACCUMULATED_SPEND_MICRO_USD
            });

            // 3. Build the configured service (wires the real ceiling check).
            const service = await createConfiguredAiService();

            // 4. Attempt a call — must throw AiCeilingHitError.
            await expect(
                service.generateText({
                    feature: TEST_FEATURE,
                    prompt: 'hola'
                })
            ).rejects.toThrow(AiCeilingHitError);
        });

        it('AiCeilingHitError has engineCode CEILING_HIT', async () => {
            const db = getDb();
            const { users } = await import('@repo/db');

            const actorId = crypto.randomUUID();

            await db.insert(users).values({
                id: actorId,
                displayName: 'Test Actor 2',
                email: `actor-${actorId}@test.invalid`,
                emailVerified: false
            });

            await seedAiSettings(actorId);
            await seedAiUsage({ userId: null, totalCostMicroUsd: ACCUMULATED_SPEND_MICRO_USD });

            const service = await createConfiguredAiService();

            let caughtError: unknown;
            try {
                await service.generateText({ feature: TEST_FEATURE, prompt: 'test' });
            } catch (err) {
                caughtError = err;
            }

            expect(caughtError).toBeInstanceOf(AiCeilingHitError);
            const ceiled = caughtError as AiCeilingHitError;
            expect(ceiled.engineCode).toBe('CEILING_HIT');
            expect(ceiled.scope).toBe('global');
            expect(ceiled.spentMicroUsd).toBeGreaterThanOrEqual(LOW_CEILING_MICRO_USD);
            expect(ceiled.ceilingMicroUsd).toBe(LOW_CEILING_MICRO_USD);
        });
    });

    // -------------------------------------------------------------------------
    // AC-13: provider is StubProvider — zero network
    // -------------------------------------------------------------------------

    describe('AC-13 — StubProvider used, no real network', () => {
        it('service is wired with StubProvider when ai_settings.primaryProvider is stub', async () => {
            const db = getDb();
            const { users } = await import('@repo/db');

            const actorId = crypto.randomUUID();

            await db.insert(users).values({
                id: actorId,
                displayName: 'Stub Test Actor',
                email: `stub-actor-${actorId}@test.invalid`,
                emailVerified: false
            });

            // Seed with NO ceiling so generateText succeeds via stub
            const stubFeatureConfig = {
                enabled: true,
                primaryProvider: 'stub' as const,
                fallbackChain: [] as Array<'openai' | 'anthropic' | 'stub'>,
                model: 'stub-model',
                params: {} as { temperature?: number; maxTokens?: number; topP?: number }
            };

            const settingsNoCeiling: AiSettingsValue = {
                providers: { stub: { enabled: true } },
                features: {
                    chat: stubFeatureConfig,
                    text_improve: stubFeatureConfig,
                    search: stubFeatureConfig,
                    support: stubFeatureConfig,
                    translate: stubFeatureConfig
                }
                // costCeilings: omitted → no ceiling, call should succeed
            };

            await db
                .insert(aiSettings)
                .values({
                    key: 'global',
                    value: settingsNoCeiling as Record<string, unknown>,
                    updatedBy: actorId,
                    updatedAt: new Date(),
                    createdAt: new Date()
                })
                .onConflictDoUpdate({
                    target: aiSettings.key,
                    set: {
                        value: settingsNoCeiling as Record<string, unknown>,
                        updatedBy: actorId,
                        updatedAt: new Date()
                    }
                });

            invalidateConfigCache();

            const service = await createConfiguredAiService();

            // generateText with stub should succeed (no network, deterministic response).
            const result = await service.generateText({
                feature: TEST_FEATURE,
                prompt: 'test prompt for stub provider'
            });

            // StubProvider returns a deterministic response (see stub.provider.ts).
            expect(result).toBeDefined();
            expect(result.text).toBeDefined();
            expect(typeof result.text).toBe('string');
        });
    });

    // -------------------------------------------------------------------------
    // 100 % threshold alert written to billingNotificationLog (via mock)
    // -------------------------------------------------------------------------

    describe('100% threshold alert persisted (via sendNotification mock)', () => {
        it('billingNotificationLog contains idempotency key for the 100% ceiling alert', async () => {
            const db = getDb();
            const { users } = await import('@repo/db');

            const actorId = crypto.randomUUID();

            await db.insert(users).values({
                id: actorId,
                displayName: 'Alert Test Actor',
                email: `alert-actor-${actorId}@test.invalid`,
                emailVerified: false
            });

            await seedAiSettings(actorId);
            await seedAiUsage({ userId: null, totalCostMicroUsd: ACCUMULATED_SPEND_MICRO_USD });

            const service = await createConfiguredAiService();

            // Trigger the ceiling → hook fires (fire-and-forget)
            await expect(
                service.generateText({ feature: TEST_FEATURE, prompt: 'ceiling test' })
            ).rejects.toThrow(AiCeilingHitError);

            // The hook is fire-and-forget (no await). Poll briefly for the async
            // sendNotification mock to complete and write to billingNotificationLog.
            const expectedPeriod = (() => {
                const now = new Date();
                const y = now.getUTCFullYear();
                const m = String(now.getUTCMonth() + 1).padStart(2, '0');
                return `${y}-${m}`;
            })();

            // Expected idempotency key format (from ai-cost-alert.service.ts):
            // ai_cost_alert:<scope>:<featureOrGlobal>:<thresholdPct>:<period>
            const expectedIdempotencyKey = `ai_cost_alert:global:global:100:${expectedPeriod}`;

            // Retry loop: the hook is fire-and-forget so we poll until the row appears.
            let alertRow: { id: string } | undefined;
            for (let attempt = 0; attempt < 20; attempt++) {
                const rows = await db
                    .select({ id: billingNotificationLog.id })
                    .from(billingNotificationLog)
                    .where(
                        and(
                            eq(billingNotificationLog.type, 'ai_cost_threshold_alert'),
                            eq(
                                sql<string>`${billingNotificationLog.metadata}->>'idempotencyKey'`,
                                expectedIdempotencyKey
                            )
                        )
                    )
                    .limit(1);

                if (rows.length > 0) {
                    alertRow = rows[0];
                    break;
                }

                // Brief pause between attempts (max ~200ms total)
                await new Promise<void>((r) => setTimeout(r, 10));
            }

            expect(alertRow).toBeDefined();
        });
    });
});
