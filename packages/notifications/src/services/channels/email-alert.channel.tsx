import type { ILogger } from '@repo/logger';
import { AlertDigestEmail } from '../../templates/alerts/AlertDigestEmail.js';
import type { EmailTransport } from '../../transports/email/email-transport.interface.js';
import type { AlertDigestPayload } from '../../types/alert.types.js';
import type { NotificationChannel } from '../alert-delivery.service.js';

/**
 * Dependencies for {@link EmailAlertChannel}.
 */
export interface EmailAlertChannelDeps {
    /** Email transport implementation used to actually send the digest. */
    emailTransport: EmailTransport;
    /** Logger instance for structured logging. */
    logger: ILogger;
}

/**
 * Subject line per locale for the alerts & offers daily digest.
 *
 * Sourced from the same copy registered under `notifications.alerts.digest.subject`
 * in `packages/i18n/src/locales/{es,en,pt}/notifications.json` (SPEC-286 T-009).
 * This package does not depend on `@repo/i18n` (see `AlertDigestPayload`'s
 * module doc), so this map is kept in sync with those JSON files manually —
 * if the i18n copy changes, update this map too.
 */
const DIGEST_SUBJECT_BY_LOCALE: Record<string, string> = {
    es: 'Tus alertas de precios y ofertas',
    en: 'Your price drop and offer alerts',
    pt: 'Seus alertas de preço e ofertas'
};

/**
 * Email delivery channel for the alerts & offers daily digest.
 *
 * Implements {@link NotificationChannel} so it can be registered alongside
 * future WhatsApp/push channels in `AlertDigestDeliveryService` without any
 * changes to that orchestrator.
 *
 * @example
 * ```ts
 * const emailChannel = new EmailAlertChannel({
 *   emailTransport: resendTransport,
 *   logger
 * });
 *
 * const deliveryService = new AlertDigestDeliveryService({
 *   channels: [emailChannel],
 *   logger
 * });
 * ```
 */
export class EmailAlertChannel implements NotificationChannel {
    readonly name = 'email';

    constructor(private readonly deps: EmailAlertChannelDeps) {}

    /**
     * Sends the alerts & offers digest email for one user.
     *
     * Skips sending silently (no-op, no error, no log) when both
     * `priceDrop` and `promoOffers` are empty — there is nothing to notify
     * the user about.
     *
     * @param payload - The combined price-drop + promo-offer digest for one user.
     */
    async deliver(payload: AlertDigestPayload): Promise<void> {
        if (payload.priceDrop.length === 0 && payload.promoOffers.length === 0) {
            return;
        }

        const { emailTransport, logger } = this.deps;
        const subject = DIGEST_SUBJECT_BY_LOCALE[payload.locale] ?? DIGEST_SUBJECT_BY_LOCALE.es;

        const result = await emailTransport.send({
            to: payload.userEmail,
            subject: subject ?? 'Tus alertas de precios y ofertas',
            react: AlertDigestEmail(payload),
            tags: [{ name: 'notification_type', value: 'alerts_digest' }]
        });

        logger.info(
            { userId: payload.userId, messageId: result.messageId },
            'Alert digest email sent'
        );
    }
}
