import { Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject and heading of the arrears suspension notice. */
export const ARREARS_SUSPENSION_SUBJECT = 'Tu suscripción se suspendió';

/** A one-time addon whose days keep running while the subscription is suspended. */
export interface ArrearsSuspensionOneTimeAddon {
    readonly name: string;
    readonly remainingDays: number;
}

/** Props of the arrears suspension notice (AC:B7:30, `B/19` §4 row 10). */
export interface ArrearsSuspensionProps {
    readonly vertical: string;
    readonly paymentMethod: 'CARD' | 'MANUAL';
    readonly touristVipLost: boolean;
    readonly oneTimeAddons: readonly ArrearsSuspensionOneTimeAddon[];
    readonly promoLost: boolean;
}

function comeBackLines(input: {
    readonly paymentMethod: 'CARD' | 'MANUAL';
    readonly promoLost: boolean;
}): readonly string[] {
    switch (input.paymentMethod) {
        case 'CARD':
            return [
                'Tu suscripción se suspendió y ya no se te va a cobrar —tampoco tus addons recurrentes, que quedan pausados y vuelven cuando vuelvas—; para reactivarla, volvé a suscribirte con una tarjeta que funcione.',
                ...(input.promoLost ? ['Si tenías una promo, al volver la perdés.'] : [])
            ];
        case 'MANUAL':
            return ['Para volver, registrá el pago de la cuota adeudada.'];
        default: {
            const unreachable: never = input.paymentMethod;
            return unreachable;
        }
    }
}

function addonLine(addon: ArrearsSuspensionOneTimeAddon): string {
    const days = addon.remainingDays === 1 ? '1 día' : `${addon.remainingDays} días`;
    return `Tus addons de única vez siguen corriendo mientras estés suspendido: a «${addon.name}» le quedan ${days}.`;
}

/**
 * The arrears suspension notice: what the person loses as a tourist, the
 * one-time addon days that run out, and how to come back by payment method.
 * It never shows identifiers.
 */
export function ArrearsSuspension({
    vertical,
    paymentMethod,
    touristVipLost,
    oneTimeAddons,
    promoLost
}: ArrearsSuspensionProps) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    return (
        <EmailLayout previewText={ARREARS_SUSPENSION_SUBJECT}>
            <Heading>{ARREARS_SUSPENSION_SUBJECT}</Heading>
            <Text>{`Tu suscripción de ${verticalName} se suspendió.`}</Text>
            {comeBackLines({ paymentMethod, promoLost }).map((line) => (
                <Text key={line}>{line}</Text>
            ))}
            {touristVipLost ? (
                <Text>También perdés los beneficios de Turista VIP que te daba tu plan.</Text>
            ) : null}
            {oneTimeAddons.map((addon) => (
                <Text key={`${addon.name}:${addon.remainingDays}`}>{addonLine(addon)}</Text>
            ))}
        </EmailLayout>
    );
}
