import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for SubscriptionCancelConfirmed email template (SPEC-147).
 *
 * Sent when a user initiates a soft-cancel (end-of-period cancellation).
 * The subscription remains active until `accessUntil`, which is the key
 * difference from {@link SubscriptionCancelled} (hard-cancel / webhook).
 */
export interface SubscriptionCancelConfirmedProps {
    readonly recipientName: string;
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end.
     * The user keeps full access until this date despite the cancellation.
     */
    readonly accessUntil: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Soft-cancel confirmation email template (SPEC-147).
 *
 * Sent immediately when a user successfully cancels their subscription
 * at the end of the current billing period. Unlike the hard-cancel webhook
 * notification, this email reassures the user that their access is preserved
 * until the `accessUntil` date.
 *
 * @param props - Soft-cancel confirmation data
 */
export function SubscriptionCancelConfirmed({
    recipientName,
    planName,
    accessUntil,
    baseUrl
}: SubscriptionCancelConfirmedProps) {
    const formattedAccessUntil = formatDate({ dateString: accessUntil });

    return (
        <EmailLayout
            previewText={`Your ${planName} cancellation is confirmed — you keep access until ${formattedAccessUntil}`}
            showUnsubscribe={false}
        >
            <Heading>Cancellation confirmed</Heading>

            <Text style={styles.greeting}>Hi {recipientName},</Text>

            <Text style={styles.paragraph}>
                We have confirmed the cancellation of your <strong>{planName}</strong> subscription.
                Your cancellation takes effect at the end of the current billing period.
            </Text>

            <Text style={styles.accessBanner}>
                You keep full access until <strong>{formattedAccessUntil}</strong>.
            </Text>

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Plan"
                    value={planName}
                />
                <InfoRow
                    label="Access until"
                    value={formattedAccessUntil}
                />
                <InfoRow
                    label="Status"
                    value="Cancelled at period end"
                />
            </Section>

            <Text style={styles.paragraph}>
                After {formattedAccessUntil} your account will revert to the free plan and no
                further charges will be made.
            </Text>

            <Text style={styles.paragraph}>
                Changed your mind? You can reactivate your subscription at any time before the
                period ends.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/precios/propietarios`}>Reactivate subscription</Button>
            </Section>
        </EmailLayout>
    );
}

const styles = {
    greeting: {
        color: '#1e293b',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    paragraph: {
        color: '#475569',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 16px'
    },
    accessBanner: {
        color: '#0f766e',
        fontSize: '16px',
        lineHeight: '24px',
        fontWeight: '600',
        margin: '0 0 16px'
    },
    infoBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #0f766e',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    }
};
