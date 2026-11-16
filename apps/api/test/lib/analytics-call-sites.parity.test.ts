/**
 * @file analytics-call-sites.parity.test.ts
 * @description HOS-2119 T-025 (AC-2 + AC-3, api level).
 *
 * Drives every server analytics call site of spec section 5.2 through the REAL path:
 *
 *   capture helper -> `captureServerAnalyticsEvent` (`createServerAnalytics`, catalog
 *   validation via `prepareAnalyticsEvent`) -> `createUmamiServerClient` -> mapper
 *   (`umami-payload.ts`) -> `fetch` POST `<umami>/api/batch`.
 *
 * Only `fetch` (global) and the env / logger modules are replaced. The assertions are on
 * the body that reaches the batch endpoint: event name, website id, `data` keys (the
 * catalog-defined snake_case properties plus the documented globals), identity rules
 * (`payload.id` never, `data.user_id` only for real users) and visitor attribution.
 *
 * AC-3: with Umami unreachable (fetch rejecting or hanging) the calling helpers return
 * synchronously and flush/shutdown resolve within the adapter budget; the delivery error
 * is logged once per flush, never once per event.
 */
import type { AiEngineEvent } from '@repo/ai-core';
import { AnalyticsEventSchemas } from '@repo/analytics';
import { VerticalEnum } from '@repo/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnv, loggerMock } = vi.hoisted(() => ({
    mockEnv: {} as Record<string, string | undefined>,
    loggerMock: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/env.js', () => ({ env: mockEnv }));
vi.mock('../../src/utils/logger.js', () => ({ apiLogger: loggerMock }));
vi.mock('../../src/lib/sentry.js', () => ({
    isSentryEnabled: () => false,
    Sentry: { addBreadcrumb: vi.fn(), captureMessage: vi.fn() }
}));
vi.mock('@repo/logger', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/logger')>()),
    createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}));

import {
    _resetAnalyticsClientForTests,
    captureServerAnalyticsEvent,
    getAnalyticsClient,
    shutdownAnalytics
} from '../../src/lib/analytics-client';
import { captureSignupCompleted, resolveSignInVisitor } from '../../src/lib/auth-signup-analytics';
import { captureChatEvent } from '../../src/routes/ai/protected/chat.helpers';
import { createAiObservabilityRecordEvent } from '../../src/services/ai-observability.service';
import {
    createAnalyticsFactSink,
    emitTrialAnalyticsFact
} from '../../src/utils/analytics/analytics-facts';
import { markHeadersAsNotVisitor } from '../../src/utils/visitor-context';

const UMAMI_URL = 'https://umami.example.com';
const BATCH_URL = `${UMAMI_URL}/api/batch`;
const WEB_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-123';
const ACC_ID = 'acc-1';
const SYNTHETIC_IP = '127.0.0.1';
const VISITOR = { ip: '203.0.113.7', userAgent: 'Mozilla/5.0 (Test) Browser/1.0' } as const;
/** Globals `createServerAnalytics` adds to every validated event (api, production env). */
const GLOBALS = { app: 'api', environment: 'production' } as const;

interface PostedItem {
    readonly type: string;
    readonly payload: {
        readonly website: string;
        readonly hostname: string;
        readonly url: string;
        readonly name: string;
        readonly data: Record<string, string | number>;
        readonly ip: string;
        readonly userAgent: string;
        readonly timestamp?: number;
        readonly id?: unknown;
    };
}

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

/** Every event name observed on the wire, to check the section 5.2 coverage at the end. */
const observedNames = new Set<string>();

function setEnv(): void {
    for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    Object.assign(mockEnv, {
        NODE_ENV: 'production',
        HOSPEDA_API_URL: 'https://api.hospeda.com.ar',
        HOSPEDA_SITE_URL: 'https://hospeda.com.ar',
        HOSPEDA_ADMIN_URL: 'https://admin.hospeda.com.ar',
        HOSPEDA_UMAMI_URL: UMAMI_URL,
        HOSPEDA_UMAMI_WEBSITE_ID_WEB: WEB_ID
    });
}

function okResponse(count: number): Response {
    return new Response(JSON.stringify({ size: count, processed: count, errors: 0 }), {
        status: 200
    });
}

