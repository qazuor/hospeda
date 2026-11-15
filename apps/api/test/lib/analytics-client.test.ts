/**
 * @file analytics-client.test.ts
 * @description Unit tests for the Umami-backed server analytics client (HOS-2119, T-021).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEnv, mockCreateUmami, mockCapture, mockShutdown, mockWarn } = vi.hoisted(() => {
    const capture = vi.fn();
    const shutdown = vi.fn(async () => {});
    return {
        mockEnv: {} as Record<string, string | undefined>,
        mockCapture: capture,
        mockShutdown: shutdown,
        mockWarn: vi.fn(),
        mockCreateUmami: vi.fn((_options: Record<string, unknown>) => ({
            capture,
            flush: vi.fn(),
            shutdown
        }))
    };
});

vi.mock('../../src/utils/env.js', () => ({ env: mockEnv }));
vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: mockWarn, error: vi.fn() }
}));
vi.mock('@repo/analytics', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/analytics')>()),
    createUmamiServerClient: mockCreateUmami
}));

import {
    _resetAnalyticsClientForTests,
    captureServerAnalyticsEvent,
    getAnalyticsClient,
    isAnalyticsEnabled,
    shutdownAnalytics
} from '../../src/lib/analytics-client';

const WEB_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

function setEnv(values: Record<string, string | undefined>): void {
    for (const key of Object.keys(mockEnv)) delete mockEnv[key];
    Object.assign(mockEnv, {
        NODE_ENV: 'production',
        HOSPEDA_API_URL: 'https://api.hospeda.com.ar',
        HOSPEDA_SITE_URL: 'https://hospeda.com.ar',
        HOSPEDA_ADMIN_URL: 'https://admin.hospeda.com.ar',
        HOSPEDA_UMAMI_URL: 'https://umami.example.com',
        HOSPEDA_UMAMI_WEBSITE_ID_WEB: WEB_ID,
        HOSPEDA_UMAMI_WEBSITE_ID_ADMIN: ADMIN_ID,
        ...values
    });
}

const validEvent = {
    distinctId: 'user-1',
    name: 'ai_feature_used',
    properties: { feature: 'text_improve', provider: null }
} as const;

describe('analytics-client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetAnalyticsClientForTests();
        setEnv({});
    });

    describe('when Umami is not configured', () => {
        it('returns null and never builds a client when HOSPEDA_UMAMI_URL is unset', () => {
            setEnv({ HOSPEDA_UMAMI_URL: undefined });
            expect(getAnalyticsClient()).toBeNull();
            expect(isAnalyticsEnabled()).toBe(false);
            expect(mockCreateUmami).not.toHaveBeenCalled();
        });

        it('returns null when the web website id is unset', () => {
            setEnv({ HOSPEDA_UMAMI_WEBSITE_ID_WEB: undefined });
            expect(getAnalyticsClient()).toBeNull();
        });

        it('does not throw nor capture when capturing while disabled', () => {
            setEnv({ HOSPEDA_UMAMI_URL: undefined });
            expect(() => captureServerAnalyticsEvent(validEvent)).not.toThrow();
            expect(mockCapture).not.toHaveBeenCalled();
        });
    });

    describe('lazy singleton', () => {
        it('builds the client once across repeated access', () => {
            const first = getAnalyticsClient();
            const second = getAnalyticsClient();
            captureServerAnalyticsEvent(validEvent);
            expect(first).not.toBeNull();
            expect(second).toBe(first);
            expect(mockCreateUmami).toHaveBeenCalledTimes(1);
        });
    });

    describe('surface selection', () => {
        it('uses the web website id and the site hostname by default', () => {
            getAnalyticsClient();
            const options = mockCreateUmami.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(options.websiteId).toBe(WEB_ID);
            expect(options.hostname).toBe('hospeda.com.ar');
            expect(options.url).toBe('https://umami.example.com');
        });

        it('uses the admin website id and the admin hostname for the admin surface', () => {
            getAnalyticsClient({ surface: 'admin' });
            const options = mockCreateUmami.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(options.websiteId).toBe(ADMIN_ID);
            expect(options.hostname).toBe('admin.hospeda.com.ar');
        });

        it('falls back to the web website and hostname when no admin id is configured', () => {
            setEnv({ HOSPEDA_UMAMI_WEBSITE_ID_ADMIN: undefined });
            const admin = getAnalyticsClient({ surface: 'admin' });
            const web = getAnalyticsClient();
            const options = mockCreateUmami.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(options.websiteId).toBe(WEB_ID);
            expect(options.hostname).toBe('hospeda.com.ar');
            expect(admin).toBe(web);
            expect(mockCreateUmami).toHaveBeenCalledTimes(1);
        });

        it('routes a capture with surface admin through the admin client', () => {
            captureServerAnalyticsEvent({ ...validEvent, surface: 'admin' });
            const options = mockCreateUmami.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(options.websiteId).toBe(ADMIN_ID);
            expect(mockCapture).toHaveBeenCalledTimes(1);
        });
    });

    describe('capture', () => {
        it.each([
            ['test', 'test', 'http://localhost:3001'],
            ['production', 'production', 'https://api.hospeda.com.ar'],
            ['production', 'staging', 'https://api.staging.hospeda.com.ar'],
            ['development', 'development', 'http://localhost:3001']
        ])('tags environment for NODE_ENV=%s as %s', (nodeEnv, expected, apiUrl) => {
            setEnv({ NODE_ENV: nodeEnv, HOSPEDA_API_URL: apiUrl });
            captureServerAnalyticsEvent(validEvent);
            const sent = mockCapture.mock.calls[0]?.[0] as {
                distinctId: string;
                event: string;
                properties: Record<string, unknown>;
            };
            expect(sent.distinctId).toBe('user-1');
            expect(sent.event).toBe('ai_feature_used');
            expect(sent.properties.environment).toBe(expected);
            expect(sent.properties.app).toBe('api');
            expect(sent.properties.feature).toBe('text_improve');
        });

        it('forwards a visitor outside properties', () => {
            const visitor = { ip: '203.0.113.9', userAgent: 'Mozilla/5.0 Test' };
            captureServerAnalyticsEvent({ ...validEvent, visitor });
            expect(mockCapture).toHaveBeenCalledTimes(1);
            const sent = mockCapture.mock.calls[0]?.[0] as { properties: Record<string, unknown> };
            expect(sent).toEqual({
                distinctId: 'user-1',
                event: 'ai_feature_used',
                properties: {
                    app: 'api',
                    environment: 'production',
                    feature: 'text_improve',
                    provider: null
                },
                visitor
            });
            expect(sent.properties).not.toHaveProperty('ip');
            expect(sent.properties).not.toHaveProperty('userAgent');
        });

        it('does not forward an event that fails catalog validation', () => {
            captureServerAnalyticsEvent({
                distinctId: 'user-1',
                name: 'ai_feature_used',
                // @ts-expect-error missing required `feature`
                properties: { provider: null }
            });
            expect(mockCapture).not.toHaveBeenCalled();
            expect(mockWarn).toHaveBeenCalledTimes(1);
        });

        it('does not forward an event carrying a PII property key', () => {
            captureServerAnalyticsEvent({
                distinctId: 'user-1',
                name: 'ai_feature_used',
                // @ts-expect-error forbidden key
                properties: { feature: 'x', provider: null, email: 'a@b.c' }
            });
            expect(mockCapture).not.toHaveBeenCalled();
        });
    });

    describe('shutdownAnalytics', () => {
        it('flushes the client with the 3s budget', async () => {
            getAnalyticsClient();
            await shutdownAnalytics();
            expect(mockShutdown).toHaveBeenCalledTimes(1);
            expect(mockShutdown).toHaveBeenCalledWith({ timeoutMs: 3000 });
        });

        it('shuts down every distinct surface client exactly once', async () => {
            const shutdowns: Array<ReturnType<typeof vi.fn>> = [];
            const distinctClient = (_options: Record<string, unknown>) => {
                const shutdown = vi.fn(async () => {});
                shutdowns.push(shutdown);
                return { capture: vi.fn(), flush: vi.fn(), shutdown };
            };
            mockCreateUmami.mockImplementationOnce(distinctClient);
            mockCreateUmami.mockImplementationOnce(distinctClient);
            const web = getAnalyticsClient();
            const admin = getAnalyticsClient({ surface: 'admin' });
            expect(web).not.toBe(admin);
            expect(shutdowns).toHaveLength(2);
            await shutdownAnalytics();
            for (const shutdown of shutdowns) {
                expect(shutdown).toHaveBeenCalledTimes(1);
                expect(shutdown).toHaveBeenCalledWith({ timeoutMs: 3000 });
            }
        });

        it('is idempotent and leaves the client disabled afterwards', async () => {
            getAnalyticsClient();
            await shutdownAnalytics();
            await shutdownAnalytics();
            expect(mockShutdown).toHaveBeenCalledTimes(1);
            expect(getAnalyticsClient()).toBeNull();
        });

        it('resolves immediately when analytics are disabled', async () => {
            setEnv({ HOSPEDA_UMAMI_URL: undefined });
            getAnalyticsClient();
            await expect(shutdownAnalytics()).resolves.toBeUndefined();
            expect(mockShutdown).not.toHaveBeenCalled();
        });

        it('swallows a shutdown error', async () => {
            mockShutdown.mockRejectedValueOnce(new Error('boom'));
            getAnalyticsClient();
            await expect(shutdownAnalytics()).resolves.toBeUndefined();
            expect(mockWarn).toHaveBeenCalledTimes(1);
        });
    });
});
