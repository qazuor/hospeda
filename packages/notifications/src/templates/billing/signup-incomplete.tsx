import { Text } from '@react-email/components';
import { Button, EmailLayout } from '@repo/email';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';

export interface SignupIncompleteProps {
    readonly vertical: string;
    readonly closedCourtesyMonths: number | null;
    /** Absolute URL of Mi Suscripción, built by the renderer from the site URL. */
    readonly actionUrl: string;
}

export function SignupIncomplete({
    vertical,
    closedCourtesyMonths,
    actionUrl
}: SignupIncompleteProps) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    return (
        <EmailLayout previewText="Tu alta quedó sin completarse">
            <Heading>Tu alta quedó sin completarse</Heading>
            <Text>El alta de {verticalName} quedó sin completarse.</Text>
            {closedCourtesyMonths === null ? null : (
                <Text>También se cerró tu saldo de {closedCourtesyMonths} meses de cortesía.</Text>
            )}
            <Text>Podés volver a suscribirte cuando quieras.</Text>
            <Button href={actionUrl}>Volver a suscribirme</Button>
        </EmailLayout>
    );
}
