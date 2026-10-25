import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsFactSink } from '../../../src/utils/analytics/analytics-facts.js';

describe('analytics facts (TEST:1878:15, TEST:1878:16)', () => {
    it('does not propagate a failed capture', () => {
        const capture = vi.fn(() => {
            throw new Error('offline');
        });
        const sink = createAnalyticsFactSink({ capture });
        expect(() =>
            sink.emit({
                kind: 'TRIAL_STARTED',
                userId: 'u-1',
                vertical: 'accommodation',
                trialId: 't-1',
                activationEvent: 'listing_published',
                occurredAt: new Date('2026-01-01T00:00:00.000Z')
            })
        ).not.toThrow();
        expect(capture).toHaveBeenCalledTimes(1);
    });
    it('maps a trial fact to an idempotent event with its timestamp', () => {
        const capture = vi.fn();
        const occurredAt = new Date('2026-01-01T00:00:00.000Z');
        const sink = createAnalyticsFactSink({ capture });
        sink.emit({
            kind: 'TRIAL_STARTED',
            userId: 'u-1',
            vertical: 'accommodation',
            trialId: 't-1',
            activationEvent: 'listing_published',
            occurredAt
        });
        expect(capture).toHaveBeenCalledWith(
            expect.objectContaining({
                distinctId: 'u-1',
                name: 'trial_started',
                timestamp: occurredAt,
                uuid: expect.any(String),
                properties: {
                    vertical: 'accommodation',
                    actor_kind: 'SYSTEM',
                    activation_event: 'listing_published'
                }
            })
        );
    });
});
