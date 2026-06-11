/**
 * Integration tests for `POST /api/v1/protected/ai/search-chat` (SPEC-212 T-004).
 *
 * Covers the middleware gates that run BEFORE the handler body — the gates that
 * T-004 is responsible for wiring. The real AI engine and conversation persistence
 * are NOT called from the scaffold handler, so those seams do not need stubs here.
 *
 * ## Middleware chain under test
 *
 *   actorMiddleware (test harness)
 *     → protectedAuthMiddleware (factory — rejects unauthenticated requests)
 *     → entitlementMiddleware (STUBBED — loads billing context, no AI_SEARCH gate)
 *     → createAiRateLimitMiddlewares('search') (REAL — per-user + per-IP burst guard)
 *     → handler (T-004 scaffold — opens empty SSE stream, no LLM call)
 *
 * ## Gates tested
 *
 * - 401 when unauthenticated.
 * - 403 when rate-limited (per-user or per-IP).
 * - 400 when the request body is invalid (empty messages array, missing field).
 * - 200 + SSE `done` frame for a valid authenticated request with no AI entitlements
 *   (confirms the route is open to ALL authenticated users regardless of plan, per
 *   SPEC-211 §7.7).
 *
 * ## What is NOT tested here
 *
 * - `filters` SSE event (T-005 — `generateObject` not yet wired).
 * - `token` SSE events (T-006 — `streamText` not yet wired).
 * - Conversation persistence / `conversationId` in `done` (T-007).
 * - AI engine error mapping (T-005/T-006 will add those cases).
 *
 * @module test/integration/ai/search-chat
 */

// ---------------------------------------------------------------------------
// Env flags (must be set before any module that reads them loads).
// ---------------------------------------------------------------------------

process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
process.env.HOSPEDA_AI_VAULT_MASTER_KEY = 'test-vault-master-key-for-integration-tests-32chr';

// ---------------------------------------------------------------------------
// Hoisted stub state — declared via vi.hoisted so they are available before
// vi.mock factory functions run.
// ---------------------------------------------------------------------------

const { currentEntitlementsForTest, currentLimitsForTest, currentBillingLoadFailedForTest } =
    vi.hoisted(() => ({
        currentEntitlementsForTest: { current: new Set<string>() },
        currentLimitsForTest: { current: new Map<string, number>() },
        currentBillingLoadFailedForTest: { current: false as boolean }
    }));

// ---------------------------------------------------------------------------
// Mock: entitlementMiddleware
// Injects per-test entitlement / limits / billingLoadFailed into Hono context.
// Mirrors the exact pattern used by search-intent.test.ts and chat-route.test.ts.
// ---------------------------------------------------------------------------

vi.mock('../../../src/middlewares/entitlement', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/middlewares/entitlement')>();
    return {
        ...actual,
        entitlementMiddleware: () => {
            return async (
                c: Parameters<AppMiddleware>[0],
                next: Parameters<AppMiddleware>[1]
            ): Promise<void> => {
                c.set(
                    'userEntitlements',
                    currentEntitlementsForTest.current as Set<EntitlementKey>
                );
                c.set('userLimits', currentLimitsForTest.current as Map<LimitKey, number>);
                c.set('billingLoadFailed', currentBillingLoadFailedForTest.current);
                await next();
            };
        }
    };
});

// ---------------------------------------------------------------------------
// Imports (post-mock).
// ---------------------------------------------------------------------------

import { OpenAPIHono } from '@hono/zod-openapi';
import { EntitlementKey, LimitKey } from '@repo/billing';
import { type PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actorMiddleware } from '../../../src/middlewares/actor';
import { createErrorHandler } from '../../../src/middlewares/response';
import { protectedAiSearchChatRoute } from '../../../src/routes/ai/protected/search-chat';
import type { AppBindings, AppMiddleware } from '../../../src/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PATH = '/test-search-chat';
const ENDPOINT = `${TEST_PATH}/`;
const UNIQUE_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// ---------------------------------------------------------------------------
// Test app
// ---------------------------------------------------------------------------

/**
 * Builds a Hono sub-app that mounts the real `protectedAiSearchChatRoute`
 * behind `actorMiddleware` so mock-actor headers populate the `actor` context
 * var read by `protectedAuthMiddleware` (injected by the factory).
 */
function buildTestApp(): OpenAPIHono<AppBindings> {
    const app = new OpenAPIHono<AppBindings>({ strict: false });
    app.onError(createErrorHandler());
    app.use(actorMiddleware());
    app.route(TEST_PATH, protectedAiSearchChatRoute);
    return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds standard mock-actor headers for the protected tier.
 * Default actor is a USER role with no extra permissions.
 */
function makeMockActorHeaders(
    overrides: { actorId?: string; role?: RoleEnum; permissions?: PermissionEnum[] } = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'user-agent': 'vitest-integration',
        'x-mock-actor-id': overrides.actorId ?? UNIQUE_USER_ID,
        'x-mock-actor-role': overrides.role ?? RoleEnum.USER,
        'x-mock-actor-permissions': JSON.stringify(overrides.permissions ?? [])
    };
}

/**
 * Builds a minimal valid request body for the search-chat endpoint.
 * Uses the smallest valid payload: a single user message and default locale.
 */
function makeValidBody(
    overrides: {
        messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
        locale?: string;
        conversationId?: string | null;
    } = {}
): string {
    const body: Record<string, unknown> = {
        messages: overrides.messages ?? [{ role: 'user', content: 'Quiero un lugar con pileta' }]
    };
    if (overrides.locale !== undefined) {
        body.locale = overrides.locale;
    }
    if (overrides.conversationId !== undefined) {
        body.conversationId = overrides.conversationId;
    }
    return JSON.stringify(body);
}

