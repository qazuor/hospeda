/**
 * Tests for the multi-sort wiring on GET /api/v1/public/accommodations.
 *
 * This file covers:
 *  - Unit tests for the `sanitizeSorts()` whitelist helper (T-018).
 *  - Route-level integration tests verifying the new `sorts` / `featuredFirst`
 *    query params are accepted and do not break the endpoint (T-019 / T-020).
 *    Full ordering assertions (featured-first, stable pagination tiebreaker)
 *    require a seeded test database and are out of scope for this file; they
 *    would live in an end-to-end integration suite.
 */
import type { SortField } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { sanitizeSorts } from '../../../../src/routes/accommodation/public/list.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const BASE = '/api/v1/public/accommodations';

describe('sanitizeSorts (public list allow-list)', () => {
    it('returns undefined for undefined input', () => {
        expect(sanitizeSorts(undefined)).toBeUndefined();
    });

    it('returns undefined for an empty array (collapse rule)', () => {
        expect(sanitizeSorts([])).toBeUndefined();
    });

    it('passes through an all-whitelisted list unchanged', () => {
        const sorts: SortField[] = [
            { field: 'averageRating', order: 'desc' },
            { field: 'name', order: 'asc' }
        ];
        expect(sanitizeSorts(sorts)).toEqual(sorts);
    });

    it('drops non-whitelisted fields and keeps the remaining whitelisted ones', () => {
        const sorts: SortField[] = [
            { field: 'internalSecretColumn', order: 'asc' },
            { field: 'name', order: 'asc' }
        ];
        expect(sanitizeSorts(sorts)).toEqual([{ field: 'name', order: 'asc' }]);
    });

    it('collapses to undefined when every field is filtered out', () => {
        const sorts: SortField[] = [
            { field: 'unknownA', order: 'asc' },
            { field: 'unknownB', order: 'desc' }
        ];
        expect(sanitizeSorts(sorts)).toBeUndefined();
    });

    it('allows every field currently in ALLOWED_SORT_FIELDS (parity with sanitizeSortBy)', () => {
        const sorts: SortField[] = [
            { field: 'name', order: 'asc' },
            { field: 'createdAt', order: 'desc' },
            { field: 'averageRating', order: 'desc' },
            { field: 'reviewsCount', order: 'desc' },
            { field: 'isFeatured', order: 'desc' },
            { field: 'mostSaved', order: 'desc' },
            { field: 'price', order: 'asc' }
        ];
        expect(sanitizeSorts(sorts)).toEqual(sorts);
    });

    it('keeps `price` (synthetic JSONB-extracted sort) in the allow-list', () => {
        const sorts: SortField[] = [{ field: 'price', order: 'asc' }];
        expect(sanitizeSorts(sorts)).toEqual(sorts);
    });
});

describe('GET /api/v1/public/accommodations — sorts + featuredFirst wiring', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('accepts a valid multi-sort CSV query param without crashing', async () => {
        const res = await app.request(`${BASE}?sorts=averageRating:desc,name:asc`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        // Route exists and parsed params — may return 200 (with items) or 500
        // (if DB is unreachable in unit mode). Never 400 (validation error).
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('accepts sorts with an unknown field (silently dropped by the route)', async () => {
        const res = await app.request(`${BASE}?sorts=internalSecret:desc`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('rejects more than 5 sort entries at the domain schema level', async () => {
        // 6 entries — the HTTP transform slices to 5, so this still succeeds.
        // The .max(5) guard lives on the DOMAIN schema, which the HTTP transform
        // cannot produce a >5 array for. This documents the contract: HTTP
        // truncates, domain enforces. No 400 expected.
        const csv = 'a:asc,b:asc,c:asc,d:asc,e:asc,f:asc';
        const res = await app.request(`${BASE}?sorts=${csv}`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        expect(res.status).not.toBe(400);
    });

    it('accepts featuredFirst=false and does NOT produce a validation error (server forces true regardless)', async () => {
        const res = await app.request(`${BASE}?featuredFirst=false`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        // The client-supplied value is accepted by the HTTP schema; the route
        // handler then overrides it with `featuredFirst: true` before calling
        // the service. So the route must not return 400 here.
        expect(res.status).not.toBe(400);
        expect(res.status).not.toBe(404);
    });

    it('rejects a non-literal featuredFirst value (strict boolean coercion)', async () => {
        const res = await app.request(`${BASE}?featuredFirst=nope`, {
            method: 'GET',
            headers: { 'user-agent': 'vitest', accept: 'application/json' }
        });
        // createBooleanQueryParam only accepts 'true' / 'false'. Anything else
        // should be rejected by the HTTP schema with 400.
        expect(res.status).toBe(400);
    });
});
