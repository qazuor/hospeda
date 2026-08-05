/**
 * Unit tests for `createAllianceClaimInvitePort` (HOS-278 §6.2).
 *
 * This port holds the one question AC-3 forbids disclosing — "does this address
 * already have an account?" — so the suite pins both branches, and pins that
 * the RAW token leaves only through the email.
 *
 * @module test/lib/alliance-ports.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const selectLimitMock = vi.hoisted(() => vi.fn());
const sendNotificationMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: () => ({
        select: () => ({
            from: () => ({
                where: () => ({ limit: selectLimitMock })
            })
        })
    }),
    users: { id: 'users.id', email: 'users.email', displayName: 'users.displayName' }
}));

// The port only uses `eq` as an opaque predicate builder; the real one requires
// genuine Drizzle column objects, which the table stub above is not.
vi.mock('drizzle-orm', () => ({ eq: (a: unknown, b: unknown) => ({ a, b }) }));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: sendNotificationMock
}));

vi.mock('../../src/utils/logger', () => ({ apiLogger: loggerMock }));

import { createAllianceClaimInvitePort } from '../../src/lib/alliance-ports';

const SITE_URL = 'https://hospeda.com.ar';
const LEAD_ID = '00000000-0000-4000-a000-000000000002';
const RAW_TOKEN = 'raw-token-value';
const EXPIRES_AT = new Date('2026-08-11T12:00:00.000Z');

function invite(overrides: Record<string, unknown> = {}) {
    return {
        leadId: LEAD_ID,
        email: 'juan@example.com',
        contactName: 'Juan Pérez',
        kind: 'partner' as const,
        token: RAW_TOKEN,
        expiresAt: EXPIRES_AT,
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    sendNotificationMock.mockResolvedValue(undefined);
});

describe('createAllianceClaimInvitePort', () => {
    describe('when the address has no account', () => {
        it('sends nothing at all', async () => {
            selectLimitMock.mockResolvedValue([]);
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite());

            expect(sendNotificationMock).not.toHaveBeenCalled();
        });

        it('does not log the address it failed to find', async () => {
            selectLimitMock.mockResolvedValue([]);
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite());

            const logged = JSON.stringify(loggerMock.debug.mock.calls);
            expect(logged).not.toContain('juan@example.com');
        });
    });

    describe('when the address belongs to an account', () => {
        beforeEach(() => {
            selectLimitMock.mockResolvedValue([{ id: 'user-1', displayName: 'Juana Titular' }]);
        });

        it('emails the address owner', async () => {
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite());

            expect(sendNotificationMock).toHaveBeenCalledOnce();
            const payload = sendNotificationMock.mock.calls[0]?.[0];
            expect(payload.type).toBe('alliance_claim_invite');
            expect(payload.recipientEmail).toBe('juan@example.com');
            expect(payload.userId).toBe('user-1');
        });

        it('greets the ACCOUNT owner, not the applicant who typed the form', async () => {
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite({ contactName: 'Impostor' }));

            const payload = sendNotificationMock.mock.calls[0]?.[0];
            expect(payload.recipientName).toBe('Juana Titular');
        });

        it('falls back to the submitted name when the account has no display name', async () => {
            selectLimitMock.mockResolvedValue([{ id: 'user-1', displayName: null }]);
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite());

            const payload = sendNotificationMock.mock.calls[0]?.[0];
            expect(payload.recipientName).toBe('Juan Pérez');
        });

        it('carries the raw token in the claim URL alongside the lead id', async () => {
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite());

            const payload = sendNotificationMock.mock.calls[0]?.[0];
            const url = new URL(payload.claimUrl);
            expect(url.origin).toBe(SITE_URL);
            expect(url.pathname).toBe('/mi-cuenta/aliados');
            expect(url.searchParams.get('claim')).toBe(RAW_TOKEN);
            expect(url.searchParams.get('lead')).toBe(LEAD_ID);
        });

        it('resolves a human program label, never the raw slug', async () => {
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite({ kind: 'service_provider' }));

            const payload = sendNotificationMock.mock.calls[0]?.[0];
            expect(payload.programLabel).toBe('Proveedor');
        });

        it('states the expiry as an ISO timestamp', async () => {
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite());

            const payload = sendNotificationMock.mock.calls[0]?.[0];
            expect(payload.expiresAt).toBe('2026-08-11T12:00:00.000Z');
        });

        it('NEVER writes the token to the log', async () => {
            const port = createAllianceClaimInvitePort(SITE_URL);

            await port.inviteToClaim(invite());

            const logged = JSON.stringify([
                ...loggerMock.info.mock.calls,
                ...loggerMock.debug.mock.calls,
                ...loggerMock.warn.mock.calls,
                ...loggerMock.error.mock.calls
            ]);
            expect(logged).not.toContain(RAW_TOKEN);
        });
    });
});
