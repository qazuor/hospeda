import { Text } from '@react-email/components';
import type { ReactNode } from 'react';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Props of the on-archive listing notice (AC:V6:28). */
export interface ListingArchivedProps {
    /** Vertical name as it reads inside a sentence (e.g. "alojamiento"). */
    readonly verticalName: string;
    /** PB4 archives a published listing; PB5 archives a draft, which never comes back on its own. */
    readonly transition: 'PB4' | 'PB5';
    /** Market-day date from which the listing content is deleted, already formatted. */
    readonly deletionDate: string;
    /** Listing-scoped addons on this listing. */
    readonly listingAddonCount: number;
}

/** Only a PB4 listing comes back on its own (PB7); a PB5 draft does not. */
const SELF_RESTORE_PARAGRAPH: Readonly<Record<ListingArchivedProps['transition'], ReactNode>> = {
    PB4: (
        <Text>
            Vuelve a publicarse sola cuando recuperes la cobertura o cuando tu cupo vuelva a
            alcanzar, si hay lugar para ella: vuelven primero las que se despublicaron al final.
        </Text>
    ),
    PB5: null
};

/**
 * Notice sent when PB4 or PB5 archives a listing for inactivity.
 *
 * @param props - {@link ListingArchivedProps}
 * @returns The email element
 */
export function ListingArchived({
    verticalName,
    transition,
    deletionDate,
    listingAddonCount
}: ListingArchivedProps) {
    return (
        <EmailLayout previewText={`Archivamos tu ficha de ${verticalName} por inactividad`}>
            <Heading>Archivamos tu ficha de {verticalName}</Heading>
            <Text>
                Tu ficha de {verticalName} estuvo inactiva y la archivamos: ya no se ve en el sitio,
                pero <strong>no borramos nada</strong>. Vos la seguís viendo en tu cuenta y podés
                exportarla.
            </Text>
            {SELF_RESTORE_PARAGRAPH[transition]}
            <Text>Si querés, podés pasarla a borrador cuando quieras, sin pagar.</Text>
            {listingAddonCount > 0 ? (
                <Text>
                    Los destaques que tengas sobre esta ficha siguen activos y, si son recurrentes,
                    se siguen cobrando aunque esté archivada, hasta que los des de baja.
                </Text>
            ) : null}
            <Text>
                Si no hacés nada, el contenido de la ficha se borra a partir del {deletionDate}.
            </Text>
        </EmailLayout>
    );
}
