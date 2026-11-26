import { z } from 'zod';
import { DockPortal } from '@/components/shared/dock/DockPortal';
import { createTranslations } from '@/lib/i18n';
import { LISTING_BAR_TEL_HREF_PATTERN } from '@/lib/listing-contact/listing-action-bar';
import {
    getListingContactPrice,
    listingContactPriceSchema
} from '@/lib/listing-contact/listing-contact-price';
import { venueMenuGlyphSchema } from '@/lib/listing-contact/venue-menu-glyph';
import { ListingActionBarButtons } from './ListingActionBarButtons';
import styles from './ListingContactBar.module.css';

const propsSchema = z
    .object({
        vertical: z.enum(['accommodation', 'experience', 'venue']),
        listingId: z.string().min(1),
        listingName: z.string().min(1),
        locale: z.enum(['es', 'en', 'pt']),
        price: listingContactPriceSchema,
        panelId: z.string().min(1),
        fallbackHref: z
            .string()
            .regex(/^#[\w-]+$/)
            .default('#contact'),
        /** Position 1: the panel («Consultar»), the venue menu («Ver carta») or nothing. */
        primary: z
            .union([
                z.object({ kind: z.literal('inquire') }).readonly(),
                z
                    .object({
                        kind: z.literal('menu'),
                        href: z.string().url(),
                        /** HOS-2607: fork and knife (`food`) or a drink (`nightlife`). */
                        glyph: venueMenuGlyphSchema.default('food')
                    })
                    .readonly()
            ])
            .nullable(),
        /**
         * Accommodation only (HOS-19 gate resolved inside the panel). The public
         * payload types it optional, and an absent flag must not reject the props:
         * a rejected bar renders nothing and unpins the dock.
         */
        hasWhatsapp: z.boolean().default(false),
        /** Venue only: the HOS-2256 public state. */
        venueWhatsapp: z
            .union([
                z.object({ mode: z.literal('PUBLIC'), number: z.string().min(1) }).readonly(),
                z.object({ mode: z.literal('LOGGED_IN_ONLY') }).readonly()
            ])
            .nullable()
            .default(null),
        phoneHref: z.string().regex(LISTING_BAR_TEL_HREF_PATTERN).nullable(),
        shareUrl: z.string().url(),
        compare: z
            .object({
                thumbnailUrl: z.string().optional(),
                planName: z.string().nullable().optional(),
                planCapacity: z.number().int().positive().optional()
            })
            .readonly()
            .nullable()
            .default(null)
    })
    .readonly();

/** Session-blind props for the listing's mobile dock control. */
export type ListingContactBarProps = z.input<typeof propsSchema>;

/**
 * Renders the listing price and the icon-only action row (HOS-2579 §6.10) in
 * the measured mobile dock. Favorito and Compartir always exist, so the bar
 * (and therefore the pinned `contact` dock slot) renders on every listing page.
 */
export function ListingContactBar(props: ListingContactBarProps) {
    const parsed = propsSchema.safeParse(props);
    if (!parsed.success) return null;
    const { price, ...actions } = parsed.data;
    const display = getListingContactPrice({ price, locale: actions.locale });

    return (
        <DockPortal slot="contact">
            <div
                className={styles.bar}
                data-dock-item
            >
                {display?.onRequest && (
                    // HOS-2607: a status, not a figure. Same line box as a priced
                    // line, at caption weight, so it never outweighs the buttons.
                    <p
                        className={styles.price}
                        data-price-state="on-request"
                    >
                        <span className={styles.onRequest}>{display.amount}</span>
                    </p>
                )}
                {display && !display.onRequest && (
                    <p
                        className={styles.price}
                        data-price-state="amount"
                    >
                        {display.unit && (
                            <span className={styles.prefix}>
                                {createTranslations(actions.locale).t(
                                    'accommodations.detail.pricing.from'
                                )}
                            </span>
                        )}
                        <span className={styles.line}>
                            <strong className={styles.amount}>{display.amount}</strong>
                            {display.unit && <span className={styles.unit}>{display.unit}</span>}
                        </span>
                    </p>
                )}
                <ListingActionBarButtons {...actions} />
            </div>
        </DockPortal>
    );
}
