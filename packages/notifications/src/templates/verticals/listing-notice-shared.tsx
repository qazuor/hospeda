import { Text } from '@react-email/components';

/**
 * Where a listing ended up after a moderation was lowered back to a fix
 * request or lifted (`returnedTo` of the moderation notices, V/19 §4 row 30).
 * Literal values of `PublicationStatusEnum` (`@repo/schemas`), which this
 * package does not depend on.
 */
export type ListingReturnedTo = 'PUBLISHED' | 'DRAFT' | 'UNPUBLISHED_BY_BILLING' | 'ARCHIVED';

/** The sentence that says where the listing went back to, per destination. */
export const LISTING_RETURNED_TO_COPY: Readonly<Record<ListingReturnedTo, string>> = {
    PUBLISHED: 'Volvió a estar publicada: ya se ve en el sitio.',
    DRAFT: 'Volvió a borrador. Publicarla es decisión tuya: la publicás desde Mi Cuenta cuando quieras.',
    UNPUBLISHED_BY_BILLING:
        'Quedó sin publicar, porque hoy tu suscripción no tiene lugar para ella. No se borró nada.',
    ARCHIVED: 'Sigue archivada, como estaba.'
};

/** Props of {@link ModeratedListingBody}. */
export interface ModeratedListingBodyProps {
    readonly listingName: string;
    readonly reason: string;
    readonly subscriptionUrl: string;
}

/**
 * What a moderated listing notice has to say (V/19 §4 row 24): the reason,
 * that the listing is hidden until an admin lifts the moderation, what the
 * owner can still do, and the recurring featured add-ons that keep being
 * charged. The payload does not carry the add-ons, so that line is
 * conditional (H7 of HOS-1492).
 */
export function ModeratedListingBody({
    listingName,
    reason,
    subscriptionUrl
}: ModeratedListingBodyProps) {
    return (
        <>
            <Text>Un administrador moderó tu ficha {listingName}.</Text>
            <Text>Motivo: {reason}</Text>
            <Text>
                La ficha no se ve en el sitio hasta que un administrador levante la moderación.
            </Text>
            <Text>
                Mientras tanto podés verla, exportarla, editarla para arreglar lo que se te pide y
                borrarla. Lo que no podés es publicarla.
            </Text>
            <Text>
                Si tenés destaques recurrentes sobre esta ficha, se siguen cobrando hasta que los
                des de baja. Los das de baja desde Mi Suscripción: {subscriptionUrl}
            </Text>
        </>
    );
}
