import type { ListingContactActionsProps } from '@/components/listing/contact/ListingContactActions';
import { ListingContactActions } from '@/components/listing/contact/ListingContactActions';

/** Identifies the public listing and available channels for the compact summary. */
export type MobileBookingSummaryActionsProps = Pick<
    ListingContactActionsProps,
    'listingId' | 'panelId' | 'locale' | 'hasWhatsapp'
> &
    Partial<Pick<ListingContactActionsProps, 'primaryLabelKey'>>;

/** Opens the contact sheet from the inline price and host summary. */
export function MobileBookingSummaryActions({
    primaryLabelKey = 'accommodations.detail.listingContact.bar.inquire',
    ...props
}: MobileBookingSummaryActionsProps) {
    return (
        <ListingContactActions
            {...props}
            vertical="accommodation"
            origin="summary"
            primaryLabelKey={primaryLabelKey}
        />
    );
}
