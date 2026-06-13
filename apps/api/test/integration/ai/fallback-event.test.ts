/**
 * Integration tests for AI provider fallback event recording (SPEC-173 T-038, AC-2).
 *
 * ## AC-2 assertion: fallback on simulated provider failure records the event
 *
 * When the primary provider throws a retryable error, the engine:
 *   1. Exhausts its retry budget on the primary provider.
 *   2. Emits a `'fallback'` event via the injected `recordEvent` callback.
 *   3. Falls back to the next provider in the chain (StubProvider).
 *   4. Returns the successful result from the fallback provider.
 *
 * ## What this test asserts (event)
 *
 * The fallback event is asserted at the `recordEvent` callback level — the
 * injected callback captures all events and we verify that at least one event
 * of type `'fallback'` was recorded. This is the correct observable boundary:
 * `recordEvent` is the engine's observability contract (AC-2 states "records
 * the event in ai_usage" — see the boundary note below).
 *
 * ## Boundary note: ai_usage rows
 *
 * The task spec mentions asserting a row in `ai_usage` with `status: 'fallback'`.
 * After examining the codebase we found:
 *
 * - `recordAiUsage` (packages/ai-core/src/usage/usage-recorder.ts) exists and
 *   can write rows with `status: 'fallback'`.
 * - `createAiObservabilityRecordEvent` (apps/api/src/services/ai-observability.service.ts)
 *   is the currently-wired `recordEvent` sink in `createConfiguredAiService` (T-035).
 *   It fans out to Sentry/PostHog/logger but does NOT write to `ai_usage`.
 * - The per-call metering (`recordAiUsage`) is to be wired at the route layer by
 *   children specs (T-016 metering is call-site based). No route currently calls
 *   `recordAiUsage` with `status: 'fallback'` — there are no rows to assert.
 *
 * Therefore: this test asserts the `'fallback'` event via the injected `recordEvent`
 * callback (engine-level contract) and does NOT assert `ai_usage` rows, because no
 * call site currently writes them on fallback. This is documented here so that when
 * T-016 metering is wired, a follow-up test can add the row-level assertion.
 *
 * ## Provider setup
 *
 * - Primary: `FailingProvider` — always throws a retryable HTTP 503-style error.
 *   The `isRetryableError` classifier in the engine checks for the `retryable`
 *   property on the thrown error. We set `(err as { retryable?: boolean }).retryable
 *   = true` so the engine retries, exhausts the budget, and then falls back.
 * - Fallback: `StubProvider` — deterministic, always succeeds.
 *
 * ## DB
 *
 * `testDb.setup()` / `testDb.clean()` / `testDb.teardown()` for full isolation.
 * `ai_settings` is seeded with the primary set to a custom failing provider ID
 * that maps to `FailingProvider` in the injected `getProvider`. The fallback
 * chain maps to `'stub'` which maps to `StubProvider`.
 *
 * NOTE: `AiProviderIdSchema` in `@repo/schemas` restricts valid IDs to
 * `openai | anthropic | stub`. Using `createAiService` directly with a custom
 * `getProvider` that maps arbitrary strings bypasses this validation at the
 * config level. Because we cannot register a new schema value, and because the
 * engine validates provider IDs only at the `getProvider` call site, we use
 * `'stub'` for BOTH the primary AND the fallback in the seeded settings — the
 * `getProvider` factory then dispatches based on a counter to return
 * `FailingProvider` on the first call and `StubProvider` on subsequent calls.
 * This is a test-internal shim; the important observable is the `recordEvent`
 * stream, not the provider ID stored in the DB.
 *
 * @module test/integration/ai/fallback-event
 */

// ---------------------------------------------------------------------------
// Vault key: must be in process.env before env.ts module loads.
// ---------------------------------------------------------------------------

process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';

import {
    StubProvider,
    createAiService,
    invalidateConfigCache,
    invalidatePromptCache
} from '@repo/ai-core';
import type { AiEngineEvent } from '@repo/ai-core';
import type { AiProvider } from '@repo/ai-core';
import { aiSettings, getDb } from '@repo/db';
import type { AiSettingsValue } from '@repo/schemas';
import type { AiProviderId } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_FEATURE = 'chat' as const;
const TEST_ACTOR_ID = crypto.randomUUID();

// ---------------------------------------------------------------------------
// FailingProvider: always throws a retryable error
// ---------------------------------------------------------------------------

/**
 * A provider that always rejects with a retryable error, simulating a
 * transient HTTP 503 / upstream timeout.
 *
 * The engine's `isRetryableError` classifier checks for the `retryable`
 * property (see `packages/ai-core/src/engine/retry.ts`). Setting it to `true`
 * makes the engine retry this provider up to `MAX_ATTEMPTS_PER_PROVIDER` times
 * before emitting a `'fallback'` event and moving on to the next provider.
 */
