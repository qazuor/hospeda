/**
 * @file auth-signup-analytics.test.ts
 * @description Unit tests for the signup_completed analytics helpers used by the
 * Better Auth `user.create.after` hook.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// PostHog capture spy — hoisted so it is available inside the vi.mock factory.
const { mockPostHogCapture, mockGetPostHogClient } = vi.hoisted(() => ({
    mockPostHogCapture: vi.fn(),
    mockGetPostHogClient: vi.fn(() => ({ capture: mockPostHogCapture }))
}));

vi.mock('../../src/lib/posthog', () => ({
    getPostHogClient: mockGetPostHogClient,
    captureServerAnalyticsEvent: ({
        distinctId,
        name,
        properties
    }: {
        distinctId: string;
        name: string;
        properties: Record<string, unknown>;
    }) => {
        const client = mockGetPostHogClient();
        if (client) {
            client.capture({ distinctId, event: name, properties });
        }
    },
    isPostHogEnabled: () => true,
    shutdownPostHog: vi.fn(),
    _resetPostHogClientForTests: vi.fn()
}));

vi.mock('@repo/logger', () => ({
    createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() })
}));

import { captureSignupCompleted, deriveSignupProvider } from '../../src/lib/auth-signup-analytics';

describe('deriveSignupProvider', () => {
    it('returns "email" for the email sign-up endpoint', () => {
        expect(deriveSignupProvider({ path: '/sign-up/email' })).toBe('email');
    });

    it('returns the OAuth provider from the callback route param', () => {
        expect(deriveSignupProvider({ path: '/callback/:id', params: { id: 'google' } })).toBe(
            'google'
        );
        expect(deriveSignupProvider({ path: '/callback/:id', params: { id: 'facebook' } })).toBe(
            'facebook'
        );
    });

    it('returns "unknown" for a callback with no string provider param', () => {
        expect(deriveSignupProvider({ path: '/callback/:id', params: {} })).toBe('unknown');
        expect(deriveSignupProvider({ path: '/callback/:id' })).toBe('unknown');
    });

    it('returns "unknown" for an unrecognized path or missing context', () => {
        expect(deriveSignupProvider({ path: '/some/other/path' })).toBe('unknown');
        expect(deriveSignupProvider(null)).toBe('unknown');
        expect(deriveSignupProvider(undefined)).toBe('unknown');
    });
});

describe('captureSignupCompleted', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('captures sign_up_completed keyed on the user id with the derived auth_method', () => {
        captureSignupCompleted({
            userId: 'user-1',
            context: { path: '/callback/:id', params: { id: 'google' } }
        });

        expect(mockPostHogCapture).toHaveBeenCalledWith({
            distinctId: 'user-1',
            event: 'sign_up_completed',
            properties: {
                auth_method: 'google',
                role: 'USER',
                user_type: 'tourist'
            }
        });
    });

    it('captures auth_method "email" for an email signup', () => {
        captureSignupCompleted({ userId: 'user-1', context: { path: '/sign-up/email' } });

        expect(mockPostHogCapture).toHaveBeenCalledWith({
            distinctId: 'user-1',
            event: 'sign_up_completed',
            properties: {
                auth_method: 'email',
                role: 'USER',
                user_type: 'tourist'
            }
        });
    });

    it('never throws when the PostHog client is unavailable (returns null)', () => {
        mockGetPostHogClient.mockReturnValueOnce(null as never);

        expect(() =>
            captureSignupCompleted({ userId: 'user-1', context: { path: '/sign-up/email' } })
        ).not.toThrow();
    });

    it('swallows a throwing capture so signup never fails', () => {
        mockPostHogCapture.mockImplementationOnce(() => {
            throw new Error('posthog down');
        });

        expect(() =>
            captureSignupCompleted({ userId: 'user-1', context: { path: '/sign-up/email' } })
        ).not.toThrow();
    });
});
