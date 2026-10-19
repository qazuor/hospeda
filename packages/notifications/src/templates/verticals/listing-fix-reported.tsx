import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Props of {@link ListingFixReported}. */
export interface ListingFixReportedProps {
    readonly listingName: string;
    readonly verticalLabel: string;
    readonly listingId: string;
    readonly ownerId: string;
    readonly fixRequestId: string;
    readonly reason: string;
    readonly suggestedDate: string | null;
    readonly requestedAt: string;
    readonly reportedAt: string;
}

/** Subject of the owner-reported fix notice to staff. */
export const LISTING_FIX_REPORTED_SUBJECT = 'Un dueño avisó que corrigió su ficha';

/** Tells staff that the owner reported a fix while the request remains open. */
export function ListingFixReported(props: ListingFixReportedProps) {
    return (
        <EmailLayout previewText={LISTING_FIX_REPORTED_SUBJECT}>
            <Heading>{LISTING_FIX_REPORTED_SUBJECT}</Heading>
            <Text>
                El dueño de la ficha {props.listingName} ({props.verticalLabel}) avisó que ya
                corrigió lo que se le pidió.
            </Text>
            <Text>Lo avisó el {formatDate({ dateString: props.reportedAt })}.</Text>
            <Text>Pedido original: {props.reason}.</Text>
            {props.suggestedDate === null ? null : (
                <Text>
                    Fecha sugerida para arreglarlo:{' '}
                    {formatDate({ dateString: props.suggestedDate })}.
                </Text>
            )}
            <Text>El pedido se abrió el {formatDate({ dateString: props.requestedAt })}.</Text>
            <Text>
                Ficha: {props.listingId}. Dueño: {props.ownerId}. Pedido: {props.fixRequestId}.
            </Text>
            <Text>
                El pedido sigue abierto: lo cierra un admin, que puede cerrarlo, bajar la ficha o
                levantarla desde el panel de administración.
            </Text>
        </EmailLayout>
    );
}
