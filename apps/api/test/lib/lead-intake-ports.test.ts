/**
 * Regression suite for H-62 / H-148 — a lead that reaches nobody.
 *
 * Both acquisition funnels accepted a submission, answered 201, and told no
 * one. Commerce had the hook and it was never injected; alliance never modelled
 * the idea. The failure left no trace: no error, no bounce, and on the commerce
 * side a single `logger.debug` that production does not emit.
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
    commerceLeads: { id: 'commerce_leads.id' },
    allianceLeads: { id: 'alliance_leads.id' }
}));

import {
    announceLeadToOps,
    createAllianceLeadIntakeNotifyPort,
    createCommerceLeadNotificationPort,
    type LeadIntakeAlert
} from '../../src/lib/lead-intake-ports';

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
            const recipients = mockTrySend.mock.calls.map((call) => call[0].recipientEmail);
            expect(recipients).toEqual(['ops@hospeda.com.ar', 'socios@hospeda.com.ar']);
        });

        it('carries the lead itself, not just a pointer to the admin', async () => {
            // The whole defect was discovery depending on somebody opening the
            // admin. An alert that omitted the contact details would rebuild
            // that dependency one click further along.
            await announceLeadToOps({ alert: alert() });

            const payload = mockTrySend.mock.calls[0][0];
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

        it('points a commerce lead at the commerce queue', async () => {
            await announceLeadToOps({ alert: alert({ funnel: 'commerce' }) });

            expect(mockTrySend.mock.calls[0][0].adminUrl).toBe(
                'https://admin.hospeda.com.ar/platform/commerce-leads'
            );
            expect(mockTrySend.mock.calls[0][0].funnelLabel).toBe('Comercios');
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

    describe('commerce port', () => {
        it('announces a submitted lead and labels its domain in Spanish', async () => {
            const port = createCommerceLeadNotificationPort();

            await port.notifyNewLead({
                id: 'commerce-lead-1',
                domain: 'gastronomy',
                businessName: 'La Parrilla de Juan',
                contactName: 'Juan Pérez',
                email: 'juan@example.com',
                phone: '+54911234567',
                message: 'Quiero listar mi parrilla',
                createdAt: new Date('2026-08-15T18:30:00.000Z')
                // biome-ignore lint/suspicious/noExplicitAny: the port takes the full CommerceLead entity; this fixture carries only the fields it reads.
            } as any);

            expect(mockTrySend).toHaveBeenCalled();
            expect(mockTrySend.mock.calls[0][0].programLabel).toBe('Gastronomía');
            expect(mockTrySend.mock.calls[0][0].businessName).toBe('La Parrilla de Juan');
        });

        it('falls back to the raw domain rather than failing to send', async () => {
            // `commerce_leads.domain` is a varchar precisely so a new vertical
            // needs no migration, so an unmapped value is expected — and an
            // unlabelled alert beats a lead nobody hears about.
            const port = createCommerceLeadNotificationPort();

            await port.notifyNewLead({
                id: 'commerce-lead-2',
                domain: 'lodging_supplies',
                businessName: 'Insumos SA',
                contactName: 'Ana',
                email: 'ana@example.com',
                createdAt: new Date()
                // biome-ignore lint/suspicious/noExplicitAny: see above.
            } as any);

            expect(mockTrySend.mock.calls[0][0].programLabel).toBe('lodging_supplies');
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
            expect(mockTrySend.mock.calls[0][0].programLabel).toBe('Proveedor');
            expect(mockTrySend.mock.calls[0][0].funnelLabel).toBe('Aliados');
        });
    });
});
