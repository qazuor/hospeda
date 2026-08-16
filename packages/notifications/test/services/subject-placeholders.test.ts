/**
 * Regression suite for H-64 / H-75 — subject placeholders reaching real inboxes.
 *
 * The smoke of August 2026 found eleven live notification types whose SUBJECT
 * shipped the template syntax verbatim (`{counterpartName} confirmó el uso del
 * beneficio`). The body of those same emails was correct, which is what kept the
 * defect invisible: the value existed, and only the subject never received it.
 *
 * The break was never in the emitters (they pass the field) nor in
 * `subject-builder` (it interpolates what it is given). It sat between them, in
 * the hand-written chain inside `NotificationService.generateSubject`: a branch
 * per notification type, and whatever nobody added to that chain silently never
 * reached the interpolator.
 *
 * These tests exercise the REAL path — `service.send()` — and read the subject
 * off the transport, because that string is the one an inbox displays. Each case
 * asserts BOTH halves: no leftover `{placeholder}`, and the concrete value
 * present. The second half is what makes the test bite; a subject degraded to a
 * generic fallback would satisfy the first half alone.
 *
 * @module test/services/subject-placeholders.test
 */

import type { getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
    NotificationService,
    type NotificationServiceDeps
} from '../../src/services/notification.service';
import type { PreferenceService } from '../../src/services/preference.service';
import type { RetryService } from '../../src/services/retry.service';
import type { EmailTransport } from '../../src/transports/email/email-transport.interface';
import type { NotificationPayload } from '../../src/types/notification.types';
import { NotificationType } from '../../src/types/notification.types';

/** Matches any surviving `{placeholder}` token in a rendered subject. */
const UNRESOLVED_PLACEHOLDER = /\{[A-Za-z][A-Za-z0-9]*\}/;

