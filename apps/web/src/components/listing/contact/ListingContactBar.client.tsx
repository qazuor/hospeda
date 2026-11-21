import { z } from 'zod';
import { DockPortal } from '@/components/shared/dock/DockPortal';
import {
    getListingContactPrice,
    listingContactPriceSchema
} from '@/lib/listing-contact/listing-contact-price';
import { ListingContactActions } from './ListingContactActions';
import styles from './ListingContactBar.module.css';

const propsSchema = z
    .object({
        vertical: z.enum(['accommodation', 'experience', 'venue']),
        listingId: z.string().min(1),
        locale: z.enum(['es', 'en', 'pt']),
        price: listingContactPriceSchema,
        hasWhatsapp: z.boolean(),
        primaryLabelKey: z.string().min(1),
        panelId: z.string().min(1)
    })
    .readonly();

/** Session-blind props for the listing's mobile dock control. */
export type ListingContactBarProps = z.infer<typeof propsSchema>;

/** Renders the listing price and contact triggers in the measured mobile dock. */
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
                {display && (
                    <p className={styles.price}>
                        <strong>{display.amount}</strong>{' '}
                        {display.unit && <span>{display.unit}</span>}
                    </p>
                )}
                <ListingContactActions
                    {...actions}
                    origin="bar"
                />
            </div>
        </DockPortal>
    );
}
