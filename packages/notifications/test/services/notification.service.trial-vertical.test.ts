/**
 * HOS-1283 — the vertical actually reaches the SEND, not just the template.
 *
 * The bug this whole issue is about was never in the template files alone:
 * `TrialEnding1Day` (etc.) could be perfectly vertical-aware and the mail
 * would still say "tu alojamiento" if `NotificationService`'s dispatch switch
 * never forwarded `payload.productDomain` down to the component call. That is
 * exactly the failure mode this repo's own method note warns about —
 * "editar una plantilla no la despacha" — so this file goes through
 * `NotificationService.send()` itself (the real dispatch path a cron actually
 * calls), not through the template component directly.
 *
 * @module test/services/notification.service.trial-vertical
 */

import type { getDb } from '@repo/db';
import type { ILogger } from '@repo/logger';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import {
    NotificationService,
    type NotificationServiceDeps
} from '../../src/services/notification.service.js';
import type { PreferenceService } from '../../src/services/preference.service.js';
import type { RetryService } from '../../src/services/retry.service.js';
import type { EmailTransport } from '../../src/transports/email/email-transport.interface.js';
import type { NotificationPayload } from '../../src/types/notification.types.js';
import { NotificationType } from '../../src/types/notification.types.js';

describe('NotificationService — vertical copy reaches the real send (HOS-1283)', () => {
    let service: NotificationService;
    let mockEmailTransport: EmailTransport;
    let mockPreferenceService: PreferenceService;
    let mockRetryService: RetryService;
    let mockDb: ReturnType<typeof getDb>;
    let mockLogger: ILogger;

    const basePayload = {
        recipientEmail: 'owner@example.com',
        recipientName: 'Marta Giménez',
        userId: 'user_1',
        customerId: 'cus_1'
    };

    beforeEach(() => {
        mockEmailTransport = { send: vi.fn().mockResolvedValue({ messageId: 'msg_1' }) };
        mockPreferenceService = {
            shouldSendNotification: vi.fn().mockResolvedValue(true),
            getPreferences: vi.fn(),
            updatePreferences: vi.fn()
        } as unknown as PreferenceService;
        mockRetryService = { enqueue: vi.fn(), dequeueReady: vi.fn() } as unknown as RetryService;
        mockDb = {
            insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) })
        } as unknown as ReturnType<typeof getDb>;
        mockLogger = {
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
    });

    /** Renders whatever `react` element the transport was actually handed. */
    function sentHtml(): string {
        const [call] = (mockEmailTransport.send as Mock).mock.calls;
        const { react } = call[0] as { react: ReactElement };
        return renderToStaticMarkup(react);
    }

    it('trial_ending_1d: a gastronomy candidate never reaches the mailer as "tu alojamiento"', async () => {
        const payload: NotificationPayload = {
            type: NotificationType.TRIAL_ENDING_1D,
            ...basePayload,
            planName: 'Plan Comercio',
            trialEndDate: '2026-09-26T00:00:00.000Z',
            upgradeUrl: 'https://hospeda.com.ar/es/planes/gastronomia/precios/',
            productDomain: 'gastronomy',
            idempotencyKey: 'trial_ending_1d-sub-1'
        };

        const result = await service.send(payload);

        expect(result.success).toBe(true);
        const html = sentHtml();
        expect(html).toContain('tu local deja de aparecer');
        expect(html).not.toContain('tu alojamiento deja de aparecer');
    });

    it('trial_ending_1d: an accommodation candidate (the default) keeps the original copy', async () => {
        const payload: NotificationPayload = {
            type: NotificationType.TRIAL_ENDING_1D,
            ...basePayload,
            planName: 'Plan Anfitrión',
            trialEndDate: '2026-09-26T00:00:00.000Z',
            upgradeUrl: 'https://hospeda.com.ar/es/planes/anfitriones/precios/',
            productDomain: 'accommodation',
            idempotencyKey: 'trial_ending_1d-sub-2'
        };

        await service.send(payload);

        expect(sentHtml()).toContain('tu alojamiento deja de aparecer');
    });

    it('renewal_reminder: a partner subscription gets its own closing line, through the real dispatch', async () => {
        const payload: NotificationPayload = {
            type: NotificationType.RENEWAL_REMINDER,
            ...basePayload,
            planName: 'Plan Aliado',
            renewalDate: '2026-12-31T00:00:00.000Z',
            productDomain: 'partner',
            idempotencyKey: 'renewal-cus-1'
        };

        await service.send(payload);

        const html = sentHtml();
        expect(html).toContain('tu alianza comercial');
        expect(html).not.toContain('alojamiento turístico');
    });
});