function installFetch(impl?: typeof fetch): FetchMock {
    const mock = vi.fn<typeof fetch>(
        impl ?? (async (_url, init) => okResponse(JSON.parse(String(init?.body)).length as number))
    );
    vi.stubGlobal('fetch', mock);
    return mock;
}

function postedItems(fetchMock: FetchMock): PostedItem[] {
    return fetchMock.mock.calls.flatMap(([url, init]) => {
        expect(String(url)).toBe(BATCH_URL);
        return JSON.parse(String(init?.body)) as PostedItem[];
    });
}

/** Catalog property keys of an event (zod object shape), or undefined when not an object. */
function catalogKeys(name: string): Set<string> | undefined {
    const schema = (AnalyticsEventSchemas as Record<string, unknown>)[name];
    if (schema && typeof schema === 'object' && 'shape' in schema) {
        return new Set(Object.keys((schema as { shape: Record<string, unknown> }).shape));
    }
    return undefined;
}

/**
 * Flushes the singleton client and returns what reached `/api/batch`, after applying the
 * checks that hold for EVERY event: catalog membership, website id, no `payload.id`.
 * For events that went through catalog validation, data keys must be a subset of the
 * catalog properties plus the documented globals/identity extras.
 */
async function drain(
    fetchMock: FetchMock,
    options: { validated?: boolean; allowedExtraKeyPrefixes?: readonly string[] } = {}
): Promise<PostedItem[]> {
    const client = getAnalyticsClient();
    expect(client).not.toBeNull();
    await client?.flush();
    const items = postedItems(fetchMock);
    for (const item of items) {
        observedNames.add(item.payload.name);
        expect(item.type).toBe('event');
        expect(Object.keys(AnalyticsEventSchemas)).toContain(item.payload.name);
        expect(item.payload.website).toBe(WEB_ID);
        expect(item.payload.hostname).toBe('hospeda.com.ar');
        expect(item.payload.url).toBe(`/_server/${item.payload.name}`);
        expect(item.payload).not.toHaveProperty('id');
        if (options.validated ?? true) {
            const allowed = new Set([
                ...(catalogKeys(item.payload.name) ?? []),
                ...Object.keys(GLOBALS),
                'user_id',
                'event_uuid'
            ]);
            for (const key of Object.keys(item.payload.data)) {
                const isAllowedPrefix = (options.allowedExtraKeyPrefixes ?? []).some((prefix) =>
                    key.startsWith(prefix)
                );
                expect(allowed.has(key) || isAllowedPrefix, `unexpected data key "${key}"`).toBe(
                    true
                );
            }
        }
    }
    return items;
}

function only(items: PostedItem[]): PostedItem['payload'] {
    expect(items).toHaveLength(1);
    return (items[0] as PostedItem).payload;
}

beforeEach(() => {
    vi.clearAllMocks();
    _resetAnalyticsClientForTests();
    setEnv();
});

afterEach(async () => {
    vi.useRealTimers();
    await shutdownAnalytics();
    _resetAnalyticsClientForTests();
    vi.unstubAllGlobals();
});

