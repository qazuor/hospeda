/**
 * Unit tests for `handleClaimAllianceLead` (HOS-278 AC-4).
 *
 * `AllianceLeadService` is mocked at the `@repo/service-core` module boundary,
 * so this suite asserts the ROUTE's contract — what it forwards, what it shapes
 * back, and what it refuses to leak — not the service's own token/expiry/owner
 * checks (those have their own suite, `alliance-lead.service.test.ts`).
 *
 * @module test/routes/alliance/protected/claim
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

vi.mock('../../../../src/utils/env', () => ({
    env: { HOSPEDA_SITE_URL: 'https://hospeda.com.ar' }
}));

vi.mock('../../../../src/lib/alliance-ports', () => ({
    createAllianceClaimInvitePort: vi.fn(() => ({ inviteToClaim: vi.fn() }))
}));

const { mockClaimLead } = vi.hoisted(() => ({ mockClaimLead: vi.fn() }));
vi.mock('@repo/service-core', () => ({
    AllianceLeadService: vi.fn().mockImplementation(function () {
        return { claimLead: mockClaimLead };
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
import { handleClaimAllianceLead } from '../../../../src/routes/alliance/protected/claim';
import { getActorFromContext } from '../../../../src/utils/actor';

const mockGetActorFromContext = vi.mocked(getActorFromContext);

const LEAD_ID = '00000000-0000-4000-a000-000000000002';
const SUBMITTED_AT = new Date('2026-08-01T12:00:00.000Z');

const CLAIMANT: Actor = {
    id: 'applicant-1',
    roles: ['USER'] as unknown as Actor['roles'],
    permissions: [],
    email: 'juan@example.com'
};

function buildContext(body: unknown): Record<string, unknown> {
    return {
        get: vi.fn(),
        set: vi.fn(),
        req: { json: vi.fn().mockResolvedValue(body) }
    };
}

function linkedLead(overrides: Record<string, unknown> = {}) {
    return {
        id: LEAD_ID,
        kind: 'partner',
        contactName: 'Juan Pérez',
        email: 'juan@example.com',
        phone: '+5491112345678',
        message: 'Quiero sumarme como partner.',
        status: 'pending',
        adminNote: 'Internal: needs a call before approving',
        applicantUserId: CLAIMANT.id,
        claimToken: null,
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
    mockGetActorFromContext.mockReturnValue(CLAIMANT);
});

describe('handleClaimAllianceLead', () => {
    it('forwards the actor, the path id and the body token to the service', async () => {
        mockClaimLead.mockResolvedValue({ data: linkedLead() });

        await handleClaimAllianceLead(buildContext({ token: 'raw-token' }) as never, {
            id: LEAD_ID
        });

        expect(mockClaimLead).toHaveBeenCalledWith({
            actor: CLAIMANT,
            id: LEAD_ID,
            token: 'raw-token'
        });
    });

    it('returns the applicant-facing view of the now-linked application', async () => {
        mockClaimLead.mockResolvedValue({ data: linkedLead() });

        const result = await handleClaimAllianceLead(
            buildContext({ token: 'raw-token' }) as never,
            { id: LEAD_ID }
        );

        expect(result).toEqual({
            lead: {
                id: LEAD_ID,
                kind: 'partner',
                status: 'pending',
                createdAt: SUBMITTED_AT
            }
        });
    });

    it("never echoes the admin's internal note back to the applicant", async () => {
        mockClaimLead.mockResolvedValue({ data: linkedLead() });

        const result = await handleClaimAllianceLead(
            buildContext({ token: 'raw-token' }) as never,
            { id: LEAD_ID }
        );

        expect(JSON.stringify(result)).not.toContain('needs a call');
    });

    it('never echoes the claim token or the account link back', async () => {
        mockClaimLead.mockResolvedValue({
            data: linkedLead({ claimToken: 'should-never-surface' })
        });

        const result = await handleClaimAllianceLead(
            buildContext({ token: 'raw-token' }) as never,
            { id: LEAD_ID }
        );

        expect(JSON.stringify(result)).not.toContain('should-never-surface');
        expect(result.lead).not.toHaveProperty('applicantUserId');
    });

    it('propagates a rejected claim as an error (never a fake success)', async () => {
        mockClaimLead.mockResolvedValue({
            error: { code: 'NOT_FOUND', message: 'This confirmation link is not valid' }
        });

        await expect(
            handleClaimAllianceLead(buildContext({ token: 'wrong' }) as never, { id: LEAD_ID })
        ).rejects.toThrow('This confirmation link is not valid');
    });

    it('forwards an empty token when the body has none, rather than skipping the check', async () => {
        mockClaimLead.mockResolvedValue({
            error: { code: 'VALIDATION_ERROR', message: 'invalid' }
        });

        await expect(
            handleClaimAllianceLead(buildContext({}) as never, { id: LEAD_ID })
        ).rejects.toThrow();
        expect(mockClaimLead).toHaveBeenCalledWith(
            expect.objectContaining({ token: '', id: LEAD_ID })
        );
    });

    it('forwards a non-string token as empty rather than passing it through', async () => {
        mockClaimLead.mockResolvedValue({
            error: { code: 'VALIDATION_ERROR', message: 'invalid' }
        });

        await expect(
            handleClaimAllianceLead(buildContext({ token: { evil: true } }) as never, {
                id: LEAD_ID
            })
        ).rejects.toThrow();
        expect(mockClaimLead).toHaveBeenCalledWith(expect.objectContaining({ token: '' }));
    });

    it('survives an unparseable body', async () => {
        mockClaimLead.mockResolvedValue({
            error: { code: 'VALIDATION_ERROR', message: 'invalid' }
        });
        const ctx = {
            get: vi.fn(),
            set: vi.fn(),
            req: { json: vi.fn().mockRejectedValue(new Error('not json')) }
        };

        await expect(handleClaimAllianceLead(ctx as never, { id: LEAD_ID })).rejects.toThrow();
        expect(mockClaimLead).toHaveBeenCalledWith(expect.objectContaining({ token: '' }));
    });
});