class FailingProvider implements AiProvider {
    readonly id: AiProviderId = 'stub';

    private makeRetryableError(): Error {
        const err = new Error('Simulated retryable provider failure (HTTP 503)');
        // Mark as retryable so the engine retries then falls back.
        (err as Error & { retryable?: boolean }).retryable = true;
        return err;
    }

    generateText() {
        return Promise.reject(this.makeRetryableError());
    }

    streamText() {
        return Promise.reject(this.makeRetryableError());
    }

    generateObject() {
        return Promise.reject(this.makeRetryableError());
    }

    extractIntent() {
        return Promise.reject(this.makeRetryableError());
    }

    moderate() {
        return Promise.reject(this.makeRetryableError());
    }

    embed() {
        return Promise.reject(this.makeRetryableError());
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds a minimal user row for FK constraints on `ai_settings.updatedBy`.
 */
async function seedActor(actorId: string): Promise<void> {
    const db = getDb();
    const { users } = await import('@repo/db');

    await db
        .insert(users)
        .values({
            id: actorId,
            displayName: 'Fallback Test Actor',
            email: `fallback-actor-${actorId}@test.invalid`,
            emailVerified: false
        })
        .onConflictDoNothing();
}

/**
 * Seeds `ai_settings` with `stub` as both primary and fallback.
 *
 * The `getProvider` factory in the test maps the FIRST call to `FailingProvider`
 * and subsequent calls to `StubProvider`. Because the engine calls `getProvider`
 * once per provider slot (primary, then fallback), this produces:
 *   - Primary slot → FailingProvider (first call to `getProvider('stub')`).
 *   - Fallback slot → StubProvider  (second call to `getProvider('stub')`).
 *
 * Both slots use `'stub'` in the DB — the test-internal dispatch counter
 * distinguishes them without needing to register a new AiProviderId.
 */
async function seedAiSettingsWithFallback(actorId: string): Promise<void> {
    const db = getDb();

    const featureConfig = {
        enabled: true,
        primaryProvider: 'stub' as const,
        fallbackChain: ['stub'] as Array<'openai' | 'anthropic' | 'stub'>,
        model: 'stub-model',
        params: {} as { temperature?: number; maxTokens?: number; topP?: number }
    };

    const settingsValue: AiSettingsValue = {
        providers: { stub: { enabled: true } },
        features: {
            chat: featureConfig,
            text_improve: featureConfig,
            search: featureConfig,
            support: featureConfig,
            translate: featureConfig
        }
    };

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

    invalidateConfigCache();
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('AI provider fallback event (SPEC-173 T-038 AC-2)', () => {
    beforeAll(async () => {
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    afterEach(async () => {
        invalidateConfigCache();
        invalidatePromptCache();
        await testDb.clean();
    });

    // -------------------------------------------------------------------------
    // AC-2: fallback fires the 'fallback' event via recordEvent
    // -------------------------------------------------------------------------

    describe('AC-2 — fallback event recorded when primary provider fails', () => {
        it('emits a fallback event and returns the stub result when primary fails', async () => {
            await seedActor(TEST_ACTOR_ID);
            await seedAiSettingsWithFallback(TEST_ACTOR_ID);

            // Capture all engine events.
            const capturedEvents: AiEngineEvent[] = [];

            // Track routing calls per provider slot separately.
            // The engine calls `getProvider` in two contexts:
            //   1. Moderation (for 'openai' by default) — NOT a routing slot call.
            //   2. Feature routing — primary slot first, then fallback slot.
            // We use a per-id routing counter scoped only to 'stub' (the id both
            // FailingProvider and StubProvider report). Moderation calls use 'openai'
            // and return a StubProvider there too (no real key needed for moderations
            // with the stub — it always returns flagged:false).
            let stubCallCount = 0;

            const service = createAiService({
                getProvider: (id: AiProviderId): AiProvider => {
                    // Moderation calls use 'openai' (default moderationProviderId).
                    // Return StubProvider for those too (stub.moderate always clean).
                    if (id !== 'stub') {
                        return new StubProvider();
                    }

                    // Routing calls: first 'stub' call = primary (FailingProvider),
                    // second 'stub' call = fallback (StubProvider).
                    stubCallCount++;
                    if (stubCallCount === 1) {
                        return new FailingProvider();
                    }
                    return new StubProvider();
                },
                recordEvent: (event: AiEngineEvent): void => {
                    capturedEvents.push(event);
                },
                defaultLocale: 'es'
            });

            // The call should SUCCEED via the fallback provider.
            const result = await service.generateText({
                feature: TEST_FEATURE,
                prompt: 'test fallback'
            });

            // Stub returns a deterministic echo via the fallback.
            expect(result.text).toBeDefined();
            expect(result.provider).toBe('stub');

            // At least one 'fallback' event must have been recorded.
            const fallbackEvents = capturedEvents.filter((e) => e.type === 'fallback');
            expect(fallbackEvents.length).toBeGreaterThanOrEqual(1);

            const fallbackEvent = fallbackEvents[0];
            if (!fallbackEvent || fallbackEvent.type !== 'fallback') {
                throw new Error('Expected a fallback event');
            }

            // The fallback event must name the from/to providers and the feature.
            expect(fallbackEvent.fromProvider).toBe('stub'); // FailingProvider has id 'stub'
            expect(fallbackEvent.toProvider).toBe('stub'); // StubProvider also id 'stub'
            expect(fallbackEvent.feature).toBe(TEST_FEATURE);
            expect(fallbackEvent.error).toBeInstanceOf(Error);
        });

        it('final result comes from the fallback (stub) provider, not the failing primary', async () => {
            await seedActor(TEST_ACTOR_ID);
            await seedAiSettingsWithFallback(TEST_ACTOR_ID);

            let stubCallCount = 0;

            const service = createAiService({
                getProvider: (id: AiProviderId): AiProvider => {
                    if (id !== 'stub') {
                        return new StubProvider();
                    }
                    stubCallCount++;
                    if (stubCallCount === 1) {
                        return new FailingProvider();
                    }
                    return new StubProvider();
                },
                defaultLocale: 'es'
            });

            const result = await service.generateText({
                feature: TEST_FEATURE,
                prompt: 'fallback result check'
            });

            // StubProvider echo: [stub:chat] fallback result check
            expect(result.text).toContain('[stub:chat]');
            expect(result.provider).toBe('stub');
            expect(result.finishReason).toBe('stop');
        });

        it('records success event AFTER the fallback succeeds', async () => {
            await seedActor(TEST_ACTOR_ID);
            await seedAiSettingsWithFallback(TEST_ACTOR_ID);

            const capturedEvents: AiEngineEvent[] = [];
            let stubCallCount = 0;

            const service = createAiService({
                getProvider: (id: AiProviderId): AiProvider => {
                    if (id !== 'stub') {
                        return new StubProvider();
                    }
                    stubCallCount++;
                    if (stubCallCount === 1) {
                        return new FailingProvider();
                    }
                    return new StubProvider();
                },
                recordEvent: (event: AiEngineEvent): void => {
                    capturedEvents.push(event);
                },
                defaultLocale: 'es'
            });

            await service.generateText({
                feature: TEST_FEATURE,
                prompt: 'events order check'
            });

            const eventTypes = capturedEvents.map((e) => e.type);

            // Expect: fallback → success (the engine emits both).
            expect(eventTypes).toContain('fallback');
            expect(eventTypes).toContain('success');

            // fallback must appear before success in the event stream.
            const fallbackIdx = eventTypes.indexOf('fallback');
            const successIdx = eventTypes.indexOf('success');
            expect(fallbackIdx).toBeLessThan(successIdx);
        });
    });

    // -------------------------------------------------------------------------
    // ai_usage row boundary: NOT asserted (metering not wired yet)
    // -------------------------------------------------------------------------

    describe('ai_usage row boundary (documented assertion boundary)', () => {
        it('does NOT write ai_usage rows on fallback because metering is not yet wired', async () => {
            // This test documents the boundary: no route currently calls
            // `recordAiUsage({ status: 'fallback' })` because the per-call
            // metering (T-016) has not been wired at the route layer yet.
            //
            // When T-016 metering is wired, this test should be updated to:
            //   - Assert a row in `ai_usage` with `status: 'fallback'`.
            //   - Assert `provider` matches the failing provider's id.
            //
            // For now we assert NO fallback row exists (confirming the boundary).
            await seedActor(TEST_ACTOR_ID);
            await seedAiSettingsWithFallback(TEST_ACTOR_ID);

            let stubCallCount2 = 0;
            const service = createAiService({
                getProvider: (id: AiProviderId): AiProvider => {
                    if (id !== 'stub') {
                        return new StubProvider();
                    }
                    stubCallCount2++;
                    if (stubCallCount2 === 1) {
                        return new FailingProvider();
                    }
                    return new StubProvider();
                },
                defaultLocale: 'es'
            });

            // The call should succeed via fallback.
            await service.generateText({
                feature: TEST_FEATURE,
                prompt: 'boundary check'
            });

            // Confirm: no ai_usage rows were written (metering not wired yet).
            const { aiUsage } = await import('@repo/db');
            const { eq } = await import('drizzle-orm');
            const db = getDb();

            const rows = await db.select().from(aiUsage).where(eq(aiUsage.feature, TEST_FEATURE));

            // Metering is NOT wired into createAiService at the library level —
            // it lives at the route layer. No rows are expected.
            expect(rows.length).toBe(0);

            // NOTE: when T-016 per-call metering is wired at the route layer,
            // this assertion should change to:
            //   expect(rows.some(r => r.status === 'fallback')).toBe(true);
        });
    });
});
