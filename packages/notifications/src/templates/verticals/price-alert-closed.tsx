import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Props of {@link PriceAlertClosed}. */
export interface PriceAlertClosedProps {
    readonly listingName: string;
}

/**
 * `verticals.price-alert-closed` (V/19 §4 row 27): the tourist's price alert
 * closed because its listing no longer exists. It never says why the listing
 * stopped existing: that belongs to the owner (row 20).
 */
export function PriceAlertClosed({ listingName }: PriceAlertClosedProps) {
    return (
        <EmailLayout previewText="Tu alerta de precio se cerró">
            <Heading>Tu alerta de precio se cerró</Heading>
            <Text>
                La alerta de precio que tenías sobre {listingName} se cerró porque esa ficha ya no
                existe.
            </Text>
            <Text>No vas a recibir más avisos de precio sobre ella.</Text>
        </EmailLayout>
    );
}