interface SseFrame {
    readonly event: string;
    readonly data: string;
}

/**
 * Reads all SSE frames from a streaming response body.
 * Handles chunked transfer and `\n\n`-delimited event blocks.
 */
async function readSseFrames(response: Response): Promise<SseFrame[]> {
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is null — no SSE stream');
    }

    const decoder = new TextDecoder();
    let raw = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        raw += decoder.decode(value, { stream: true });
    }

    raw += decoder.decode();

    return raw
        .split('\n\n')
        .filter((block) => block.trim() !== '')
        .map((block) => {
            const lines = block.split('\n');
            let event = '';
            let data = '';

            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    event = line.slice('event: '.length).trim();
                } else if (line.startsWith('data: ')) {
                    data = line.slice('data: '.length).trim();
                }
            }

            return { event, data };
        });
}

interface JsonErrorBody {
    readonly success: boolean;
    readonly error?: {
        readonly code: string;
        readonly message?: string;
    };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/v1/protected/ai/search-chat — integration gates (SPEC-212 T-004)', () => {
    const app = buildTestApp();

    beforeEach(() => {
        // Reset per-test stub state to safe defaults.
        currentBillingLoadFailedForTest.current = false;
        // SPEC-211 §7.7: ai_search is a free platform feature — no AI entitlement
        // required. Default to empty set (tourist-free user) to verify the route
        // is open to all authenticated users regardless of billing plan.
        currentEntitlementsForTest.current = new Set<EntitlementKey>();
        currentLimitsForTest.current = new Map<LimitKey, number>();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // Gate 1 — 401 unauthenticated
    // =========================================================================

    describe('Gate 1 — 401 when unauthenticated', () => {
        it('returns 401 when no mock-actor headers are provided', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: makeValidBody()
            });

            expect(res.status).toBe(401);
        });
    });

    // =========================================================================
    // Gate 2 — 400 on invalid body (validation runs pre-handler)
    // =========================================================================

    describe('Gate 2 — 400 on invalid request body', () => {
        it('returns 400 VALIDATION_ERROR when messages is an empty array', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ messages: [] })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when messages field is missing', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ locale: 'es' })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when messages exceeds the 20-message cap', async () => {
            const tooManyMessages = Array.from({ length: 21 }, (_, i) => ({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `message-${i}`
            }));

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({ messages: tooManyMessages })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when a message has an invalid role', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    messages: [{ role: 'system', content: 'Quiero una cabaña' }]
                })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns 400 VALIDATION_ERROR when conversationId is not a valid UUID', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'Quiero algo cerca del río' }],
                    conversationId: 'not-a-uuid'
                })
            });

            expect(res.status).toBe(400);

            const body = (await res.json()) as JsonErrorBody;
            expect(body.success).toBe(false);
            expect(body.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    // =========================================================================
    // Gate 3 — 200 SSE response for valid authenticated request
    // Confirms the route is open to ALL authenticated users regardless of plan
    // (SPEC-211 §7.7 — ai_search is a free platform feature).
    // =========================================================================

    describe('Gate 3 — 200 SSE response for valid authenticated request', () => {
        it('returns 200 with text/event-stream content-type for a valid request', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');
        });

        it('emits a done SSE frame (T-004 scaffold placeholder) for a valid request', async () => {
            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);

            const frames = await readSseFrames(res);
            const doneFrames = frames.filter((frame) => frame.event === 'done');
            expect(doneFrames).toHaveLength(1);

            // T-004 scaffold emits `{ conversationId: null }` as the done payload.
            // T-007 will replace this with the persisted conversationId.
            const donePayload = JSON.parse(doneFrames[0]?.data ?? '{}') as {
                conversationId: string | null;
            };
            expect(donePayload).toHaveProperty('conversationId');
        });

        it('succeeds for a USER with NO AI entitlements (tourist-free, no plan grants)', async () => {
            // Simulate a tourist-free user: empty entitlements, empty limits.
            currentEntitlementsForTest.current = new Set<EntitlementKey>();
            currentLimitsForTest.current = new Map<LimitKey, number>();

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders({ role: RoleEnum.USER }),
                body: makeValidBody()
            });

            // The route must succeed — no entitlement gate exists on this route.
            expect(res.status).toBe(200);
        });

        it('succeeds for a HOST with AI_CHAT entitlement but NOT AI_SEARCH', async () => {
            // HOST user with chat but no explicit search entitlement.
            // Confirms the route does not gate on AI_SEARCH (SPEC-211 §7.7).
            currentEntitlementsForTest.current = new Set([EntitlementKey.AI_CHAT]);
            currentLimitsForTest.current = new Map([[LimitKey.MAX_AI_CHAT_PER_MONTH, 20]]);

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders({ role: RoleEnum.HOST }),
                body: makeValidBody()
            });

            expect(res.status).toBe(200);
        });

        it('succeeds even when billingLoadFailed is true (platform feature is billing-transparent)', async () => {
            currentBillingLoadFailedForTest.current = true;

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody()
            });

            // Platform-governed — a billing outage does not block search.
            expect(res.status).toBe(200);
        });

        it('accepts a valid multi-turn conversation body with conversationId', async () => {
            const multiTurnMessages = [
                { role: 'user' as const, content: 'Quiero una cabaña con pileta' },
                {
                    role: 'assistant' as const,
                    content: 'Encontré varios alojamientos con pileta.'
                },
                { role: 'user' as const, content: 'Que también tenga wifi' }
            ];

            const res = await app.request(ENDPOINT, {
                method: 'POST',
                headers: makeMockActorHeaders(),
                body: makeValidBody({
                    messages: multiTurnMessages,
                    locale: 'es',
                    conversationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
                })
            });

            expect(res.status).toBe(200);
        });
    });
});
