import { Body, Html, Section, Text } from '@react-email/components';
import type { ILogger } from '@repo/logger';
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
 * PLACEHOLDER (SPEC-286 T-008): T-009 introduces the real
 * `notifications.alerts.digest.subject` i18n key rendered via `@repo/i18n`.
 * This local map exists only so T-008 doesn't need to pull in the i18n
 * package for a single string.
 */
const DIGEST_SUBJECT_BY_LOCALE: Record<string, string> = {
    es: 'Tus alertas de precios y ofertas',
    en: 'Your price drop and offer alerts',
    pt: 'Seus alertas de preço e ofertas'
};

/**
 * PLACEHOLDER (SPEC-286 T-008): replaced by the real `AlertDigestEmail`
 * component in T-009 — do not remove until T-009 lands.
 *
 * Minimal inline React Email component that lists price-drop and
 * promo-offer items as plain text rows. `AlertDigestEmail` does not exist
 * yet — T-009 ("Alert email templates") is blocked BY T-008, not the other
 * way around, so importing it here would fail. This placeholder keeps
 * `EmailAlertChannel`'s public contract (`NotificationChannel.deliver()`)
 * stable: when T-009 lands, only the render call inside `deliver()` below
 * needs to change (swap this function for `AlertDigestEmail`), no exports or
 * interfaces on this file need to move.
 *
 * @param payload - The combined price-drop + promo-offer digest for one user.
 */
function renderPlaceholderDigestEmail(payload: AlertDigestPayload) {
    const { priceDrop, promoOffers } = payload;

    return (
        <Html lang={payload.locale}>
            <Body>
                {priceDrop.length > 0 && (
                    <Section>
                        <Text>Bajas de precio:</Text>
                        {priceDrop.map((item) => (
                            <Text key={item.alertId}>
                                {item.accommodationName}: {item.currency} {item.basePriceSnapshot} →{' '}
                                {item.currency} {item.currentPrice} (-{item.dropPercent}%)
                            </Text>
                        ))}
                    </Section>
                )}
                {promoOffers.length > 0 && (
                    <Section>
                        <Text>Ofertas activas:</Text>
                        {promoOffers.map((item) => (
                            <Text key={item.promotionId}>
                                {item.accommodationName}: {item.promotionTitle} (
                                {item.discountValue} {item.discountType})
                            </Text>
                        ))}
                    </Section>
                )}
            </Body>
        </Html>
    );
}

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
            react: renderPlaceholderDigestEmail(payload),
            tags: [{ name: 'notification_type', value: 'alerts_digest' }]
        });

        logger.info(
            { userId: payload.userId, messageId: result.messageId },
            'Alert digest email sent'
        );
    }
}
