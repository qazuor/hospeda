import { Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Props of {@link ListingRestitution}. */
export interface ListingRestitutionProps {
    readonly restoredNames: readonly string[];
    readonly notRestoredNames: readonly string[];
    readonly accountUrl: string;
}

/**
 * `verticals.listing-restitution` (PB3/PB7; V/19 §4 row 19): which listings
 * came back, which did not, the criterion, and that the ones that did not
 * fit stay and are not deleted. Same wording as `listing.notices.restitution.*`
 * (`@repo/i18n`, V6.3).
 */
export function ListingRestitution({
    restoredNames,
    notRestoredNames,
    accountUrl
}: ListingRestitutionProps) {
    return (
        <EmailLayout previewText="Tus fichas volvieron a publicarse">
            <Heading>Tus fichas volvieron a publicarse</Heading>
            {restoredNames.length > 0 ? (
                <Text>Volvieron estas fichas: {restoredNames.join(', ')}.</Text>
            ) : null}
            {notRestoredNames.length > 0 ? (
                <Text>Estas fichas no entraron: {notRestoredNames.join(', ')}.</Text>
            ) : null}
            <Text>
                Vuelve primero la ficha que cayó al final, hasta llenar el cupo. Las fichas del
                sistema anterior que nunca se publicaron acá van primero, según su antigüedad de
                carga.
            </Text>
            {notRestoredNames.length > 0 ? (
                <Text>Las fichas que no entraron siguen ahí: no se borra ninguna.</Text>
            ) : null}
            <Button href={accountUrl}>Ir a Mi Cuenta</Button>
        </EmailLayout>
    );
}
