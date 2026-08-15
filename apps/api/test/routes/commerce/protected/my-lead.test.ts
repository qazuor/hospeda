/**
 * Unit tests for `handleGetMyLead` (HOS-257), the owner self-service
 * "my lead" pre-fill read endpoint.
 *
 * Mirrors the mocking style of `host-favorites-breakdown.test.ts` /
 * `start-subscription.test.ts`: `CommerceLeadService` is mocked at the
 * `@repo/service-core` module boundary so the test asserts the route's
 * mapping/degradation behaviour, not the service's own logic (that has its
 * own dedicated suite — `commerce-lead.service.test.ts`).
 *
 * Covers:
 * - Success with a provisioned lead: field mapping (businessName -> name,
 *   destinationId/contactName/email/phone passthrough).
 * - No provisioned lead -> `{ lead: null }`, not an error.
 * - Service error -> degrades to `{ lead: null }` rather than throwing
 *   (D-4: this is a pre-fill convenience, never a gate).
 *
 * @module test/routes/commerce/protected/my-lead
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ──────────────────────────────────────────────────────────────────────────
// Module mocks (declared BEFORE the import of the route under test).
// ──────────────────────────────────────────────────────────────────────────

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createProtectedRoute: vi.fn((config: { handler: unknown }) => config.handler)
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

const { mockGetMyLead } = vi.hoisted(() => ({ mockGetMyLead: vi.fn() }));
vi.mock('@repo/service-core', () => ({
    CommerceLeadService: vi.fn().mockImplementation(function () {
        return { getMyLead: mockGetMyLead };
    })
}));

// ──────────────────────────────────────────────────────────────────────────
// Imports (after mocks).
// ──────────────────────────────────────────────────────────────────────────

import type { Actor } from '@repo/service-core';
import { handleGetMyLead } from '../../../../src/routes/commerce/protected/my-lead';
import { getActorFromContext } from '../../../../src/utils/actor';

const mockGetActorFromContext = vi.mocked(getActorFromContext);

const OWNER_ACTOR: Actor = {
    id: 'owner-1',
    roles: ['HOST'] as unknown as Actor['roles'],
    permissions: []
};

/**
 * @param domain - Value of the `?domain=` query param, when the caller sent one
 *   (H-155). `undefined` models a request without it.
 */
function buildContext(domain?: string): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        req: { query: vi.fn((key: string) => (key === 'domain' ? domain : undefined)) }
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetActorFromContext.mockReturnValue(OWNER_ACTOR);
});

describe('handleGetMyLead', () => {
    it('returns the pre-fill-shaped lead when the caller has a provisioned lead', async () => {
        mockGetMyLead.mockResolvedValue({
            data: {
                id: 'lead-1',
                domain: 'gastronomy',
                businessName: 'La Parrilla de Juan',
                contactName: 'Juan Pérez',
                email: 'juan@example.com',
                phone: '+5491112345678',
                destinationId: 'dest-1',
                provisionedUserId: OWNER_ACTOR.id
            }
        });

        const result = await handleGetMyLead(buildContext() as never);

        expect(result).toEqual({
            lead: {
                name: 'La Parrilla de Juan',
                destinationId: 'dest-1',
                contactName: 'Juan Pérez',
                email: 'juan@example.com',
                phone: '+5491112345678'
            }
        });
    });

    it('maps a null destinationId/phone to null (not undefined)', async () => {
        mockGetMyLead.mockResolvedValue({
            data: {
                id: 'lead-1',
                domain: 'gastronomy',
                businessName: 'La Parrilla de Juan',
                contactName: 'Juan Pérez',
                email: 'juan@example.com',
                phone: null,
                destinationId: null,
                provisionedUserId: OWNER_ACTOR.id
            }
        });

        const result = await handleGetMyLead(buildContext() as never);

        expect(result).toEqual({
            lead: {
                name: 'La Parrilla de Juan',
                destinationId: null,
                contactName: 'Juan Pérez',
                email: 'juan@example.com',
                phone: null
            }
        });
    });

    it('returns { lead: null } (not an error) when the caller has no provisioned lead', async () => {
        mockGetMyLead.mockResolvedValue({ data: null });

        const result = await handleGetMyLead(buildContext() as never);

        expect(result).toEqual({ lead: null });
    });

    it('degrades to { lead: null } instead of throwing when the service returns an error (D-4: never gate)', async () => {
        mockGetMyLead.mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
        });

        const result = await handleGetMyLead(buildContext() as never);

        expect(result).toEqual({ lead: null });
    });

    // ── H-155 ───────────────────────────────────────────────────────────────
    //
    // Without a domain the endpoint answered with the caller's most recent lead
    // in ANY vertical, so the experience create form pre-filled itself from a
    // gastronomy lead — and the create form turns `name` into an immutable
    // public slug.

    it('forwards a valid domain to the service (H-155)', async () => {
        mockGetMyLead.mockResolvedValue({ data: null });

        await handleGetMyLead(buildContext('experience') as never);

        expect(mockGetMyLead).toHaveBeenCalledWith(OWNER_ACTOR, { domain: 'experience' });
    });

    it('omits the filter when no domain is given, preserving the original behaviour', async () => {
        mockGetMyLead.mockResolvedValue({ data: null });

        await handleGetMyLead(buildContext() as never);

        expect(mockGetMyLead).toHaveBeenCalledWith(OWNER_ACTOR, {});
    });

    // An unknown value must not reach the service, whose schema would reject it
    // and turn a pre-fill convenience into an error (D-4: never a gate). It
    // degrades to "no filter", which is strictly no worse than the old
    // behaviour.
    it('ignores an unrecognised domain rather than erroring', async () => {
        mockGetMyLead.mockResolvedValue({ data: null });

        const result = await handleGetMyLead(buildContext('not-a-vertical') as never);

        expect(mockGetMyLead).toHaveBeenCalledWith(OWNER_ACTOR, {});
        expect(result).toEqual({ lead: null });
    });
});
