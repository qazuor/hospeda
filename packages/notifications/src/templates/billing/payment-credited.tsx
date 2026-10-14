import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Subject of P1's credited-payment receipt notice (HOS-1675). */
export const PAYMENT_CREDITED_SUBJECT = 'Recibimos tu pago';

/** P1 transition: the credited-payment receipt email (HOS-1675). */
export function PaymentCredited({
    amount,
    receiptNumber,
    creditedDate
}: {
    readonly amount: string;
    readonly receiptNumber: number;
    readonly creditedDate: string;
}) {
    return (
        <EmailLayout previewText={PAYMENT_CREDITED_SUBJECT}>
            <Heading>{PAYMENT_CREDITED_SUBJECT}</Heading>
            <Text>Acreditamos tu pago de {amount}.</Text>
            <Text>
                Comprobante n.º {receiptNumber}, del {creditedDate}.
            </Text>
            <Text>
                Es un comprobante no fiscal: no es una factura. Guardá este correo como constancia
                de tu pago.
            </Text>
        </EmailLayout>
    );
}
