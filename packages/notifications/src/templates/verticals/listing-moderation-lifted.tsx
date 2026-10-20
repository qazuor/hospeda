import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { LISTING_RETURNED_TO_COPY, type ListingReturnedTo } from './listing-notice-shared.js';

/** Props of {@link ListingModerationLifted}. */
export interface ListingModerationLiftedProps {
    readonly listingName: string;
    readonly returnedTo: ListingReturnedTo;
    readonly accountUrl: string;
}

/**
 * `verticals.listing-moderation-lifted` (V/19 §4 row 30, lifted): where the
 * listing went back to and, back in draft, that publishing it is the
 * owner's call.
 */
export function ListingModerationLifted({
    listingName,
    returnedTo,
    accountUrl
}: ListingModerationLiftedProps) {
    return (
        <EmailLayout previewText="Se levantó la moderación de tu ficha">
            <Heading>Se levantó la moderación de tu ficha</Heading>
            <Text>Tu ficha {listingName} ya no tiene ninguna moderación ni pedido de arreglo.</Text>
            <Text>{LISTING_RETURNED_TO_COPY[returnedTo]}</Text>
            <Button href={accountUrl}>Ir a Mi Cuenta</Button>
        </EmailLayout>
    );
}
