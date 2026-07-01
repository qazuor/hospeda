import { Section, Text } from '@react-email/components';
import type { PromoOfferMatch } from '../../types/alert.types.js';
import { Button } from '../components/button.js';
import { formatCurrency, formatDate } from '../utils/index.js';
import { ALERT_DIGEST_SITE_BASE_URL } from './constants.js';

/**
 * Props for {@link PromoOfferItem}.
 */
export interface PromoOfferItemProps {
    /** The promo-offer match to render as a single row. */
    item: PromoOfferMatch;
}

/**
 * Builds a human-readable discount label from a {@link PromoOfferMatch}.
 *
 * `PromoOfferMatch` has no `currency` field (unlike `PriceDropMatch`), so a
 * `'fixed'` discount is formatted using the platform-wide default currency
 * (`'ARS'`) — there is no per-promotion currency to read at this layer.
 *
 * UNVERIFIED ASSUMPTION: `formatCurrency()` expects an integer-centavos
 * amount (see `templates/utils/format-helpers.ts`), matching this project's
 * general money convention, and `OwnerPromotion.discountValue` has no
 * explicit unit annotation on its Zod schema. The admin `discountValue` form
 * field (`apps/admin/.../PromotionFormDialog.tsx`) also does not document a
 * unit, and appears to reference a different/older discount-type option set
 * (`'FREE_NIGHT'`/`'SPECIAL_PRICE'`, uppercase) than the schema's real enum
 * (`'percentage'|'fixed'|'free_night'`, lowercase) — that mismatch looks
 * like a pre-existing, unrelated admin-UI issue, out of scope here. If a
 * `'fixed'`-type promo ever renders as `$0.50` instead of `$50`, re-verify
 * this unit assumption against how `discountValue` is actually persisted.
 *
 * @param item - The promo-offer match to describe
 * @returns Human-readable discount description
 */
function formatDiscountLabel(item: PromoOfferMatch): string {
    switch (item.discountType) {
        case 'percentage':
            return `${item.discountValue}% de descuento`;
        case 'fixed':
            return `${formatCurrency({ amount: item.discountValue, currency: 'ARS' })} de descuento`;
        case 'free_night':
            return 'Noche gratis';
        default:
            return `${item.discountValue} (${item.discountType})`;
    }
}

/**
 * Single promo-offer row inside {@link AlertDigestEmail}'s promo-offer
 * section: accommodation name, promotion title, discount description,
 * expiration date, and a CTA link to the accommodation detail page.
 *
 * @param props - The promo-offer match to render
 *
 * @example
 * ```tsx
 * <PromoOfferItem item={{
 *   promotionId: 'p1', accommodationId: 'acc1', accommodationSlug: 'cabana-del-rio',
 *   accommodationName: 'Cabaña del Río', promotionTitle: '2x1 fin de semana largo',
 *   discountType: 'percentage', discountValue: 20, validUntil: new Date('2026-08-01')
 * }} />
 * ```
 */
export function PromoOfferItem({ item }: PromoOfferItemProps) {
    const discountLabel = formatDiscountLabel(item);
    const validUntilLabel = item.validUntil
        ? formatDate({ dateString: item.validUntil.toISOString() })
        : 'Sin vencimiento';
    const ctaUrl = `${ALERT_DIGEST_SITE_BASE_URL}/alojamientos/${item.accommodationSlug}`;

    return (
        <Section style={styles.itemBox}>
            <Text style={styles.itemTitle}>{item.accommodationName}</Text>
            <Text style={styles.promotionTitle}>{item.promotionTitle}</Text>
            <Text style={styles.discountBadge}>{discountLabel}</Text>
            <Text style={styles.validUntil}>Válida hasta: {validUntilLabel}</Text>
            <Button
                href={ctaUrl}
                variant="secondary"
            >
                Ver alojamiento
            </Button>
        </Section>
    );
}

const styles = {
    itemBox: {
        backgroundColor: '#eff6ff',
        borderRadius: '8px',
        borderLeft: '4px solid #3b82f6',
        padding: '16px 20px',
        margin: '0 0 12px'
    },
    itemTitle: {
        color: '#1e293b',
        fontSize: '16px',
        fontWeight: '600',
        lineHeight: '22px',
        margin: '0 0 8px'
    },
    promotionTitle: {
        color: '#334155',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 4px'
    },
    discountBadge: {
        color: '#1d4ed8',
        fontSize: '15px',
        fontWeight: '700',
        lineHeight: '20px',
        margin: '0 0 4px'
    },
    validUntil: {
        color: '#64748b',
        fontSize: '13px',
        lineHeight: '18px',
        margin: '0 0 12px'
    }
};
