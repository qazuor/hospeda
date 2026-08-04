/**
 * Unit tests for `handleListMyAllianceLeads` (HOS-278 AC-5), the applicant
 * self-service "my applications" endpoint.
 *
 * Mirrors the mocking style of `commerce/protected/my-lead.test.ts`:
 * `AllianceLeadService` is mocked at the `@repo/service-core` module boundary,
 * so this suite asserts the ROUTE's shaping and failure behaviour, not the
 * service's scoping logic (that has its own suite —
 * `alliance-lead.service.test.ts`).
 *
 * @module test/routes/alliance/protected/list-mine
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

const { mockListMine } = vi.hoisted(() => ({ mockListMine: vi.fn() }));
vi.mock('@repo/service-core', () => ({
    AllianceLeadService: vi.fn().mockImplementation(function () {
        return { listMine: mockListMine };
    }),
    ServiceError: class ServiceError extends Error {
        public code: string;
        constructor(code: string, message: string) {
            super(message);
            this.code = code;
        }
    }
}));

// ──────────────────────────────────────────────────────────────────────────
// Imports (after mocks).
// ──────────────────────────────────────────────────────────────────────────

import type { Actor } from '@repo/service-core';
import { handleListMyAllianceLeads } from '../../../../src/routes/alliance/protected/list-mine';
import { getActorFromContext } from '../../../../src/utils/actor';

const mockGetActorFromContext = vi.mocked(getActorFromContext);

const APPLICANT_ACTOR: Actor = {
    id: 'applicant-1',
    roles: ['USER'] as unknown as Actor['roles'],
    permissions: []
};

const SUBMITTED_AT = new Date('2026-08-01T12:00:00.000Z');

function buildContext(): Record<string, unknown> {
    return { get: vi.fn(), set: vi.fn() };
}

function buildLead(overrides: Record<string, unknown> = {}) {
    return {
        id: '00000000-0000-4000-a000-000000000002',
        kind: 'partner',
        contactName: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+5491112345678',
        message: 'Quiero sumarme como partner.',
        status: 'pending',
        adminNote: 'Internal: needs a call before approving',
        applicantUserId: APPLICANT_ACTOR.id,
        claimExpiresAt: null,
        createdAt: SUBMITTED_AT,
        updatedAt: SUBMITTED_AT,
        deletedAt: null,
        createdById: null,
        updatedById: null,
        deletedById: null,
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockGetActorFromContext.mockReturnValue(APPLICANT_ACTOR);
});

describe('handleListMyAllianceLeads', () => {
    it("returns the caller's applications shaped for the account page", async () => {
        mockListMine.mockResolvedValue({ data: [buildLead()] });

        const result = await handleListMyAllianceLeads(buildContext() as never);

        expect(result).toEqual({
            leads: [
                {
                    id: '00000000-0000-4000-a000-000000000002',
                    kind: 'partner',
                    status: 'pending',
                    createdAt: SUBMITTED_AT
                }
            ]
        });
    });

    it("never leaks the admin's internal note to the applicant", async () => {
        mockListMine.mockResolvedValue({ data: [buildLead()] });

        const result = await handleListMyAllianceLeads(buildContext() as never);

        expect(result.leads[0]).not.toHaveProperty('adminNote');
        expect(JSON.stringify(result)).not.toContain('needs a call');
    });

    it('never echoes back applicant PII or the account link', async () => {
        mockListMine.mockResolvedValue({ data: [buildLead()] });

        const result = await handleListMyAllianceLeads(buildContext() as never);

        expect(result.leads[0]).not.toHaveProperty('email');
        expect(result.leads[0]).not.toHaveProperty('message');
        expect(result.leads[0]).not.toHaveProperty('applicantUserId');
    });

    it('returns an empty array (not an error) when the caller has never applied (AC-5)', async () => {
        mockListMine.mockResolvedValue({ data: [] });

        const result = await handleListMyAllianceLeads(buildContext() as never);

        expect(result).toEqual({ leads: [] });
    });

    it('returns an empty array when the service returns no data at all', async () => {
        mockListMine.mockResolvedValue({});

        const result = await handleListMyAllianceLeads(buildContext() as never);

        expect(result).toEqual({ leads: [] });
    });

    it('surfaces a service error instead of masking it as "you never applied"', async () => {
        mockListMine.mockResolvedValue({
            error: { code: 'INTERNAL_ERROR', message: 'DB unavailable' }
        });

        await expect(handleListMyAllianceLeads(buildContext() as never)).rejects.toThrow(
            'DB unavailable'
        );
    });

    it('scopes the read to the actor resolved from the request context', async () => {
        mockListMine.mockResolvedValue({ data: [] });

        await handleListMyAllianceLeads(buildContext() as never);

        expect(mockListMine).toHaveBeenCalledWith({ actor: APPLICANT_ACTOR });
    });
});
