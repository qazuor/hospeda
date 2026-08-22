/**
 * Regression suite: `addon_purchase` must render the ADD-ON template (HOS-722).
 *
 * ## The defect this pins down
 *
 * HOS-722 made every add-on email's CTA locale-aware and pointed it at
 * `/{locale}/mi-cuenta/addons/?focus=<slug>`. `AddonPurchaseConfirmation` was
 * edited accordingly, and its own template test went green — but the template
 * was NEVER RENDERED. `NotificationService.selectTemplate` fell
 * `case 'addon_purchase'` through to `case 'subscription_purchase'`, so the
 * receipt an add-on buyer actually received was the shared subscription email:
 * hardcoded `/es/`, CTA pointing at `/mi-cuenta` rather than the add-ons page.
 * For that one email, what the issue claimed was simply not true.
 *
 * A template-level test cannot catch this — editing a template and rendering it
 * in isolation proves nothing about which template the dispatch reaches. So
 * these tests go through `NotificationService.send()` and assert on the element
 * the transport was actually handed, rendered.
 *
 * MUTATION CHECK: collapsing the two cases back into
 * `case 'subscription_purchase': case 'addon_purchase':` fails
 * "routes ... to AddonPurchaseConfirmation" and "CTA is locale-aware and
 * focused" — confirmed by applying the mutation before committing.
 *
 * @module test/services/addon-purchase-template-routing.test
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
import type { AddonPurchaseConfirmationPayload } from '../../src/types/notification.types.js';
import { NotificationType } from '../../src/types/notification.types.js';

const SITE_URL = 'https://hospeda.com.ar';

describe('NotificationService — addon_purchase template routing (HOS-722)', () => {
    let service: NotificationService;
    let emailTransport: EmailTransport;
    let insertedValues: Record<string, unknown> | undefined;

    const basePayload = {
        recipientEmail: 'host@example.com',
        recipientName: 'Valeria Ortiz',
        userId: 'user-abc',
        customerId: 'cus-xyz'
    } as const;

    const addonPayload: AddonPurchaseConfirmationPayload = {
        type: NotificationType.ADDON_PURCHASE,
        ...basePayload,
        addonName: 'Fotos extra',
        addonDescription: '20 fotos adicionales por alojamiento',
        orderId: 'mp-payment-9911',
        amount: 150000,
        currency: 'ARS',
        expiresAt: '2026-09-21T00:00:00.000Z',
        addonSlug: 'extra-photos-20',
        locale: 'pt'
    };

    /**
     * Renders whatever element the transport was handed, so the assertions
     * describe the email the recipient would open — not the element the test
     * chose to render.
     */
    const renderSentEmail = (): string => {
        const call = (emailTransport.send as Mock).mock.calls[0]?.[0] as
            | { react: ReactElement }
            | undefined;

        if (!call) {
            throw new Error('emailTransport.send was never called');
        }

        return renderToStaticMarkup(call.react);
    };

    beforeEach(() => {
        insertedValues = undefined;
        emailTransport = { send: vi.fn().mockResolvedValue({ messageId: 'msg-1' }) };

        const preferenceService = {
            shouldSendNotification: vi.fn().mockResolvedValue(true)
        } as unknown as PreferenceService;

        const db = {
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockImplementation((values: Record<string, unknown>) => {
                    insertedValues = values;
                    return Promise.resolve(undefined);
                })
            })
        } as unknown as ReturnType<typeof getDb>;

        const logger = {
            info: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn()
        } as unknown as ILogger;

        const deps: NotificationServiceDeps = {
            emailTransport,
            preferenceService,
            retryService: { enqueue: vi.fn() } as unknown as RetryService,
            db,
            logger,
            siteUrl: SITE_URL
        };

        service = new NotificationService(deps);
    });

    it('routes addon_purchase to AddonPurchaseConfirmation, not the shared subscription template', async () => {
        // Act
        const result = await service.send(addonPayload);

        // Assert — heading and receipt rows that ONLY the add-on template has.
        const html = renderSentEmail();

        expect(result.success).toBe(true);
        expect(html).toContain('Complemento adquirido exitosamente');
        expect(html).toContain('20 fotos adicionales por alojamiento');
        expect(html).toContain('mp-payment-9911');
        // Copy unique to the shared subscription template must be absent.
        expect(html).not.toContain('¡Gracias por tu compra!');
        expect(html).not.toContain('Plan/Complemento');
    });

    it('renders a CTA that is locale-aware and focused on the purchased add-on', async () => {
        // Act
        await service.send(addonPayload);

        // Assert — the whole point of HOS-722 for this email.
        const html = renderSentEmail();

        expect(html).toContain(
            `href="${SITE_URL}/pt/mi-cuenta/addons/?focus=extra-photos-20#addon-extra-photos-20"`
        );
        expect(html).not.toContain(`href="${SITE_URL}/es/mi-cuenta"`);
    });

    it('titles the receipt with the add-on name', async () => {
        // The subject pattern moved from `{planName}` to `{addonName}` with the
        // payload split; a leftover `{planName}` would leak the raw placeholder.
        await service.send(addonPayload);

        expect(emailTransport.send).toHaveBeenCalledWith(
            expect.objectContaining({ subject: 'Add-on adquirido - Fotos extra' })
        );
    });

    it('persists addonSlug and locale to the notification log so a retry can rebuild the same link', async () => {
        // Act
        await service.send(addonPayload);

        // Assert — exact shape, because `objectContaining` cannot see a field
        // that is missing, which is precisely the defect being guarded here.
        expect(insertedValues?.metadata).toEqual({
            userId: 'user-abc',
            recipientName: 'Valeria Ortiz',
            messageId: 'msg-1',
            category: 'transactional',
            idempotencyKey: null,
            addonSlug: 'extra-photos-20',
            locale: 'pt'
        });
    });

    it('omits the add-on link fields entirely for a payload that has none', async () => {
        // Act — a subscription receipt must not gain empty addonSlug/locale keys.
        await service.send({
            type: NotificationType.SUBSCRIPTION_PURCHASE,
            ...basePayload,
            planName: 'Plan Pro',
            amount: 900000,
            currency: 'ARS'
        });

        // Assert
        expect(insertedValues?.metadata).toEqual({
            userId: 'user-abc',
            recipientName: 'Valeria Ortiz',
            messageId: 'msg-1',
            category: 'transactional',
            idempotencyKey: null
        });
    });
});
