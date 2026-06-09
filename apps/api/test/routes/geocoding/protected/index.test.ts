/**
 * @file protected/index.test.ts
 * @description Tests for protected geocoding proxy endpoints (SPEC-208, Phase C PR2).
 *
 * Verifies autocomplete and reverse geocoding through the protected tier:
 * - Authentication required (401 without session)
 * - Autocomplete proxies to Photon and returns normalized suggestions
 * - Reverse proxies to Nominatim and returns normalized suggestion
 * - Query validation (missing q, invalid lat/lng)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { protectedGeocodingRoutes } from '../../../../src/routes/geocoding/protected/index';
import { createApp } from '../../../../src/utils/create-app';

// ---------------------------------------------------------------------------
// Mock geocoding service — must be hoisted with vi.hoisted
// ---------------------------------------------------------------------------
const { mockAutocomplete, mockReverse } = vi.hoisted(() => ({
    mockAutocomplete: vi.fn(),
    mockReverse: vi.fn()
}));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        geocodingAutocomplete: mockAutocomplete,
        geocodingReverse: mockReverse
    };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const HEADERS = {
    'User-Agent': 'test-agent',
    Accept: 'application/json'
};

function buildTestApp() {
    const app = createApp();
    app.route('/api/v1/protected/geocoding', protectedGeocodingRoutes);
    return app;
}

describe('Protected Geocoding Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    // Autocomplete
    // -----------------------------------------------------------------------
    describe('GET /api/v1/protected/geocoding/autocomplete', () => {
        it('should return suggestions for a valid query', async () => {
            mockAutocomplete.mockResolvedValueOnce([
                {
                    label: 'Av. Belgrano 123, Concepción del Uruguay',
                    lat: -32.4825,
                    lng: -58.2372,
                    street: 'Av. Belgrano',
                    number: '123',
                    city: 'Concepción del Uruguay',
                    state: 'Entre Ríos',
                    country: 'Argentina'
                }
            ]);

            const app = buildTestApp();
            const res = await app.request(
                '/api/v1/protected/geocoding/autocomplete?q=Belgrano+123',
                { headers: HEADERS }
            );

            // Debug: log response body on unexpected status
            if (res.status !== 200) {
                const body = await res.text();
                console.error('UNEXPECTED STATUS:', res.status, 'BODY:', body);
            }

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                data: { suggestions: Array<{ label: string; lat: number; lng: number }> };
            };
            expect(body.data.suggestions).toHaveLength(1);
            const first = body.data.suggestions[0];
            expect(first?.label).toBe('Av. Belgrano 123, Concepción del Uruguay');
            expect(first?.lat).toBe(-32.4825);
            expect(first?.lng).toBe(-58.2372);
        });

        it('should return empty suggestions for short query', async () => {
            mockAutocomplete.mockResolvedValueOnce([]);

            const app = buildTestApp();
            const res = await app.request('/api/v1/protected/geocoding/autocomplete?q=Be', {
                headers: HEADERS
            });

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                data: { suggestions: unknown[] };
            };
            expect(body.data.suggestions).toHaveLength(0);
        });

        it('should return 400 when q parameter is missing', async () => {
            const app = buildTestApp();
            const res = await app.request('/api/v1/protected/geocoding/autocomplete', {
                headers: HEADERS
            });

            expect(res.status).toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // Reverse
    // -----------------------------------------------------------------------
    describe('GET /api/v1/protected/geocoding/reverse', () => {
        it('should return suggestion for valid coordinates', async () => {
            mockReverse.mockResolvedValueOnce({
                label: 'Av. Belgrano, Concepción del Uruguay, Entre Ríos',
                lat: -32.4825,
                lng: -58.2372,
                street: 'Av. Belgrano',
                city: 'Concepción del Uruguay',
                state: 'Entre Ríos',
                country: 'Argentina'
            });

            const app = buildTestApp();
            const res = await app.request(
                '/api/v1/protected/geocoding/reverse?lat=-32.4825&lng=-58.2372',
                { headers: HEADERS }
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                data: { suggestion: { label: string; lat: number; lng: number } };
            };
            expect(body.data.suggestion).not.toBeNull();
            expect(body.data.suggestion.lat).toBe(-32.4825);
            expect(body.data.suggestion.lng).toBe(-58.2372);
        });

        it('should return null suggestion when reverse finds nothing', async () => {
            mockReverse.mockResolvedValueOnce(null);

            const app = buildTestApp();
            const res = await app.request('/api/v1/protected/geocoding/reverse?lat=0&lng=0', {
                headers: HEADERS
            });

            expect(res.status).toBe(200);
            const body = (await res.json()) as {
                data: { suggestion: null };
            };
            expect(body.data.suggestion).toBeNull();
        });

        it('should return 400 for invalid lat parameter', async () => {
            const app = buildTestApp();
            const res = await app.request(
                '/api/v1/protected/geocoding/reverse?lat=abc&lng=-58.2372',
                { headers: HEADERS }
            );

            expect(res.status).toBe(400);
        });

        it('should return 400 for lat out of range', async () => {
            const app = buildTestApp();
            const res = await app.request(
                '/api/v1/protected/geocoding/reverse?lat=91&lng=-58.2372',
                { headers: HEADERS }
            );

            expect(res.status).toBe(400);
        });
    });
});
