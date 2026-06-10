import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for SubscriptionAccessEndingSoon email template (SPEC-147 T-010).
 *
 * Sent ~3 days before a soft-cancelled subscription's `current_period_end`
 * by the `finalize-cancelled-subs` cron. The subscription is still active;
 * the email nudges the user to reactivate before access is lost.
 */
export interface SubscriptionAccessEndingSoonProps {
    readonly recipientName: string;
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end.
     * Access will be revoked on this date if the sub is not reactivated.
     */
    readonly accessUntil: string;
    /**
     * Number of days remaining until access is lost (ceiling-rounded).
     */
    readonly daysRemaining: number;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * D3 "access ending soon" reminder email template (SPEC-147 T-010).
 *
 * Sent approximately 3 days before the soft-cancelled subscription's
 * `current_period_end`. Unlike the cancel-confirmed email (T-004), this is
 * a reminder — the user can still reactivate before access is revoked.
 *
 * @param props - D3 access-ending reminder data
 */
export function SubscriptionAccessEndingSoon({
    recipientName,
    planName,
    accessUntil,
    daysRemaining,
    baseUrl
}: SubscriptionAccessEndingSoonProps) {
    const formattedAccessUntil = formatDate({ dateString: accessUntil });

    return (
        <EmailLayout
            previewText={`Your ${planName} access ends in ${daysRemaining} days — reactivate now`}
            showUnsubscribe={false}
        >
            <Heading>Your access is ending soon</Heading>

            <Text style={styles.greeting}>Hi {recipientName},</Text>

            <Text style={styles.paragraph}>
                This is a reminder that your <strong>{planName}</strong> access ends in{' '}
                <strong>
                    {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                </strong>
                . After this date your account will revert to the free plan.
            </Text>

            <Text style={styles.accessBanner}>
                Your access expires on <strong>{formattedAccessUntil}</strong>.
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
                    label="Days remaining"
                    value={String(daysRemaining)}
                />
            </Section>

            <Text style={styles.paragraph}>
                To keep your current features and limits, reactivate your subscription before{' '}
                {formattedAccessUntil}.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/precios/propietarios`}>Reactivate subscription</Button>
            </Section>

            <Text style={styles.footer}>
                If you meant to cancel, no action is needed. Your access ends automatically on{' '}
                {formattedAccessUntil} and no further charges will be made.
            </Text>
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
        color: '#b45309',
        fontSize: '16px',
        lineHeight: '24px',
        fontWeight: '600',
        margin: '0 0 16px'
    },
    infoBox: {
        backgroundColor: '#fffbeb',
        borderRadius: '8px',
        borderLeft: '4px solid #f59e0b',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    footer: {
        color: '#94a3b8',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 16px'
    }
};
