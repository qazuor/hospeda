import { Text } from '@react-email/components';
import { EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';

/** Resolved copy of the late payment refunded mail (HOS-2179 P-3, D3). */
export interface LatePaymentRefundedProps {
    readonly preview: string;
    readonly heading: string;
    readonly paragraphs: readonly string[];
}

/**
 * Tells the buyer that a one-time add-on payment reached Hospeda after the purchase had
 * closed, so nothing was activated, and that the amount was refunded.
 */
export function LatePaymentRefunded({ preview, heading, paragraphs }: LatePaymentRefundedProps) {
    return (
        <EmailLayout previewText={preview}>
            <Heading>{heading}</Heading>
            {paragraphs.map((paragraph) => (
                <Text key={paragraph}>{paragraph}</Text>
            ))}
        </EmailLayout>
    );
}
