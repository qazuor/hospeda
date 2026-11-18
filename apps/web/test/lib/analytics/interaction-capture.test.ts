/**
 * @file interaction-capture.test.ts
 * @description Unit tests for `sendInteractionBeacon` (HOS-2256).
 *
 * Covers: `sendBeacon` first with the right URL and JSON payload, `eventId`
 * only when given, `fetch(keepalive)` fallback, never throws, SSR no-op.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendInteractionBeacon } from '@/lib/analytics/interaction-capture';

vi.stubEnv('PUBLIC_API_URL', 'http://localhost:3001');

const URL = 'http://localhost:3001/api/v1/public/interactions';
const VENUE = '550e8400-e29b-41d4-a716-446655440000';
const EVENT = '660e8400-e29b-41d4-a716-446655440000';

function blobText(b: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(b);
    });
}

describe('sendInteractionBeacon (HOS-2256)', () => {
    let originalSendBeacon: typeof navigator.sendBeacon;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
        originalSendBeacon = navigator.sendBeacon;
        originalFetch = globalThis.fetch;
    });

    afterEach(() => {
        navigator.sendBeacon = originalSendBeacon;
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('sends the venue and kind through sendBeacon as a JSON blob, without an eventId', async () => {
        const beacon = vi.fn().mockReturnValue(true);
        navigator.sendBeacon = beacon;

        sendInteractionBeacon({ entityId: VENUE, kind: 'PHONE_CLICK' as never });

        expect(beacon).toHaveBeenCalledOnce();
        expect(beacon.mock.calls[0]?.[0]).toBe(URL);
        const blob = beacon.mock.calls[0]?.[1] as Blob;
        expect(blob.type).toBe('application/json');
        expect(JSON.parse(await blobText(blob))).toEqual({
            entityType: 'VENUE',
            entityId: VENUE,
            kind: 'PHONE_CLICK'
        });
    });

    it('includes the eventId when given', async () => {
        const beacon = vi.fn().mockReturnValue(true);
        navigator.sendBeacon = beacon;

        sendInteractionBeacon({ entityId: VENUE, kind: 'TICKET_CLICK' as never, eventId: EVENT });

        const blob = beacon.mock.calls[0]?.[1] as Blob;
        expect(JSON.parse(await blobText(blob))).toMatchObject({ eventId: EVENT });
    });

    it('falls back to fetch with keepalive when sendBeacon returns false', () => {
        navigator.sendBeacon = vi.fn().mockReturnValue(false);
        const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
        globalThis.fetch = fetchSpy;

        sendInteractionBeacon({ entityId: VENUE, kind: 'MAP_CLICK' as never });

        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(fetchSpy.mock.calls[0]?.[0]).toBe(URL);
        expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', keepalive: true });
    });

    it('never throws when sendBeacon and fetch both fail', () => {
        navigator.sendBeacon = vi.fn().mockImplementation(() => {
            throw new Error('beacon down');
        });
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

        expect(() =>
            sendInteractionBeacon({ entityId: VENUE, kind: 'WEBSITE_CLICK' as never })
        ).not.toThrow();
    });

    it('is a no-op when navigator is undefined (SSR)', () => {
        const spy = vi.fn();
        navigator.sendBeacon = spy;
        vi.stubGlobal('navigator', undefined);
        try {
            expect(() =>
                sendInteractionBeacon({ entityId: VENUE, kind: 'PHONE_CLICK' as never })
            ).not.toThrow();
        } finally {
            vi.unstubAllGlobals();
        }
        expect(spy).not.toHaveBeenCalled();
    });
});
