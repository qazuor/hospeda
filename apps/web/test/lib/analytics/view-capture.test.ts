/**
 * @file view-capture.test.ts
 * @description Unit tests for the `sendViewBeacon` utility (SPEC-159 T-012).
 *
 * Covers:
 *  - Calls `navigator.sendBeacon` with correct URL and JSON Blob payload.
 *  - Falls back to `fetch` with `keepalive: true` when sendBeacon is absent.
 *  - Falls back to `fetch` when sendBeacon returns false.
 *  - Never throws when both sendBeacon and fetch fail.
 *  - SSR guard: no-op when `navigator` is undefined.
 */

import { sendViewBeacon } from '@/lib/analytics/view-capture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// Vitest runs in jsdom so `import.meta.env` is available but PUBLIC_API_URL
// is undefined by default. We set a test value here via the global env stub.
vi.stubEnv('PUBLIC_API_URL', 'http://localhost:3001');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPECTED_URL = 'http://localhost:3001/api/v1/public/views';

const SAMPLE_INPUT = {
    entityType: 'ACCOMMODATION' as const,
    entityId: '550e8400-e29b-41d4-a716-446655440000'
};

const EXPECTED_PAYLOAD = JSON.stringify({
    entityType: SAMPLE_INPUT.entityType,
    entityId: SAMPLE_INPUT.entityId
});

/**
 * Read a Blob's text content via FileReader (works in jsdom which lacks
 * Blob.text() and Response(Blob) body streaming support).
 */
function blobText(b: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(b);
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendViewBeacon (SPEC-159 T-012)', () => {
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

    // ── sendBeacon happy path ──────────────────────────────────────────────

    describe('when sendBeacon is available and returns true', () => {
        it('calls sendBeacon with the correct URL', () => {
            // Arrange
            const beaconSpy = vi.fn().mockReturnValue(true);
            navigator.sendBeacon = beaconSpy;

            // Act
            sendViewBeacon(SAMPLE_INPUT);

            // Assert
            expect(beaconSpy).toHaveBeenCalledTimes(1);
            expect(beaconSpy.mock.calls[0]?.[0]).toBe(EXPECTED_URL);
        });

        it('passes a Blob body typed application/json with the correct JSON payload', async () => {
            // Arrange
            const beaconSpy = vi.fn().mockReturnValue(true);
            navigator.sendBeacon = beaconSpy;

            // Act
            sendViewBeacon(SAMPLE_INPUT);

            // Assert — body is a Blob
            const body = beaconSpy.mock.calls[0]?.[1] as Blob;
            expect(body).toBeInstanceOf(Blob);
            expect(body.type).toBe('application/json');
            expect(await blobText(body)).toBe(EXPECTED_PAYLOAD);
        });

        it('does not call fetch when sendBeacon succeeds', () => {
            // Arrange
            navigator.sendBeacon = vi.fn().mockReturnValue(true);
            const fetchSpy = vi.fn();
            globalThis.fetch = fetchSpy;

            // Act
            sendViewBeacon(SAMPLE_INPUT);

            // Assert
            expect(fetchSpy).not.toHaveBeenCalled();
        });
    });

    // ── sendBeacon fallback: returns false ─────────────────────────────────

    describe('when sendBeacon returns false (queue full)', () => {
        it('falls back to fetch with keepalive and correct headers', async () => {
            // Arrange
            navigator.sendBeacon = vi.fn().mockReturnValue(false);
            const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
            globalThis.fetch = fetchSpy;

            // Act
            sendViewBeacon(SAMPLE_INPUT);

            // Assert
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const [calledUrl, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(EXPECTED_URL);
            expect(options.method).toBe('POST');
            expect(options.keepalive).toBe(true);
            expect((options.headers as Record<string, string>)['Content-Type']).toBe(
                'application/json'
            );
            expect(options.body).toBe(EXPECTED_PAYLOAD);
        });
    });

    // ── sendBeacon unavailable ─────────────────────────────────────────────

    describe('when sendBeacon is not available', () => {
        it('falls back to fetch keepalive', () => {
            // Arrange — remove sendBeacon entirely
            (navigator as unknown as { sendBeacon: undefined }).sendBeacon =
                undefined as unknown as typeof navigator.sendBeacon;
            const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
            globalThis.fetch = fetchSpy;

            // Act
            sendViewBeacon(SAMPLE_INPUT);

            // Assert
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const [calledUrl, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
            expect(calledUrl).toBe(EXPECTED_URL);
            expect(options.keepalive).toBe(true);
        });
    });

    // ── Never-throw guarantee ──────────────────────────────────────────────

    describe('error resilience', () => {
        it('does not throw when sendBeacon throws', () => {
            // Arrange
            navigator.sendBeacon = vi.fn().mockImplementation(() => {
                throw new Error('sendBeacon exploded');
            });
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch also failed'));

            // Act / Assert
            expect(() => sendViewBeacon(SAMPLE_INPUT)).not.toThrow();
        });

        it('does not throw when fetch rejects', () => {
            // Arrange
            navigator.sendBeacon = vi.fn().mockReturnValue(false);
            globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error'));

            // Act / Assert — the unhandled promise rejection from fetch is caught
            // internally; the synchronous call must not throw.
            expect(() => sendViewBeacon(SAMPLE_INPUT)).not.toThrow();
        });

        it('does not throw when both sendBeacon and fetch are unavailable', () => {
            // Arrange
            (navigator as unknown as { sendBeacon: undefined }).sendBeacon =
                undefined as unknown as typeof navigator.sendBeacon;
            (globalThis as unknown as { fetch: undefined }).fetch =
                undefined as unknown as typeof globalThis.fetch;

            // Act / Assert
            expect(() => sendViewBeacon(SAMPLE_INPUT)).not.toThrow();
        });
    });

    // ── SSR guard ─────────────────────────────────────────────────────────

    describe('SSR safety', () => {
        it('is a no-op when navigator is undefined (server environment)', () => {
            // Arrange — simulate SSR by temporarily hiding navigator
            const beaconSpy = vi.fn().mockReturnValue(true);
            const savedNavigator = globalThis.navigator;
            // biome-ignore lint/performance/noDelete: required to simulate SSR absence
            delete (globalThis as unknown as { navigator?: unknown }).navigator;

            // Act / Assert
            expect(() => sendViewBeacon(SAMPLE_INPUT)).not.toThrow();
            expect(beaconSpy).not.toHaveBeenCalled();

            // Restore
            globalThis.navigator = savedNavigator;
        });
    });

    // ── Payload correctness for all entity types ───────────────────────────

    describe('entity type variants', () => {
        it.each([['ACCOMMODATION' as const], ['POST' as const], ['EVENT' as const]])(
            'sends correct entityType for %s',
            async (entityType) => {
                // Arrange
                const beaconSpy = vi.fn().mockReturnValue(true);
                navigator.sendBeacon = beaconSpy;

                // Act
                sendViewBeacon({ entityType, entityId: 'abc-123' });

                // Assert
                const blob = beaconSpy.mock.calls[0]?.[1] as Blob;
                const parsed = JSON.parse(await blobText(blob)) as { entityType: string };
                expect(parsed.entityType).toBe(entityType);
            }
        );
    });
});
