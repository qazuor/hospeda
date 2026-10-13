import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Props of {@link ListingPurged}. */
export interface ListingPurgedProps {
    readonly listingName: string;
    readonly bySupport: boolean;
}

/**
 * `verticals.listing-purged` (PB12, every exit state; V/19 §4 row 31 when it
 * left `MODERATED`): the listing was deleted, what was deleted, and that it
 * does not come back. Deleted by support (action 23), it carries one more
 * line: it was deleted at the owner's request.
 */
export function ListingPurged({ listingName, bySupport }: ListingPurgedProps) {
    return (
        <EmailLayout previewText="Se borró tu ficha">
            <Heading>Se borró tu ficha</Heading>
            <Text>Se borró tu ficha {listingName}.</Text>
            {bySupport ? <Text>Soporte la borró a pedido tuyo.</Text> : null}
            <Text>
                Se borró su contenido: los textos, las fotos, las preguntas frecuentes y los
                horarios.
            </Text>
            <Text>La ficha no vuelve: no se puede recuperar.</Text>
        </EmailLayout>
    );
}
