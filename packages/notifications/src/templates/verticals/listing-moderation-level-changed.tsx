import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import {
    LISTING_RETURNED_TO_COPY,
    type ListingReturnedTo,
    ModeratedListingBody
} from './listing-notice-shared.js';

/** Props of {@link ListingModerationLevelChanged}. */
export interface ListingModerationLevelChangedProps {
    readonly listingName: string;
    readonly reason: string;
    /** `null` when the fix request was raised to a moderation (PB10). */
    readonly returnedTo: ListingReturnedTo | null;
    readonly fixRequestOpen: boolean;
    readonly accountUrl: string;
    readonly subscriptionUrl: string;
}

/**
 * `verticals.listing-moderation-level-changed` (V/19 §4 row 30, the level
 * change): lowered to a moderation, it says what row 24 says; back to a
 * fix request only, it says where the listing went back to. Both say the
 * fix request stays open when it does.
 */
export function ListingModerationLevelChanged({
    listingName,
    reason,
    returnedTo,
    fixRequestOpen,
    accountUrl,
    subscriptionUrl
}: ListingModerationLevelChangedProps) {
    return (
        <EmailLayout previewText="Cambió la moderación de tu ficha">
            <Heading>Cambió la moderación de tu ficha</Heading>
            {returnedTo === null ? (
                <ModeratedListingBody
                    listingName={listingName}
                    reason={reason}
                    subscriptionUrl={subscriptionUrl}
                />
            ) : (
                <>
                    <Text>
                        Tu ficha {listingName} ya no está moderada: volvió a quedar sólo con un
                        pedido de arreglo.
                    </Text>
                    <Text>{LISTING_RETURNED_TO_COPY[returnedTo]}</Text>
                </>
            )}
            {fixRequestOpen ? (
                <Text>
                    El pedido de arreglo sigue abierto. Cuando lo corrijas, avisanos desde Mi
                    Cuenta.
                </Text>
            ) : null}
            <Button href={accountUrl}>Ir a Mi Cuenta</Button>
        </EmailLayout>
    );
}
