import { Section, Text } from '@react-email/components';
import type { PriceDropMatch } from '../../types/alert.types.js';
import { Button } from '../components/button.js';
import { formatCurrency } from '../utils/index.js';
import { ALERT_DIGEST_SITE_BASE_URL } from './constants.js';

/**
 * Props for {@link PriceDropItem}.
 */
export interface PriceDropItemProps {
    /** The price-drop match to render as a single row. */
    item: PriceDropMatch;
}

/**
 * Single price-drop row inside {@link AlertDigestEmail}'s price-drop
 * section: accommodation name, previous vs current price, drop percentage,
 * and a CTA link to the accommodation detail page.
 *
 * `item.currency` defaults to `'ARS'` when unset (mirrors the platform-wide
 * default currency, since `PriceDropEvaluatorService` may omit it when the
 * accommodation's price JSONB has no `currency` field).
 *
 * @param props - The price-drop match to render
 *
 * @example
 * ```tsx
 * <PriceDropItem item={{
 *   alertId: 'a1', userId: 'u1', accommodationId: 'acc1',
 *   accommodationSlug: 'cabana-del-rio', accommodationName: 'Cabaña del Río',
 *   basePriceSnapshot: 500000, currentPrice: 425000, dropPercent: 15,
 *   currency: 'ARS'
 * }} />
 * ```
 */
export function PriceDropItem({ item }: PriceDropItemProps) {
    const currency = item.currency ?? 'ARS';
    const previousPrice = formatCurrency({ amount: item.basePriceSnapshot, currency });
    const currentPrice = formatCurrency({ amount: item.currentPrice, currency });
    const ctaUrl = `${ALERT_DIGEST_SITE_BASE_URL}/alojamientos/${item.accommodationSlug}`;

    return (
        <Section style={styles.itemBox}>
            <Text style={styles.itemTitle}>{item.accommodationName}</Text>
            <Text style={styles.previousPrice}>Precio anterior: {previousPrice}</Text>
            <Text style={styles.currentPrice}>
                Precio actual: <strong>{currentPrice}</strong>
            </Text>
            <Text style={styles.dropBadge}>Bajó un {item.dropPercent}%</Text>
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
        backgroundColor: '#f0fdf4',
        borderRadius: '8px',
        borderLeft: '4px solid #22c55e',
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
    previousPrice: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 2px',
        textDecoration: 'line-through'
    },
    currentPrice: {
        color: '#1e293b',
        fontSize: '15px',
        lineHeight: '20px',
        margin: '0 0 8px'
    },
    dropBadge: {
        color: '#15803d',
        fontSize: '14px',
        fontWeight: '700',
        lineHeight: '20px',
        margin: '0 0 12px'
    }
};