describe('analytics call sites parity (AC-2): helper -> catalog -> umami client -> /api/batch', () => {
    describe('ai/protected/chat* (captureChatEvent)', () => {
        const base = { entityId: ACC_ID, locale: 'es' as const };

        it('should post ai_chat_opened with snake_case messages_count and the visitor identity', async () => {
            const fetchMock = installFetch();
            captureChatEvent(
                USER_ID,
                'ai_chat_opened',
                { ...base, messageCount: 3 },
                { visitor: VISITOR }
            );
            const payload = only(await drain(fetchMock));
            expect(payload.name).toBe('ai_chat_opened');
            expect(payload.data).toEqual({
                ...GLOBALS,
                accommodation_id: ACC_ID,
                locale: 'es',
                messages_count: 3,
                user_id: USER_ID
            });
            expect(payload.ip).toBe(VISITOR.ip);
            expect(payload.userAgent).toBe(VISITOR.userAgent);
        });

        it('should post ai_chat_cap_reached and ai_chat_message_sent with their catalog keys', async () => {
            const fetchMock = installFetch();
            captureChatEvent(USER_ID, 'ai_chat_cap_reached', { ...base, messageCount: 10 });
            captureChatEvent(USER_ID, 'ai_chat_message_sent', {
                ...base,
                messageCount: 2,
                conversationId: 'conv-1'
            });
            const items = await drain(fetchMock);
            expect(items.map((i) => i.payload.name)).toEqual([
                'ai_chat_cap_reached',
                'ai_chat_message_sent'
            ]);
            expect(items[0]?.payload.data).toEqual({
                ...GLOBALS,
                accommodation_id: ACC_ID,
                locale: 'es',
                messages_count: 10,
                user_id: USER_ID
            });
            expect(items[1]?.payload.data).toEqual({
                ...GLOBALS,
                accommodation_id: ACC_ID,
                locale: 'es',
                messages_count: 2,
                conversation_id: 'conv-1',
                user_id: USER_ID
            });
        });

        it('should post ai_chat_moderation_blocked without messages_count', async () => {
            const fetchMock = installFetch();
            captureChatEvent(USER_ID, 'ai_chat_moderation_blocked', {
                ...base,
                conversationId: 'conv-1',
                messageCount: 9
            });
            expect(only(await drain(fetchMock)).data).toEqual({
                ...GLOBALS,
                accommodation_id: ACC_ID,
                locale: 'es',
                conversation_id: 'conv-1',
                user_id: USER_ID
            });
        });

        it('should post ai_chat_response_completed with token counts and drop null provider/model', async () => {
            const fetchMock = installFetch();
            captureChatEvent(USER_ID, 'ai_chat_response_completed', {
                ...base,
                provider: 'openai',
                model: '',
                promptTokens: 120,
                completionTokens: 45
            });
            expect(only(await drain(fetchMock)).data).toEqual({
                ...GLOBALS,
                accommodation_id: ACC_ID,
                locale: 'es',
                provider: 'openai',
                prompt_tokens: 120,
                completion_tokens: 45,
                user_id: USER_ID
            });
        });
    });

    describe('lib/auth-signup-analytics + auth.ts hooks', () => {
        it('should post sign_up_completed for an email signup with the hook visitor', async () => {
            const fetchMock = installFetch();
            captureSignupCompleted({
                userId: USER_ID,
                context: {
                    path: '/sign-up/email',
                    headers: new Headers({
                        'cf-connecting-ip': VISITOR.ip,
                        'user-agent': VISITOR.userAgent
                    })
                }
            });
            const payload = only(await drain(fetchMock));
            expect(payload.name).toBe('sign_up_completed');
            expect(payload.data).toEqual({
                ...GLOBALS,
                auth_method: 'email',
                role: 'USER',
                user_type: 'tourist',
                user_id: USER_ID
            });
            expect(payload.ip).toBe(VISITOR.ip);
            expect(payload.userAgent).toBe(VISITOR.userAgent);
        });

        it('should post sign_up_completed with the OAuth provider and a synthetic identity when no headers are reachable', async () => {
            const fetchMock = installFetch();
            captureSignupCompleted({
                userId: USER_ID,
                context: { path: '/callback/:id', params: { id: 'google' } }
            });
            const payload = only(await drain(fetchMock));
            expect(payload.data['auth_method']).toBe('google');
            expect(payload.data['user_id']).toBe(USER_ID);
            expect(payload.ip).toBe(SYNTHETIC_IP);
            expect(payload.userAgent).not.toBe(VISITOR.userAgent);
            expect(payload.userAgent).toMatch(/^Mozilla\/5\.0 /);
        });

        it('should post sign_in_completed with the visitor, and a synthetic identity for impersonation / not-visitor requests', async () => {
            const fetchMock = installFetch();
            const headers = new Headers({
                'x-forwarded-for': `${VISITOR.ip}, 10.0.0.1`,
                'user-agent': VISITOR.userAgent
            });
            const emit = (visitor: ReturnType<typeof resolveSignInVisitor>): void =>
                captureServerAnalyticsEvent({
                    distinctId: USER_ID,
                    name: 'sign_in_completed',
                    properties: { role: 'USER', user_type: 'tourist' },
                    ...(visitor ? { visitor } : {})
                });
            emit(resolveSignInVisitor({ session: {}, context: { headers } }));
            emit(
                resolveSignInVisitor({
                    session: { impersonatedBy: 'admin-1' },
                    context: { headers }
                })
            );
            emit(
                resolveSignInVisitor({
                    session: {},
                    context: { headers: markHeadersAsNotVisitor({ headers }) }
                })
            );
            const items = await drain(fetchMock);
            expect(items).toHaveLength(3);
            expect(items[0]?.payload.ip).toBe(VISITOR.ip);
            expect(items[0]?.payload.data).toEqual({
                ...GLOBALS,
                role: 'USER',
                user_type: 'tourist',
                user_id: USER_ID
            });
            expect(items[1]?.payload.ip).toBe(SYNTHETIC_IP);
            expect(items[2]?.payload.ip).toBe(SYNTHETIC_IP);
        });
    });

    describe('routes (payload shapes built by the handlers)', () => {
        it('should post host-onboarding/start events (onboarding_started + accommodation_draft_saved)', async () => {
            const fetchMock = installFetch();
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'onboarding_started',
                properties: { onboarding_type: 'host_accommodation', draft_source: 'manual' },
                visitor: VISITOR
            });
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'accommodation_draft_saved',
                properties: { accommodation_id: ACC_ID, creation_source: 'manual' },
                visitor: VISITOR
            });
            const items = await drain(fetchMock);
            expect(items.map((i) => i.payload.name)).toEqual([
                'onboarding_started',
                'accommodation_draft_saved'
            ]);
            expect(items[0]?.payload.data).toEqual({
                ...GLOBALS,
                onboarding_type: 'host_accommodation',
                draft_source: 'manual',
                user_id: USER_ID
            });
            expect(items[1]?.payload.data).toEqual({
                ...GLOBALS,
                accommodation_id: ACC_ID,
                creation_source: 'manual',
                user_id: USER_ID
            });
            expect(items.every((i) => i.payload.ip === VISITOR.ip)).toBe(true);
        });

        it('should post accommodation_published and drop undefined optional properties', async () => {
            const fetchMock = installFetch();
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'accommodation_published',
                properties: {
                    accommodation_id: ACC_ID,
                    accommodation_type: 'HOTEL',
                    destination_id: 'dest-1',
                    owner_id: undefined
                }
            });
            expect(only(await drain(fetchMock)).data).toEqual({
                ...GLOBALS,
                accommodation_id: ACC_ID,
                accommodation_type: 'HOTEL',
                destination_id: 'dest-1',
                user_id: USER_ID
            });
        });

        it('should post the three import-from-url events (nullable import_source, boolean as string)', async () => {
            const fetchMock = installFetch();
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'accommodation_import_started',
                properties: { import_mode: 'request', import_source: 'booking.com' }
            });
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'accommodation_import_failed',
                properties: { import_source: null, failure_reason: 'no_source_detected' }
            });
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'accommodation_import_completed',
                properties: { import_source: 'jsonld', partial: true, prefilled_field_count: 7 }
            });
            const items = await drain(fetchMock);
            expect(items.map((i) => i.payload.data)).toEqual([
                {
                    ...GLOBALS,
                    import_mode: 'request',
                    import_source: 'booking.com',
                    user_id: USER_ID
                },
                { ...GLOBALS, failure_reason: 'no_source_detected', user_id: USER_ID },
                {
                    ...GLOBALS,
                    import_source: 'jsonld',
                    partial: 'true',
                    prefilled_field_count: 7,
                    user_id: USER_ID
                }
            ]);
        });

        it('should post conversations/protected/initiate events with the real user id', async () => {
            const fetchMock = installFetch();
            const common = {
                accommodation_id: ACC_ID,
                destination_id: 'dest-1',
                owner_id: 'owner-1',
                contact_method: 'platform_message',
                is_authenticated: true,
                locale: 'es'
            };
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'contact_owner_failed',
                properties: { ...common, failure_reason: 'conversation_duplicate' }
            });
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'contact_owner_completed',
                properties: { ...common, conversation_flow: 'authenticated' }
            });
            const items = await drain(fetchMock);
            expect(items[0]?.payload.data).toEqual({
                ...GLOBALS,
                ...common,
                is_authenticated: 'true',
                failure_reason: 'conversation_duplicate',
                user_id: USER_ID
            });
            expect(items[1]?.payload.data).toEqual({
                ...GLOBALS,
                ...common,
                is_authenticated: 'true',
                conversation_flow: 'authenticated',
                user_id: USER_ID
            });
        });

        it('should NOT forward the anon: distinct id of conversations/public/initiate as user_id', async () => {
            const fetchMock = installFetch();
            captureServerAnalyticsEvent({
                distinctId: `anon:${ACC_ID}`,
                name: 'contact_owner_completed',
                properties: {
                    accommodation_id: ACC_ID,
                    destination_id: 'dest-1',
                    owner_id: 'owner-1',
                    contact_method: 'platform_message',
                    conversation_flow: 'anonymous',
                    is_authenticated: false,
                    locale: 'es'
                },
                visitor: VISITOR
            });
            const payload = only(await drain(fetchMock));
            expect(payload.data).not.toHaveProperty('user_id');
            expect(payload.data['is_authenticated']).toBe('false');
            expect(payload.data['conversation_flow']).toBe('anonymous');
            expect(payload.ip).toBe(VISITOR.ip);
        });
    });

    describe('utils/analytics/analytics-facts (billing + trial sink)', () => {
        const occurredAt = new Date('2026-01-02T03:04:05.000Z');
        const expectedTimestamp = Math.floor(occurredAt.getTime() / 1000);

        it('should post checkout, activation and plan-change events with dedupe uuid and fact timestamp', async () => {
            const fetchMock = installFetch();
            const sink = createAnalyticsFactSink({ capture: captureServerAnalyticsEvent });
            sink.emit({
                kind: 'CHECKOUT_STARTED',
                userId: USER_ID,
                vertical: 'accommodation',
                subscriptionId: 's-1',
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'USER',
                planVersionId: 'pv-1',
                billingOptionId: 'bo-1',
                cycle: 'monthly',
                amountMinor: 1500,
                currency: 'ARS',
                occurredAt
            });
            sink.emit({
                kind: 'SUBSCRIPTION_ACTIVATED',
                userId: USER_ID,
                vertical: VerticalEnum.ACCOMMODATION,
                subscriptionId: 's-2',
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'SYSTEM',
                planVersionId: 'pv-2',
                billingOptionId: 'bo-2',
                cycle: 'annual',
                amountMinor: 9000,
                currency: 'ARS',
                occurredAt,
                predecessor: {
                    planVersionId: 'pv-1',
                    cycle: 'monthly',
                    amountMinor: 1500,
                    direction: 'UPGRADE'
                }
            });
            const items = await drain(fetchMock);
            expect(items.map((i) => i.payload.name)).toEqual([
                'billing_checkout_started',
                'billing_subscription_activated',
                'billing_plan_changed'
            ]);
            expect(items[0]?.payload.data).toEqual({
                ...GLOBALS,
                vertical: 'accommodation',
                subscription_class: 'PRINCIPAL',
                actor_kind: 'USER',
                subscription_id: 's-1',
                plan_version_id: 'pv-1',
                billing_option_id: 'bo-1',
                cycle: 'monthly',
                amount_minor: 1500,
                currency: 'ARS',
                user_id: USER_ID,
                event_uuid: expect.stringMatching(/^[0-9a-f-]{36}$/)
            });
            expect(items[2]?.payload.data).toMatchObject({
                from_plan_version_id: 'pv-1',
                to_plan_version_id: 'pv-2',
                from_cycle: 'monthly',
                to_cycle: 'annual',
                direction: 'UPGRADE',
                from_amount_minor: 1500,
                to_amount_minor: 9000,
                user_id: USER_ID
            });
            for (const item of items) {
                expect(item.payload.timestamp).toBe(expectedTimestamp);
                expect(item.payload.ip).toBe(SYNTHETIC_IP);
            }
        });

        it('should post a trial fact emitted through the production sink (emitTrialAnalyticsFact)', async () => {
            const fetchMock = installFetch();
            emitTrialAnalyticsFact({
                kind: 'TRIAL_STARTED',
                userId: USER_ID,
                vertical: 'accommodation',
                actorKind: 'USER',
                trialId: 't-1',
                trialDays: 14,
                activationEvent: 'listing_published',
                occurredAt
            });
            const payload = only(await drain(fetchMock));
            expect(payload.name).toBe('trial_started');
            expect(payload.data).toEqual({
                ...GLOBALS,
                vertical: 'accommodation',
                actor_kind: 'USER',
                activation_event: 'listing_published',
                trial_days: 14,
                user_id: USER_ID,
                event_uuid: expect.stringMatching(/^[0-9a-f-]{36}$/)
            });
            expect(payload.timestamp).toBe(expectedTimestamp);
        });
    });

    describe('services/ai-observability.service (distinctId api-server)', () => {
        /** Lets the sink's fire-and-forget async handlers run. */
        const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

        it('should post the five ai_* events with no user id and a synthetic identity', async () => {
            const fetchMock = installFetch();
            const record: (event: AiEngineEvent) => void = createAiObservabilityRecordEvent();
            record({ type: 'success', feature: 'text_improve', providerId: 'openai' });
            record({
                type: 'fallback',
                feature: 'text_improve',
                fromProvider: 'openai',
                toProvider: 'anthropic',
                error: new Error('boom')
            });
            record({ type: 'exhausted', feature: 'text_improve', attempts: [] });
            record({ type: 'kill_switch', feature: 'text_improve' });
            record({
                type: 'moderation_blocked',
                feature: 'chat',
                direction: 'input',
                categories: { violence: true }
            });
            await settle();
            // This sink calls the Umami client directly (it does not go through the catalog
            // validator, same as the previous server client), so no globals are added and
            // the nested `categories` object is flattened to dot keys.
            const items = await drain(fetchMock, {
                validated: false
            });
            const byName = new Map(items.map((i) => [i.payload.name, i.payload]));
            expect([...byName.keys()].sort()).toEqual([
                'ai_call_exhausted',
                'ai_fallback',
                'ai_feature_used',
                'ai_kill_switch_hit',
                'ai_moderation_blocked'
            ]);
            expect(byName.get('ai_feature_used')?.data).toEqual({
                feature: 'text_improve',
                provider: 'openai'
            });
            expect(byName.get('ai_fallback')?.data).toEqual({
                feature: 'text_improve',
                from_provider: 'openai',
                to_provider: 'anthropic'
            });
            expect(byName.get('ai_call_exhausted')?.data).toEqual({ feature: 'text_improve' });
            expect(byName.get('ai_kill_switch_hit')?.data).toEqual({ feature: 'text_improve' });
            expect(byName.get('ai_moderation_blocked')?.data).toEqual({
                feature: 'chat',
                direction: 'input',
                'categories.violence': 'true'
            });
            for (const item of items) {
                expect(item.payload.data).not.toHaveProperty('user_id');
                expect(item.payload.ip).toBe(SYNTHETIC_IP);
                // Catalog keys still hold for everything except the documented categories.* extra.
                const allowed = catalogKeys(item.payload.name) ?? new Set<string>();
                for (const key of Object.keys(item.payload.data)) {
                    expect(allowed.has(key) || key.startsWith('categories.')).toBe(true);
                }
            }
        });
    });

    describe('catalog guard', () => {
        it('should reject an invalid property value (messages_count < 0) without posting anything', async () => {
            const fetchMock = installFetch();
            captureServerAnalyticsEvent({
                distinctId: USER_ID,
                name: 'ai_chat_opened',
                properties: { accommodation_id: ACC_ID, locale: 'es', messages_count: -1 }
            });
            await getAnalyticsClient()?.flush();
            expect(fetchMock).not.toHaveBeenCalled();
            expect(loggerMock.warn).toHaveBeenCalledWith(
                expect.objectContaining({ name: 'ai_chat_opened' }),
                'Analytics capture rejected (non-blocking)'
            );
        });

        it('should have exercised every event name emitted by the section 5.2 server call sites', () => {
            const expected = [
                'ai_chat_opened',
                'ai_chat_cap_reached',
                'ai_chat_message_sent',
                'ai_chat_moderation_blocked',
                'ai_chat_response_completed',
                'sign_up_completed',
                'sign_in_completed',
                'onboarding_started',
                'accommodation_draft_saved',
                'accommodation_published',
                'accommodation_import_started',
                'accommodation_import_failed',
                'accommodation_import_completed',
                'contact_owner_failed',
                'contact_owner_completed',
                'billing_checkout_started',
                'billing_subscription_activated',
                'billing_plan_changed',
                'trial_started',
                'ai_feature_used',
                'ai_fallback',
                'ai_call_exhausted',
                'ai_kill_switch_hit',
                'ai_moderation_blocked'
            ];
            for (const name of expected) {
                expect(observedNames.has(name), `${name} was never posted`).toBe(true);
                expect(Object.keys(AnalyticsEventSchemas)).toContain(name);
            }
        });
    });
});

