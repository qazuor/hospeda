import type { ListingContactActionsProps } from '@/components/listing/contact/ListingContactActions';
import { ListingContactActions } from '@/components/listing/contact/ListingContactActions';

/**
 * Props of the summary action island: everything `ListingContactActions` takes
 * except `origin`, which this island pins to `summary`.
 */
export type ListingSummaryActionsProps = Omit<ListingContactActionsProps, 'origin'>;

/**
 * The «Consultar» / «Ver carta» action of the venue and experience summaries
 * (HOS-2579 slot 2). A `.client.tsx` island on purpose: the web client graph
 * guards (`billing-barrel-client-isolation`) sweep islands by that suffix, the
 * same way the accommodation summary hydrates `MobileBookingSummaryActions`.
 */
export function ListingSummaryActions(props: ListingSummaryActionsProps) {
    return (
        <ListingContactActions
            {...props}
            origin="summary"
        />
    );
}
