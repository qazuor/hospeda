/**
 * Catalog entry of the alerts & offers daily digest (`EmailAlertChannel`).
 *
 * @module catalog/entries/alert-digest
 */

import { resolveAlertDigestSubject } from '../../services/channels/email-alert.channel.js';
import { AlertDigestEmail } from '../../templates/alerts/AlertDigestEmail.js';
import type {
    AlertDigestPayload,
    PriceDropMatch,
    PromoOfferMatch
} from '../../types/alert.types.js';
import { defineEmailCatalogEntry } from '../define-entry.js';
import { SAMPLE_RECIPIENT } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

const PRICE_DROP: PriceDropMatch = {
    alertId: '00000000-0000-4000-8000-0000000000d1',
    userId: SAMPLE_RECIPIENT.userId,
    accommodationId: '00000000-0000-4000-8000-0000000000d2',
    accommodationSlug: 'cabanas-del-rio-ejemplo',
    accommodationName: 'Cabañas del Río (ejemplo)',
    basePriceSnapshot: 60000,
    currentPrice: 48000,
    dropPercent: 20,
    currency: 'ARS'
};

const PROMO_PERCENTAGE: PromoOfferMatch = {
    promotionId: '00000000-0000-4000-8000-0000000000d3',
    accommodationId: '00000000-0000-4000-8000-0000000000d4',
    accommodationName: 'Posada del Litoral (ejemplo)',
    accommodationSlug: 'posada-del-litoral-ejemplo',
    promotionTitle: 'Escapada de otoño',
    discountType: 'percentage',
    discountValue: 15,
    validUntil: new Date('2026-03-31T23:59:59.000Z')
};

const PROMO_FREE_NIGHT: PromoOfferMatch = {
    promotionId: '00000000-0000-4000-8000-0000000000d5',
    accommodationId: '00000000-0000-4000-8000-0000000000d6',
    accommodationName: 'Complejo Las Palmeras (ejemplo)',
    accommodationSlug: 'complejo-las-palmeras-ejemplo',
    promotionTitle: 'Tercera noche gratis',
    discountType: 'free_night',
    discountValue: 1,
    validUntil: null
};

const BASE: Omit<AlertDigestPayload, 'priceDrop' | 'promoOffers'> = {
    userId: SAMPLE_RECIPIENT.userId,
    userEmail: SAMPLE_RECIPIENT.recipientEmail,
    locale: 'es'
};

/** The alerts & offers digest. */
export const ALERT_DIGEST_ENTRIES: readonly EmailCatalogEntry[] = [
    defineEmailCatalogEntry<AlertDigestPayload>({
        sendPath: 'alert-digest',
        id: 'alerts-digest',
        name: 'Resumen de alertas de precios y ofertas',
        domain: 'alerts',
        scenarios: [
            {
                id: 'price-drops-and-offers',
                label: 'Bajas de precio y ofertas',
                input: {
                    ...BASE,
                    priceDrop: [PRICE_DROP],
                    promoOffers: [PROMO_PERCENTAGE, PROMO_FREE_NIGHT]
                }
            },
            {
                id: 'price-drops-only',
                label: 'Solo bajas de precio',
                input: { ...BASE, priceDrop: [PRICE_DROP], promoOffers: [] }
            },
            {
                id: 'offers-only',
                label: 'Solo ofertas',
                input: { ...BASE, priceDrop: [], promoOffers: [PROMO_PERCENTAGE] }
            },
            {
                id: 'english-locale',
                label: 'Idioma inglés (cambia solo el asunto)',
                input: { ...BASE, locale: 'en', priceDrop: [PRICE_DROP], promoOffers: [] }
            }
        ],
        render: ({ scenario }) => ({
            subject: resolveAlertDigestSubject({ locale: scenario.locale }),
            react: AlertDigestEmail(scenario),
            warnings: []
        })
    })
];
