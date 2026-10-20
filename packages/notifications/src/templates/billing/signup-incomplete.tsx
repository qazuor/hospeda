import { Text } from '@react-email/components';
import { formatTrialVerticals } from '../../utils/product-domain-copy.js';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

export interface SignupIncompleteProps {
    readonly vertical: string;
    readonly closedCourtesyMonths: number | null;
}

export function SignupIncomplete({ vertical, closedCourtesyMonths }: SignupIncompleteProps) {
    const verticalName = formatTrialVerticals({ verticals: [vertical] });
    return (
        <EmailLayout previewText="Tu alta quedó sin completarse">
            <Heading>Tu alta quedó sin completarse</Heading>
            <Text>El alta de {verticalName} quedó sin completarse.</Text>
            {closedCourtesyMonths === null ? null : (
                <Text>También se cerró tu saldo de {closedCourtesyMonths} meses de cortesía.</Text>
            )}
            <Text>Podés volver a suscribirte cuando quieras.</Text>
        </EmailLayout>
    );
}
