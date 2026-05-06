import { describe, expect, it } from 'vitest';
import { getExpiryStatus } from '../../src/lib/format-expires';

const MS_PER_DAY = 86_400_000;
const NOW = 1_746_000_000_000;

describe('getExpiryStatus', () => {
    it('returns active with null daysRemaining when expiresAt is undefined', () => {
        const result = getExpiryStatus({ now: NOW });
        expect(result).toEqual({ status: 'active', daysRemaining: null });
    });

    it('returns active with null daysRemaining when expiresAt is null', () => {
        const result = getExpiryStatus({ expiresAt: null, now: NOW });
        expect(result).toEqual({ status: 'active', daysRemaining: null });
    });

    it('returns active with null daysRemaining when expiresAt is an unparseable string', () => {
        const result = getExpiryStatus({ expiresAt: 'not-a-date', now: NOW });
        expect(result).toEqual({ status: 'active', daysRemaining: null });
    });

    it('returns expired when expiresAt is in the past (diffMs < 0)', () => {
        const expiresAt = new Date(NOW - MS_PER_DAY).toISOString();
        const result = getExpiryStatus({ expiresAt, now: NOW });
        expect(result.status).toBe('expired');
        expect(result.daysRemaining).toBe(-1);
    });

    it('returns expired when diffMs is exactly 0 (same millisecond)', () => {
        const expiresAt = new Date(NOW).toISOString();
        const result = getExpiryStatus({ expiresAt, now: NOW });
        expect(result.status).toBe('expired');
        expect(result.daysRemaining).toBe(0);
    });

    it('returns expiring-soon when 0 < daysRemaining < 7', () => {
        const expiresAt = new Date(NOW + 3 * MS_PER_DAY).toISOString();
        const result = getExpiryStatus({ expiresAt, now: NOW });
        expect(result.status).toBe('expiring-soon');
        expect(result.daysRemaining).toBe(3);
    });

    it('returns expiring-soon when exactly 6 days remain', () => {
        const expiresAt = new Date(NOW + 6 * MS_PER_DAY + MS_PER_DAY / 2).toISOString();
        const result = getExpiryStatus({ expiresAt, now: NOW });
        expect(result.status).toBe('expiring-soon');
        expect(result.daysRemaining).toBe(6);
    });

    it('returns active when daysRemaining >= 7', () => {
        const expiresAt = new Date(NOW + 7 * MS_PER_DAY + 1).toISOString();
        const result = getExpiryStatus({ expiresAt, now: NOW });
        expect(result.status).toBe('active');
        expect(result.daysRemaining).toBe(7);
    });

    it('accepts a Date instance as expiresAt', () => {
        const expiresAt = new Date(NOW + 2 * MS_PER_DAY);
        const result = getExpiryStatus({ expiresAt, now: NOW });
        expect(result.status).toBe('expiring-soon');
        expect(result.daysRemaining).toBe(2);
    });
});
