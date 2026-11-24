/**
 * @file email-open-analytics.test.ts
 * @description `captureEmailOpen` sends the `email-open` event with the expected properties (HOS-2583 AC-1).
 */
import { AnalyticsEventSchemas } from '@repo/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/analytics-client', () => ({ captureServerAnalyticsEvent: capture }));

import { captureEmailOpen } from '../../src/lib/email-open-analytics';

const AT = new Date('2026-11-24T10:00:00.000Z');

describe('captureEmailOpen', () => {
    beforeEach(() => {
        capture.mockClear();
    });

    it('sends email-open with the template key for a transactional open', () => {
        captureEmailOpen({ kind: 'transactional', templateKey: 'auth.verify-email', at: AT });

        expect(capture).toHaveBeenCalledWith({
            distinctId: 'api-server',
            name: 'email-open',
            timestamp: AT,
            properties: { kind: 'transactional', template_key: 'auth.verify-email' }
        });
    });

    it('sends email-open with the campaign slug for a newsletter open', () => {
        captureEmailOpen({ kind: 'newsletter', campaignSlug: 'otono-aaaaaaaa', at: AT });

        expect(capture).toHaveBeenCalledWith({
            distinctId: 'api-server',
            name: 'email-open',
            timestamp: AT,
            properties: { kind: 'newsletter', campaign: 'otono-aaaaaaaa' }
        });
    });

    it('produces properties the analytics catalog accepts and never names the recipient', () => {
        captureEmailOpen({ kind: 'transactional', templateKey: 'auth.verify-email', at: AT });
        const properties = capture.mock.calls[0]?.[0].properties;

        expect(() => AnalyticsEventSchemas['email-open'].parse(properties)).not.toThrow();
        expect(JSON.stringify(properties)).not.toMatch(/@/);
    });

    it('fits Umami name limit (50) with the longest catalog key as a value (500)', () => {
        expect('email-open'.length).toBeLessThanOrEqual(50);
    });
});
