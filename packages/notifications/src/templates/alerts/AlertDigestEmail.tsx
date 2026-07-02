import { Hr, Section, Text } from '@react-email/components';
import type { AlertDigestPayload } from '../../types/alert.types.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { PriceDropItem } from './PriceDropItem.js';
import { PromoOfferItem } from './PromoOfferItem.js';
import { ALERT_DIGEST_SITE_BASE_URL } from './constants.js';

/**
 * Props for {@link AlertDigestEmail}.
 *
 * Identical in shape to `AlertDigestPayload` — the combined price-drop and
 * promo-offer digest for a single user, produced by
 * `AlertDigestDeliveryService`/`EmailAlertChannel` (SPEC-286 T-008) — so the
 * channel can call `AlertDigestEmail(payload)` directly with no adapter.
 *
 * `locale` is accepted (via `AlertDigestPayload`) for caller parity but does
 * not alter the rendered copy, matching every other template in this package
 * (see `ConversationNewMessageAnon`, `TrialExpired`) — email copy is
 * Spanish-only across the platform today.
 */
export type AlertDigestEmailProps = AlertDigestPayload;

/**
 * Daily "alerts & offers" digest email.
 *
 * Renders a price-drop section when `priceDrop` has items, a promo-offer
 * section when `promoOffers` has items, and both sections when both are
 * populated (separated by a divider). Renders a safe "nothing new" fallback
 * text when both arrays are empty — `EmailAlertChannel.deliver()` already
 * guards against calling this template at all in that case (SPEC-286 T-008),
 * but the template itself must not render blank or throw if invoked directly
 * (e.g. in a test, or by a future caller that doesn't apply that guard).
 *
 * @param props - The combined price-drop + promo-offer digest for one user
 *
 * @example
 * ```tsx
 * <AlertDigestEmail
 *   userId="u1"
 *   userEmail="tourist@example.com"
 *   locale="es"
 *   priceDrop={[...]}
 *   promoOffers={[...]}
 * />
 * ```
 */
export function AlertDigestEmail({ priceDrop, promoOffers }: AlertDigestEmailProps) {
    const hasPriceDrop = priceDrop.length > 0;
    const hasPromoOffers = promoOffers.length > 0;
    const hasAnyItems = hasPriceDrop || hasPromoOffers;

    return (
        <EmailLayout previewText="Tus alertas de precios y ofertas">
            <Heading>Tus alertas de precios y ofertas</Heading>

            {!hasAnyItems && (
                <Text style={styles.paragraph}>
                    No encontramos novedades de precio ni ofertas activas para tus alojamientos
                    guardados en las últimas 24 horas.
                </Text>
            )}

            {hasPriceDrop && (
                <Section style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Bajó el precio de tus alojamientos guardados
                    </Text>
                    {priceDrop.map((item) => (
                        <PriceDropItem
                            key={item.alertId}
                            item={item}
                        />
                    ))}
                </Section>
            )}

            {hasPriceDrop && hasPromoOffers && <Hr style={styles.divider} />}

            {hasPromoOffers && (
                <Section style={styles.section}>
                    <Text style={styles.sectionTitle}>Ofertas activas para vos</Text>
                    {promoOffers.map((item) => (
                        <PromoOfferItem
                            key={item.promotionId}
                            item={item}
                        />
                    ))}
                </Section>
            )}

            <Section style={styles.buttonContainer}>
                <Button
                    href={`${ALERT_DIGEST_SITE_BASE_URL}/es/mi-cuenta/alertas`}
                    variant="secondary"
                >
                    Administrar mis alertas
                </Button>
            </Section>

            <Text style={styles.footerNote}>
                Recibís este resumen porque tenés alertas de precio activas en Hospeda.
            </Text>
        </EmailLayout>
    );
}

const styles = {
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    section: {
        margin: '0 0 8px'
    },
    sectionTitle: {
        color: '#1e293b',
        fontSize: '16px',
        fontWeight: '700',
        lineHeight: '22px',
        margin: '0 0 12px'
    },
    divider: {
        borderColor: '#e2e8f0',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