describe('Subject placeholders reach the inbox resolved (H-64 / H-75)', () => {
    let service: NotificationService;
    let mockEmailTransport: EmailTransport;

    const basePayload = {
        recipientEmail: 'user@example.com',
        recipientName: 'John Doe',
        userId: 'user_123',
        customerId: 'cus_456'
    };

    beforeEach(() => {
        mockEmailTransport = { send: vi.fn() };

        const mockPreferenceService = {
            shouldSendNotification: vi.fn(),
            getPreferences: vi.fn(),
            updatePreferences: vi.fn()
        } as unknown as PreferenceService;

        const mockRetryService = {
            enqueue: vi.fn(),
            dequeueReady: vi.fn()
        } as unknown as RetryService;

        const mockDb = {
            insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
        } as unknown as ReturnType<typeof getDb>;

        const mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn()
        } as unknown as ILogger;

        const deps: NotificationServiceDeps = {
            emailTransport: mockEmailTransport,
            preferenceService: mockPreferenceService,
            retryService: mockRetryService,
            db: mockDb,
            logger: mockLogger,
            siteUrl: 'https://hospeda.com.ar'
        };

        service = new NotificationService(deps);

        (mockEmailTransport.send as Mock).mockResolvedValue({ messageId: 'msg_123' });
        (mockPreferenceService.shouldSendNotification as Mock).mockResolvedValue(true);
    });

    /**
     * Sends the payload and returns the subject the transport was handed.
     *
     * Reads the argument the transport actually received rather than asserting
     * with `objectContaining`, which cannot tell a wrong subject from a missing
     * one.
     */
    const sentSubject = async (payload: NotificationPayload): Promise<string> => {
        const result = await service.send(payload);
        expect(result.success).toBe(true);
        expect(mockEmailTransport.send).toHaveBeenCalledTimes(1);
        const call = (mockEmailTransport.send as Mock).mock.calls[0][0] as { subject: string };
        return call.subject;
    };

    describe('addon purchase — the twelfth case, found by the guard', () => {
        it('ADDON_PURCHASE names the addon instead of leaking {addonName}', async () => {
            // Not in the eleven the manual sweep reported, and reachable in
            // production: the MercadoPago webhook emits this on every successful
            // addon payment. The sweep cross-checked subjects against the keys
            // the old chain ASSIGNED, and the chain did assign `addonName` —
            // guarded by `if ('addonName' in payload)`. What it never checked is
            // that ADDON_PURCHASE is served by `PurchaseConfirmationPayload`,
            // which has no such field: the emitter puts the addon's name in
            // `planName`. The guard is over the whole set, so it caught what
            // reading the chain could not.
            const subject = await sentSubject({
                type: NotificationType.ADDON_PURCHASE,
                ...basePayload,
                planName: 'Fotos extra',
                amount: 250000,
                currency: 'ARS',
                nextBillingDate: '2026-09-15T00:00:00.000Z'
            });

            expect(subject).toContain('Fotos extra');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });
    });

    describe('alliance (HOS-278)', () => {
        it('ALLIANCE_CLAIM_INVITE resolves programLabel', async () => {
            const subject = await sentSubject({
                type: NotificationType.ALLIANCE_CLAIM_INVITE,
                ...basePayload,
                leadId: 'lead_1',
                programLabel: 'Partner',
                claimUrl: 'https://hospeda.com.ar/mi-cuenta/aliados?claim=tok',
                expiresAt: '2026-08-20T12:00:00.000Z'
            });

            expect(subject).toContain('Partner');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('ALLIANCE_LEAD_DECISION resolves programLabel', async () => {
            const subject = await sentSubject({
                type: NotificationType.ALLIANCE_LEAD_DECISION,
                ...basePayload,
                leadId: 'lead_2',
                programLabel: 'Proveedor',
                outcome: 'approved'
            });

            expect(subject).toContain('Proveedor');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });
    });

    describe('host trade usage chain (HOS-376)', () => {
        it('HOST_TRADE_USAGE_CONFIRMATION_REQUEST resolves counterpartName', async () => {
            const subject = await sentSubject({
                type: NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REQUEST,
                ...basePayload,
                counterpartName: 'Plomería Acme',
                servicedAt: '2026-08-10T00:00:00.000Z',
                expiresAt: '2026-08-24T00:00:00.000Z',
                actionUrl: 'https://hospeda.com.ar/mi-cuenta/usos/1'
            });

            expect(subject).toContain('Plomería Acme');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('HOST_TRADE_USAGE_CONFIRMATION_REMINDER resolves counterpartName', async () => {
            const subject = await sentSubject({
                type: NotificationType.HOST_TRADE_USAGE_CONFIRMATION_REMINDER,
                ...basePayload,
                counterpartName: 'Plomería Acme',
                expiresAt: '2026-08-24T00:00:00.000Z',
                actionUrl: 'https://hospeda.com.ar/mi-cuenta/usos/1'
            });

            expect(subject).toContain('Plomería Acme');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('HOST_TRADE_USAGE_CONFIRMED resolves counterpartName', async () => {
            const subject = await sentSubject({
                type: NotificationType.HOST_TRADE_USAGE_CONFIRMED,
                ...basePayload,
                counterpartName: 'Cabañas del Río',
                canReview: true,
                reviewUrl: 'https://hospeda.com.ar/mi-cuenta/usos/1/valorar'
            });

            expect(subject).toContain('Cabañas del Río');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('HOST_TRADE_USAGE_REJECTED resolves counterpartName', async () => {
            const subject = await sentSubject({
                type: NotificationType.HOST_TRADE_USAGE_REJECTED,
                ...basePayload,
                counterpartName: 'Cabañas del Río',
                note: 'No reconozco el trabajo.'
            });

            expect(subject).toContain('Cabañas del Río');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('HOST_TRADE_REVIEW_RECEIVED resolves listingName', async () => {
            const subject = await sentSubject({
                type: NotificationType.HOST_TRADE_REVIEW_RECEIVED,
                ...basePayload,
                listingName: 'Plomería Acme',
                overallRating: 5,
                respectedBenefit: true,
                actionUrl: 'https://hospeda.com.ar/mi-cuenta/proveedor/valoraciones'
            });

            expect(subject).toContain('Plomería Acme');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('HOST_TRADE_REVOKED resolves listingName', async () => {
            const subject = await sentSubject({
                type: NotificationType.HOST_TRADE_REVOKED,
                ...basePayload,
                listingName: 'Plomería Acme',
                reason: 'Dejó de responder a los anfitriones.'
            });

            expect(subject).toContain('Plomería Acme');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });
    });

    describe('partner program (HOS-278 / HOS-377)', () => {
        it('PARTNER_REVOKED resolves partnerName', async () => {
            const subject = await sentSubject({
                type: NotificationType.PARTNER_REVOKED,
                ...basePayload,
                partnerName: 'Heladería Colón',
                reason: 'El acuerdo no fue renovado.'
            });

            expect(subject).toContain('Heladería Colón');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('PARTNER_UNPAID_NOTICE resolves partnerName', async () => {
            const subject = await sentSubject({
                type: NotificationType.PARTNER_UNPAID_NOTICE,
                ...basePayload,
                partnerName: 'Heladería Colón',
                daysUntilArchive: 7
            });

            expect(subject).toContain('Heladería Colón');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });

        it('PARTNER_MENTIONS_LOGGED resolves BOTH partnerName and mentionedAtLabel', async () => {
            // The only pattern in the affected set with two unresolved
            // placeholders. Filling one and not the other still ships template
            // syntax, so both halves are asserted separately.
            const subject = await sentSubject({
                type: NotificationType.PARTNER_MENTIONS_LOGGED,
                ...basePayload,
                partnerName: 'Heladería Colón',
                mentionedAtLabel: '12 de agosto de 2026',
                mentions: [{ channelLabel: 'Instagram', url: 'https://instagram.com/p/x' }]
            });

            expect(subject).toContain('Heladería Colón');
            expect(subject).toContain('12 de agosto de 2026');
            expect(subject).not.toMatch(UNRESOLVED_PLACEHOLDER);
        });
    });
});
