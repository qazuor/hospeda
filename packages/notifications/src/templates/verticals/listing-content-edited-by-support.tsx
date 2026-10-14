import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of action 15's support content edit notice (HOS-1675, catalog row 26). */
export const LISTING_CONTENT_EDITED_BY_SUPPORT_SUBJECT = 'Soporte editó tu ficha';

/** Action 15 transition: the support content edit email for catalog row 26 (HOS-1675). */
export function ListingContentEditedBySupport({
    listingName,
    editedDate,
    partsText,
    contactUrl
}: {
    readonly listingName: string;
    readonly editedDate: string;
    readonly partsText: string | null;
    readonly contactUrl: string;
}) {
    return (
        <EmailLayout previewText={LISTING_CONTENT_EDITED_BY_SUPPORT_SUBJECT}>
            <Heading>{LISTING_CONTENT_EDITED_BY_SUPPORT_SUBJECT}</Heading>
            <Text>
                Soporte editó el contenido de tu ficha {listingName} el {editedDate}
                {partsText === null ? '.' : `: ${partsText}.`}
            </Text>
            <Text>No se publicó, no se destacó ni se borró por eso.</Text>
            <Text>Si no lo pediste, escribinos: {contactUrl}</Text>
        </EmailLayout>
    );
}