describe('analytics call sites with Umami unreachable (AC-3)', () => {
    const EVENT_COUNT = 5;

    function captureMany(count: number): void {
        for (let i = 0; i < count; i++) {
            captureChatEvent(USER_ID, 'ai_chat_opened', {
                entityId: ACC_ID,
                locale: 'es',
                messageCount: i
            });
        }
    }

    it('should return immediately and log ONE error per flush when fetch rejects', async () => {
        const fetchMock = installFetch(async () => {
            throw new Error('ECONNREFUSED');
        });
        const startedAt = performance.now();
        expect(() => captureMany(EVENT_COUNT)).not.toThrow();
        const callMs = performance.now() - startedAt;
        expect(fetchMock).not.toHaveBeenCalled();

        const flushStart = performance.now();
        await getAnalyticsClient()?.flush();
        const flushMs = performance.now() - flushStart;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(loggerMock.error).toHaveBeenCalledTimes(1);
        expect(loggerMock.error.mock.calls[0]?.[1]).toBe('Umami delivery problem');
        // second flush with new events: one more error, i.e. once per flush and not per event
        captureMany(EVENT_COUNT);
        await getAnalyticsClient()?.flush();
        expect(loggerMock.error).toHaveBeenCalledTimes(2);
        expect(callMs).toBeLessThan(100);
        expect(flushMs).toBeLessThan(500);
        console.info(`AC-3 reject: capture ${callMs.toFixed(1)}ms, flush ${flushMs.toFixed(1)}ms`);
    });

    it('should abort a hanging request at the adapter timeout (2500ms) and log once', async () => {
        vi.useFakeTimers();
        installFetch(
            (_url, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () =>
                        reject(new DOMException('aborted', 'AbortError'))
                    );
                })
        );
        captureMany(EVENT_COUNT);
        let done = false;
        const flushing = getAnalyticsClient()
            ?.flush()
            .then(() => {
                done = true;
            });
        await vi.advanceTimersByTimeAsync(2_499);
        expect(done).toBe(false);
        await vi.advanceTimersByTimeAsync(2);
        await flushing;
        expect(done).toBe(true);
        expect(loggerMock.error).toHaveBeenCalledTimes(1);
    });

    it('should return synchronously for a burst that triggers an auto flush against a hanging fetch, and shutdown resolves within 3s', async () => {
        vi.useFakeTimers();
        // never resolves and ignores the abort signal: only the shutdown deadline can end it
        const fetchMock = installFetch(() => new Promise<Response>(() => {}));
        // 25 events > flushAt (20): the helper triggers a background flush that hangs
        const before = performance.now();
        captureMany(25);
        const callMs = performance.now() - before;
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(callMs).toBeLessThan(100);

        let done = false;
        const shuttingDown = shutdownAnalytics().then(() => {
            done = true;
        });
        await vi.advanceTimersByTimeAsync(2_999);
        expect(done).toBe(false);
        await vi.advanceTimersByTimeAsync(2);
        await shuttingDown;
        expect(done).toBe(true);
        // the stuck request never reported, and nothing is logged per event
        expect(loggerMock.error.mock.calls.length).toBeLessThanOrEqual(1);
        console.info(`AC-3 hang: capture of 25 events ${callMs.toFixed(1)}ms, shutdown <= 3000ms`);
    });
});
