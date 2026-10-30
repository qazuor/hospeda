import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Props for the last discounted charge notice. */
export interface PromoEndingProps {
    readonly planName: string;
    readonly lastDiscountedChargeDate: string;
    readonly amountAfter: string;
}

/** Subject of the transactional notice before a finite promo ends. */
export const PROMO_ENDING_SUBJECT = 'Tu promo termina';

/** Announces the last discounted charge and the following amount. */
export function PromoEnding({
    planName: _planName,
    lastDiscountedChargeDate,
    amountAfter
}: PromoEndingProps) {
    return (
        <EmailLayout previewText={PROMO_ENDING_SUBJECT}>
            <Heading>{PROMO_ENDING_SUBJECT}</Heading>
            <Text>
                Tu promo termina con el cobro del{' '}
                {formatDate({ dateString: lastDiscountedChargeDate })}.
            </Text>
            <Text>Desde el mes que viene pagás {amountAfter}.</Text>
            <Text>Mercado Pago te va a mandar un correo avisando que cambió el monto.</Text>
        </EmailLayout>
    );
}
