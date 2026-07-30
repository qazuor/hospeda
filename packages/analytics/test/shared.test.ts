import { describe, expect, it, vi } from 'vitest';
import {
    AnalyticsEvents,
    createBrowserAnalytics,
    createServerAnalytics,
    prepareAnalyticsEvent,
    validateDistinctId
} from '../src/index.js';

describe('analytics shared package', () => {
    it('prepares a validated event and merges global properties', () => {
        const payload = prepareAnalyticsEvent({
            name: AnalyticsEvents.accommodationViewed,
            properties: {
                accommodation_id: 'acc-1',
                accommodation_slug: 'mi-cabana',
                locale: 'es'
            },
            globalProperties: {
                app: 'web',
                environment: 'production',
                app_version: '1.2.3'
            }
        });

        expect(payload).toEqual({
            accommodation_id: 'acc-1',
            accommodation_slug: 'mi-cabana',
            app: 'web',
            app_version: '1.2.3',
            environment: 'production',
            locale: 'es'
        });
    });

    it('rejects forbidden PII-like property keys', () => {
        expect(() =>
            prepareAnalyticsEvent({
                name: AnalyticsEvents.contactOwnerFailed,
                properties: {
                    failure_reason: 'rate_limited',
                    guest_email: 'x@y.com'
                } as unknown as { failure_reason: string }
            })
        ).toThrow(/Forbidden analytics property key/i);
    });

    it('rejects unsafe distinct ids', () => {
        expect(() => validateDistinctId('anonymous')).toThrow(/Forbidden analytics distinct_id/i);
    });

    it('captures browser analytics with validated payloads', () => {
        const capture = vi.fn();
        const browser = createBrowserAnalytics({
            enabled: true,
            getClient: () => ({ capture, reset: vi.fn() }),
            getGlobalProperties: () => ({ app: 'web', environment: 'staging' })
        });

        browser.capture(AnalyticsEvents.searchPerformed, {
            search_type: 'accommodation',
            locale: 'es'
        });

        expect(capture).toHaveBeenCalledWith(AnalyticsEvents.searchPerformed, {
            app: 'web',
            environment: 'staging',
            locale: 'es',
            search_type: 'accommodation'
        });
    });

    it('captures server analytics with validated payloads', () => {
        const capture = vi.fn();
        const server = createServerAnalytics({
            enabled: true,
            getClient: () => ({ capture }),
            getGlobalProperties: () => ({ app: 'api', environment: 'production' })
        });

        server.capture({
            distinctId: 'user-1',
            name: AnalyticsEvents.subscriptionCheckoutStarted,
            properties: {
                plan_slug: 'owner-pro',
                billing_period: 'monthly',
                amount: 10,
                currency: 'ARS'
            }
        });

        expect(capture).toHaveBeenCalledWith({
            distinctId: 'user-1',
            event: AnalyticsEvents.subscriptionCheckoutStarted,
            properties: {
                app: 'api',
                environment: 'production',
                plan_slug: 'owner-pro',
                billing_period: 'monthly',
                amount: 10,
                currency: 'ARS'
            }
        });
    });
});
