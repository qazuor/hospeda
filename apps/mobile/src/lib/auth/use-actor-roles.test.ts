/**
 * @file use-actor-roles.test.ts
 * @description Unit tests for the `/auth/me` role-set derivation (HOS-296).
 *
 * The mobile Vitest setup runs in the `node` environment with no React
 * renderer (see `vitest.config.ts`), so the hook itself is not rendered. The
 * decision logic lives in the pure `deriveActorRoles` for exactly that reason
 * and is asserted directly here; `apiFetch` is exercised against a mocked
 * `fetch` to pin the wire contract the hook depends on.
 *
 * Coverage:
 * - `isAuthenticated === true` is the ONLY branch that yields roles.
 * - A 200 guest response (`/auth/me` is `skipAuth`, so an invalid session is
 *   200, never 401) yields NO roles.
 * - A background-refetch failure that still has data stays `ready`, so a host
 *   is not kicked out of `(host)`.
 * - A failure with no data at all is `error`.
 * - `AuthMeResponseSchema` accepts the multi-role actor payload.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports (Vitest hoisting)
// ---------------------------------------------------------------------------

vi.mock('../auth-client', () => ({
    getCookie: vi.fn(() => '')
}));

vi.mock('expo-constants', () => ({
    default: {
        expoConfig: {
            extra: { apiUrl: 'http://test-api.local' }
        }
    }
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import type { AuthMeResponse } from '@repo/schemas';
import { AuthMeResponseSchema } from '@repo/schemas';
import { apiFetch } from '../api/client';
import { deriveActorRoles } from './use-actor-roles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFetchResponse = (body: unknown, status = 200): Response => {
    const bodyStr = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => JSON.parse(bodyStr) as unknown,
        text: async () => bodyStr
    } as Response;
};

/** An authenticated actor holding several hats. */
const makeAuthenticatedPayload = (roles: readonly string[]): AuthMeResponse => ({
    actor: {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        roles: [...roles],
        permissions: [],
        email: 'host@example.com'
    },
    isAuthenticated: true,
    passwordChangeRequired: false
});

/** The shape `/auth/me` returns for an invalid/absent session: 200 + guest. */
const makeGuestPayload = (): AuthMeResponse => ({
    actor: {
        id: 'guest',
        roles: ['GUEST'],
        permissions: []
    },
    isAuthenticated: false
});

// ---------------------------------------------------------------------------
// deriveActorRoles
// ---------------------------------------------------------------------------

describe('deriveActorRoles — disabled (no user id)', () => {
    it('reports ready with no roles rather than loading', () => {
        // Arrange / Act
        const state = deriveActorRoles({ enabled: false, data: undefined, isError: false });

        // Assert — the gate must not wait on a request that will never be made.
        expect(state.status).toBe('ready');
        expect(state.roles).toEqual([]);
        expect(state.isAuthenticated).toBe(false);
    });
});

describe('deriveActorRoles — in flight', () => {
    it('reports loading while nothing has resolved', () => {
        const state = deriveActorRoles({ enabled: true, data: undefined, isError: false });

        expect(state.status).toBe('loading');
        expect(state.roles).toEqual([]);
    });
});

describe('deriveActorRoles — authenticated', () => {
    it('returns the full role set when isAuthenticated is true', () => {
        const state = deriveActorRoles({
            enabled: true,
            data: makeAuthenticatedPayload(['USER', 'HOST', 'COMMERCE_OWNER']),
            isError: false
        });

        expect(state.status).toBe('ready');
        expect(state.isAuthenticated).toBe(true);
        expect(state.roles).toEqual(['USER', 'HOST', 'COMMERCE_OWNER']);
    });

    it('keeps the resolved role set when a BACKGROUND refetch fails', () => {
        // TanStack Query reports status 'error' while still serving the last
        // payload. Treating that as an error would evict a host from (host).
        const state = deriveActorRoles({
            enabled: true,
            data: makeAuthenticatedPayload(['HOST']),
            isError: true
        });

        expect(state.status).toBe('ready');
        expect(state.roles).toEqual(['HOST']);
    });
});

describe('deriveActorRoles — guest response (the skipAuth trap)', () => {
    it('yields NO roles when the server reports isAuthenticated false', () => {
        // `/auth/me` runs with skipAuth: an invalid session is HTTP 200 with a
        // guest actor. Gating on `response.ok` would let this through.
        const state = deriveActorRoles({
            enabled: true,
            data: makeGuestPayload(),
            isError: false
        });

        expect(state.isAuthenticated).toBe(false);
        expect(state.roles).toEqual([]);
        expect(state.status).toBe('ready');
    });

    it('does not surface the guest actor roles array', () => {
        const state = deriveActorRoles({
            enabled: true,
            data: makeGuestPayload(),
            isError: false
        });

        expect(state.roles).not.toContain('GUEST');
    });
});

describe('deriveActorRoles — failed with no data', () => {
    it('reports error so the gate can fall back to least privilege', () => {
        const state = deriveActorRoles({ enabled: true, data: undefined, isError: true });

        expect(state.status).toBe('error');
        expect(state.roles).toEqual([]);
        expect(state.isAuthenticated).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Wire contract
// ---------------------------------------------------------------------------

describe('AuthMeResponseSchema over apiFetch', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('parses a multi-role authenticated actor', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({
                success: true,
                data: makeAuthenticatedPayload(['USER', 'HOST'])
            })
        );

        const { data } = await apiFetch({
            path: '/api/v1/public/auth/me',
            schema: AuthMeResponseSchema
        });

        expect(data.isAuthenticated).toBe(true);
        expect(data.actor.roles).toEqual(['USER', 'HOST']);
    });

    it('parses the guest payload without throwing', async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            makeFetchResponse({ success: true, data: makeGuestPayload() })
        );

        const { data } = await apiFetch({
            path: '/api/v1/public/auth/me',
            schema: AuthMeResponseSchema
        });

        expect(data.isAuthenticated).toBe(false);
    });

    it('rejects a payload that still carries a scalar role instead of a set', () => {
        // Regression guard: the pre-HOS-296 shape must not silently parse.
        const legacy = {
            actor: { id: 'x', role: 'HOST', permissions: [] },
            isAuthenticated: true
        };

        const result = AuthMeResponseSchema.safeParse(legacy);

        expect(result.success).toBe(false);
    });
});
