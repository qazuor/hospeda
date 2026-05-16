/**
 * Unit tests for the trial-pre-end-notif cron job (SPEC-126 D5).
 *
 * Covers:
 * - Pure helpers: computeDaysRemaining, selectVariant, variantToEventType,
 *   buildUpgradeUrl.
 * - Job definition shape (name, schedule, enabled flag).
 *
 * Integration of the cron handler against a real DB is intentionally out
 * of scope for this unit suite — the helpers exposed via `_internals`
 * cover the variant-selection logic which is the meaningful logic that
 * could regress silently.
 *
 * @module test/cron/trial-pre-end-notif
 */

import { describe, expect, it } from 'vitest';
import { _internals, trialPreEndNotifJob } from '../../src/cron/jobs/trial-pre-end-notif.job';

const { computeDaysRemaining, selectVariant, variantToEventType, buildUpgradeUrl, ONE_DAY_MS } =
    _internals;

describe('computeDaysRemaining', () => {
    const now = new Date('2026-05-15T12:00:00.000Z');

    it('returns 3 for a trial ending in exactly 3 days', () => {
        const end = new Date(now.getTime() + 3 * ONE_DAY_MS);
        expect(computeDaysRemaining(end, now)).toBe(3);
    });

    it('returns 1 for a trial ending in exactly 1 day', () => {
        const end = new Date(now.getTime() + ONE_DAY_MS);
        expect(computeDaysRemaining(end, now)).toBe(1);
    });

    it('rounds UP partial days so 36h surfaces as 2 (not 1)', () => {
        const end = new Date(now.getTime() + 36 * 60 * 60 * 1000);
        expect(computeDaysRemaining(end, now)).toBe(2);
    });

    it('clamps to 0 when trialEnd is in the past', () => {
        const end = new Date(now.getTime() - ONE_DAY_MS);
        expect(computeDaysRemaining(end, now)).toBe(0);
    });

    it('returns 0 when trialEnd equals now', () => {
        expect(computeDaysRemaining(now, now)).toBe(0);
    });
});

describe('selectVariant', () => {
    it('returns D3 for 3 days remaining', () => {
        expect(selectVariant(3)).toBe('D3');
    });

    it('returns D3 for 2 days remaining (early-window catch-up)', () => {
        // The cron may miss a day; using >= 2 instead of === 3 ensures the
        // D-3 reminder still fires when the cron skips a day.
        expect(selectVariant(2)).toBe('D3');
    });

    it('returns D1 for 1 day remaining', () => {
        expect(selectVariant(1)).toBe('D1');
    });

    it('returns null for 0 days remaining (trial-expiry handles this)', () => {
        expect(selectVariant(0)).toBeNull();
    });

    it('returns D3 for any value >= 2 (defense against out-of-window calls)', () => {
        expect(selectVariant(7)).toBe('D3');
    });
});

describe('variantToEventType', () => {
    it('maps D3 to the dedicated event-type constant', () => {
        expect(variantToEventType('D3')).toBe('TRIAL_PRE_END_NOTIF_D3');
    });

    it('maps D1 to the dedicated event-type constant', () => {
        expect(variantToEventType('D1')).toBe('TRIAL_PRE_END_NOTIF_D1');
    });
});

describe('buildUpgradeUrl', () => {
    it('builds a URL pointing at the plans page with UTM attribution for D3', () => {
        const url = buildUpgradeUrl('D3');
        expect(url).toContain('/cuenta/planes');
        expect(url).toContain('utm_source=email');
        expect(url).toContain('utm_medium=lifecycle');
        expect(url).toContain('utm_campaign=trial-d3');
    });

    it('uses a distinct utm_campaign for the D1 variant for attribution', () => {
        const url = buildUpgradeUrl('D1');
        expect(url).toContain('utm_campaign=trial-d1');
    });
});

describe('trialPreEndNotifJob definition', () => {
    it('is registered with the expected name', () => {
        expect(trialPreEndNotifJob.name).toBe('trial-pre-end-notif');
    });

    it('runs daily at 13:00 UTC (10:00 AR)', () => {
        expect(trialPreEndNotifJob.schedule).toBe('0 13 * * *');
    });

    it('is enabled by default', () => {
        expect(trialPreEndNotifJob.enabled).toBe(true);
    });

    it('uses a 5-minute timeout', () => {
        expect(trialPreEndNotifJob.timeoutMs).toBe(5 * 60 * 1000);
    });

    it('reserves advisory lock key 1005', () => {
        // Sibling billing crons use 1003 (dunning) and 1004 (trial-expiry).
        // Drift here would let two crons share a lock and starve each other.
        expect(_internals.ADVISORY_LOCK_KEY).toBe(1005);
    });
});
