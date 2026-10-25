import { describe, expect, it } from 'vitest';
import { deriveAnalyticsEventUuid, uuidv5 } from '../../src/lib/analytics-event-uuid.js';

describe('analytics event UUID (TEST:1878:2a, TEST:1878:2b)', () => {
    it('matches the RFC UUIDv5 DNS namespace vector', () => {
        expect(uuidv5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
            '2ed6657d-e927-568b-95e1-2665a8aea6a2'
        );
    });
    it('is deterministic for the same event and dedupe key', () => {
        const input = { event: 'billing_checkout_started', dedupeKey: 'sub-1' };
        expect(deriveAnalyticsEventUuid(input)).toBe(deriveAnalyticsEventUuid(input));
    });
    it('includes the event name in the UUID (TEST:1878:2a)', () => {
        const key = 'same-id';
        expect(
            deriveAnalyticsEventUuid({ event: 'billing_charge_succeeded', dedupeKey: key })
        ).not.toBe(deriveAnalyticsEventUuid({ event: 'billing_charge_declined', dedupeKey: key }));
    });
});
