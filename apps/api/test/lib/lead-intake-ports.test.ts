/**
 * Regression suite for H-62 / H-148 — a lead that reaches nobody.
 *
 * The alliance funnel accepted a submission, answered 201, and told no one —
 * it never modelled the idea of an ops alert at all. (Commerce had the exact
 * same defect for the same reason; its funnel, and this suite's commerce
 * coverage, were retired in HOS-695 alongside `commerce_leads` itself.)
 *
 * These tests assert the two facts that make the defect impossible to
 * reintroduce silently:
 *   1. Submitting a lead produces an actual send to the ops mailboxes.
 *   2. `opsNotifiedAt` is stamped ONLY on a confirmed delivery — because that
 *      column is the backstop cron's entire definition of "nobody was told",
 *      and stamping on a mere attempt would make the cron blind to exactly the
 *      leads it exists to rescue.
 *
 * @module test/lib/lead-intake-ports.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTrySend, mockUpdate, mockSet, mockWhere } = vi.hoisted(() => ({
    mockTrySend: vi.fn(),
    mockUpdate: vi.fn(),
    mockSet: vi.fn(),
    mockWhere: vi.fn()
}));

vi.mock('../../src/utils/notification-helper', () => ({
    trySendNotification: mockTrySend
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({
    env: {
        HOSPEDA_ADMIN_NOTIFICATION_EMAILS: 'ops@hospeda.com.ar,socios@hospeda.com.ar',
        HOSPEDA_ADMIN_URL: 'https://admin.hospeda.com.ar'
    }
}));

vi.mock('@repo/db', () => ({
    getDb: () => ({ update: mockUpdate }),
    allianceLeads: { id: 'alliance_leads.id' }
}));

import {
    announceLeadToOps,
    createAllianceLeadIntakeNotifyPort,
    type LeadIntakeAlert
} from '../../src/lib/lead-intake-ports';

/**
 * The payload handed to the transport on the nth send.
 *
 * Indexing `mock.calls` directly types every element as possibly undefined, and
 * silencing that with `?.` would turn a MISSING call into a passing assertion —
 * the exact failure shape these tests exist to catch. This throws instead.
 */
function sentPayload(index = 0): Record<string, unknown> {
    const call = mockTrySend.mock.calls[index];
    if (!call) {
        throw new Error(`expected a notification send at index ${index}, got none`);
    }
    return call[0] as Record<string, unknown>;
}

const alert = (overrides: Partial<LeadIntakeAlert> = {}): LeadIntakeAlert => ({
    funnel: 'alliance',
    leadId: 'lead-1',
    programLabel: 'Proveedor',
    contactName: 'Juan Pérez',
    contactEmail: 'juan@example.com',
    contactPhone: '+54911234567',
    businessName: 'Plomería Acme',
    message: 'Ofrezco 10% a los anfitriones.',
    createdAt: new Date('2026-08-15T18:30:00.000Z'),
    ...overrides
});

describe('lead intake ops alert (H-62 / H-148)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWhere.mockResolvedValue(undefined);
        mockSet.mockReturnValue({ where: mockWhere });
        mockUpdate.mockReturnValue({ set: mockSet });
        mockTrySend.mockResolvedValue({ delivered: true });
    });

    describe('announceLeadToOps', () => {
        it('writes to every configured ops mailbox', async () => {
            await announceLeadToOps({ alert: alert() });

            expect(mockTrySend).toHaveBeenCalledTimes(2);
            const recipients = mockTrySend.mock.calls.map((call) => call[0]?.recipientEmail);
            expect(recipients).toEqual(['ops@hospeda.com.ar', 'socios@hospeda.com.ar']);
        });

        it('carries the lead itself, not just a pointer to the admin', async () => {
            // The whole defect was discovery depending on somebody opening the
            // admin. An alert that omitted the contact details would rebuild
            // that dependency one click further along.
            await announceLeadToOps({ alert: alert() });

            const payload = sentPayload();
            expect(payload.type).toBe('admin_lead_received');
            expect(payload.contactName).toBe('Juan Pérez');
            expect(payload.contactEmail).toBe('juan@example.com');
            expect(payload.contactPhone).toBe('+54911234567');
            expect(payload.businessName).toBe('Plomería Acme');
            expect(payload.message).toBe('Ofrezco 10% a los anfitriones.');
            expect(payload.programLabel).toBe('Proveedor');
            expect(payload.funnelLabel).toBe('Aliados');
            expect(payload.adminUrl).toBe('https://admin.hospeda.com.ar/platform/alliance-leads');
        });

        it('stamps opsNotifiedAt when at least one mailbox received it', async () => {
            mockTrySend
                .mockResolvedValueOnce({ delivered: false })
                .mockResolvedValueOnce({ delivered: true });

            const result = await announceLeadToOps({ alert: alert() });

            expect(result.delivered).toBe(true);
            expect(mockUpdate).toHaveBeenCalledTimes(1);
            expect(mockSet).toHaveBeenCalledWith({ opsNotifiedAt: expect.any(Date) });
        });

        it('does NOT stamp opsNotifiedAt when nothing was delivered', async () => {
            // This is the load-bearing assertion. Stamping on a failed send
            // would tell the backstop cron the lead had been announced, and the
            // lead would be lost with the database asserting otherwise.
            mockTrySend.mockResolvedValue({ delivered: false });

            const result = await announceLeadToOps({ alert: alert() });

            expect(result.delivered).toBe(false);
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('alliance port', () => {
        it('announces a submitted lead and labels its program in Spanish', async () => {
            const port = createAllianceLeadIntakeNotifyPort();

            await port.notifyNewLead({
                lead: {
                    id: 'alliance-lead-1',
                    kind: 'service_provider',
                    businessName: 'Plomería Acme',
                    contactName: 'Juan Pérez',
                    email: 'juan@example.com',
                    phone: null,
                    message: 'Ofrezco 10%',
                    createdAt: new Date('2026-08-15T18:30:00.000Z')
                    // biome-ignore lint/suspicious/noExplicitAny: the port takes the full AllianceLead entity; this fixture carries only the fields it reads.
                } as any
            });

            expect(mockTrySend).toHaveBeenCalled();
            expect(sentPayload().programLabel).toBe('Proveedor');
            expect(sentPayload().funnelLabel).toBe('Aliados');
        });
    });
});
