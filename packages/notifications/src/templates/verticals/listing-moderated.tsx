import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { ModeratedListingBody } from './listing-notice-shared.js';

/** Props of {@link ListingModerated}. */
export interface ListingModeratedProps {
    readonly listingName: string;
    readonly reason: string;
    readonly subscriptionUrl: string;
}

/** `verticals.listing-moderated` (PB10; V/19 §4 row 24). */
export function ListingModerated({ listingName, reason, subscriptionUrl }: ListingModeratedProps) {
    return (
        <EmailLayout previewText="Moderamos tu ficha">
            <Heading>Tu ficha está moderada</Heading>
            <ModeratedListingBody
                listingName={listingName}
                reason={reason}
                subscriptionUrl={subscriptionUrl}
            />
        </EmailLayout>
    );
}
