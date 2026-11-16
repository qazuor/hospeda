/**
 * @file auth-signup-analytics-visitor.test.ts
 * @description signup_completed carries the visitor IP/UA taken from the Better Auth
 * hook context headers (HOS-2119, T-072).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureSpy } = vi.hoisted(() => ({ captureSpy: vi.fn() }));

vi.mock('../../src/lib/analytics-client', () => ({ captureServerAnalyticsEvent: captureSpy }));
vi.mock('@repo/logger', () => ({
    createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() })
}));

import { captureSignupCompleted } from '../../src/lib/auth-signup-analytics';
import { markHeadersAsNotVisitor } from '../../src/utils/visitor-context';

const HEADERS = { 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'UA/1' };

describe('captureSignupCompleted visitor', () => {
    beforeEach(() => {
        captureSpy.mockClear();
    });

    it('should pass the visitor from context.headers', () => {
        captureSignupCompleted({
            userId: 'u1',
            context: { path: '/sign-up/email', headers: new Headers(HEADERS) }
        });
        expect(captureSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                distinctId: 'u1',
                name: 'sign_up_completed',
                visitor: { ip: '203.0.113.7', userAgent: 'UA/1' }
            })
        );
    });

    it('should fall back to context.request.headers', () => {
        captureSignupCompleted({
            userId: 'u1',
            context: { path: '/callback/:id', request: { headers: new Headers(HEADERS) } }
        });
        expect(captureSpy.mock.calls[0]?.[0].visitor).toEqual({
            ip: '203.0.113.7',
            userAgent: 'UA/1'
        });
    });

    it('should omit visitor when no headers are reachable', () => {
        captureSignupCompleted({ userId: 'u1', context: { path: '/sign-up/email' } });
        expect(captureSpy).toHaveBeenCalledTimes(1);
        expect(captureSpy.mock.calls[0]?.[0]).not.toHaveProperty('visitor');
    });

    it('should omit visitor when the user agent header is missing', () => {
        captureSignupCompleted({
            userId: 'u1',
            context: { headers: new Headers({ 'cf-connecting-ip': '1.1.1.1' }) }
        });
        expect(captureSpy.mock.calls[0]?.[0]).not.toHaveProperty('visitor');
    });

    it('should omit visitor for a staff-initiated signup (marked headers)', () => {
        captureSignupCompleted({
            userId: 'u1',
            context: {
                path: '/sign-up/email',
                headers: markHeadersAsNotVisitor({ headers: new Headers(HEADERS) })
            }
        });
        expect(captureSpy).toHaveBeenCalledTimes(1);
        expect(captureSpy.mock.calls[0]?.[0]).not.toHaveProperty('visitor');
    });
});
