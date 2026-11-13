import { Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject for S6's chargeback suspension notice (AC:B7:10). */
export const CHARGEBACK_SUSPENSION_SUBJECT =
    'Suspendimos tu suscripción por un desconocimiento del cargo';

/** Rendered facts of the chargeback suspension notice. */
export interface ChargebackSuspensionProps {
    readonly vertical: string;
    readonly amount: string;
    readonly chargedOn: string;
    readonly courtesyEnded: boolean;
    readonly touristVipLost: boolean;
    readonly oneTimeAddons: readonly { readonly name: string; readonly remainingDays: number }[];
    readonly subscriptionUrl: string;
}

/** Customer-facing S6 chargeback notice; it never renders internal identifiers. */
export function ChargebackSuspension(props: ChargebackSuspensionProps) {
    const verticalName = formatTrialVerticals({ verticals: [props.vertical] });
    return (
        <EmailLayout previewText={CHARGEBACK_SUSPENSION_SUBJECT}>
            <Heading>{CHARGEBACK_SUSPENSION_SUBJECT}</Heading>
            <Text>{`Tu suscripción de ${verticalName} se suspendió.`}</Text>
            <Text>{`Desconociste el cargo de ${props.amount} del día ${props.chargedOn} en tu banco. Mientras se resuelve, suspendimos el servicio. Si fue un error, podés volver a suscribirte desde acá: ${props.subscriptionUrl}`}</Text>
            {props.courtesyEnded ? <Text>La cortesía que tenías terminó hoy.</Text> : null}
            {props.touristVipLost ? (
                <Text>También perdés los beneficios de Turista VIP que te daba tu plan.</Text>
            ) : null}
            {props.oneTimeAddons.map((addon) => (
                <Text key={`${addon.name}:${addon.remainingDays}`}>
                    {`Tus addons de única vez siguen corriendo mientras estés suspendido: a «${addon.name}» le quedan ${addon.remainingDays === 1 ? '1 día' : `${addon.remainingDays} días`}.`}
                </Text>
            ))}
            {/* Proposed text (AC:B7:10, BS): owner approves or removes it in the PR */}
            <Text>Ya no se te va a cobrar: cancelamos la autorización de cobro.</Text>
            <Text>Una persona de nuestro equipo sigue el caso.</Text>
        </EmailLayout>
    );
}
