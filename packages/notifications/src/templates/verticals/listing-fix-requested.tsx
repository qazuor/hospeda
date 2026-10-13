import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Props of {@link ListingFixRequested}. */
export interface ListingFixRequestedProps {
    readonly listingName: string;
    readonly reason: string;
    readonly suggestedDate: string | null;
    readonly accountUrl: string;
}

/**
 * `verticals.listing-fix-requested` (V/19 §4 row 30, the request): the
 * reason, the suggested date when there is one, that the listing stays
 * visible, and where to tell that it was fixed.
 */
export function ListingFixRequested({
    listingName,
    reason,
    suggestedDate,
    accountUrl
}: ListingFixRequestedProps) {
    return (
        <EmailLayout previewText="Te pedimos un arreglo en tu ficha">
            <Heading>Te pedimos un arreglo en tu ficha</Heading>
            <Text>Un administrador te pide que arregles algo en tu ficha {listingName}.</Text>
            <Text>Motivo: {reason}</Text>
            {suggestedDate === null ? null : (
                <Text>
                    Fecha sugerida para arreglarlo: {formatDate({ dateString: suggestedDate })}.
                </Text>
            )}
            <Text>Tu ficha sigue a la vista: no la bajamos.</Text>
            <Text>
                Cuando lo corrijas, avisanos desde Mi Cuenta con el botón para avisar que ya lo
                corregiste.
            </Text>
            <Button href={accountUrl}>Ir a Mi Cuenta</Button>
        </EmailLayout>
    );
}
