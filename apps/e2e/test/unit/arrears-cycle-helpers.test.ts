import type { FakeProviderRequest } from '@repo/payments/fake-server';
import { describe, expect, it } from 'vitest';
import {
    type CronData,
    cancelRequestsFor,
    expiryMinusPauseMargin,
    formatMarketDate,
    sweepFailedIds
} from '../../fixtures/arrears-cycle.ts';

describe('HOS-1565', () => {
    it('selects only cancelled PUTs for the requested authorization', () => {
        const requests: FakeProviderRequest[] = [
            {
                method: 'PUT',
                path: '/preapproval/auth-a',
                body: { status: 'cancelled' },
                at: new Date(0).toISOString()
            },
            {
                method: 'PUT',
                path: '/preapproval/auth-b',
                body: { status: 'cancelled' },
                at: new Date(0).toISOString()
            },
            {
                method: 'POST',
                path: '/preapproval/auth-a',
                body: { status: 'cancelled' },
                at: new Date(0).toISOString()
            },
            {
                method: 'PUT',
                path: '/preapproval/auth-a',
                body: { status: 'paused' },
                at: new Date(0).toISOString()
            }
        ];
        const result = cancelRequestsFor({ requests, authorizationId: 'auth-a' });

        expect(result).toEqual([requests[0]]);
    });

    it('formats a near-midnight instant by the Buenos Aires market date', () => {
        const result = formatMarketDate(new Date('2026-10-15T02:30:00.000Z'));

        expect(result).toBe('14 de octubre de 2026');
    });

    it('stops between the provider pause threshold and expiry', () => {
        const expiresAt = new Date('2026-10-25T12:00:00.000Z');
        const result = expiryMinusPauseMargin({ expiresAt });

        expect(result.getTime()).toBe(expiresAt.getTime() - 30_000);
        expect(result.getTime()).toBeGreaterThan(expiresAt.getTime() - 90_000);
        expect(result.getTime()).toBeLessThan(expiresAt.getTime());
    });

    it('rejects an expiry that cannot define a valid pause window', () => {
        expect(() => expiryMinusPauseMargin({ expiresAt: new Date(Number.NaN) })).toThrow(
            'must fall strictly after provider pause and before expiry'
        );
    });

    it('reads failed IDs when details are absent, omit the key, or contain IDs', () => {
        const noDetails: CronData = {};
        const noIds: CronData = { details: {} };
        const withIds: CronData = { details: { failedSubscriptionIds: ['sub-a', 'sub-b'] } };

        expect(sweepFailedIds(noDetails)).toEqual([]);
        expect(sweepFailedIds(noIds)).toEqual([]);
        expect(sweepFailedIds(withIds)).toEqual(['sub-a', 'sub-b']);
    });
});
