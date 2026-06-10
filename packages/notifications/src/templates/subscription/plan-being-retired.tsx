import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/**
 * Props for PlanBeingRetired email template (SPEC-148).
 *
 * Sent when an admin retires a billing plan that a subscriber is currently on.
 * The subscriber keeps full access until `accessUntil` (their current billing
 * period_end) and is encouraged to switch to another plan before that date.
 */
export interface PlanBeingRetiredProps {
    readonly recipientName: string;
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end.
     * The user keeps full access until this date despite the plan retirement.
     */
    readonly accessUntil: string;
    /**
     * Short plain-text prompt encouraging the user to resubscribe
     * (e.g. "Re-subscribe to another plan to keep premium features").
     */
    readonly migrationHint: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Plan retirement notification email template (SPEC-148).
 *
 * Sent to each active subscriber when their plan is retired by an admin.
 * Unlike SUBSCRIPTION_CANCEL_CONFIRMED (user-initiated), this notification
 * is admin-triggered. The tone is warm and clear: the plan is retiring,
 * access is preserved until `accessUntil`, and the user should choose
 * another plan to continue with premium features.
 *
 * @param props - Plan retirement notification data
 */
export function PlanBeingRetired({
    recipientName,
    planName,
    accessUntil,
    migrationHint,
    baseUrl
}: PlanBeingRetiredProps) {
    const formattedAccessUntil = formatDate({ dateString: accessUntil });

    return (
        <EmailLayout
            previewText={`The ${planName} plan is being retired — you keep access until ${formattedAccessUntil}`}
            showUnsubscribe={false}
        >
            <Heading>Important update about your plan</Heading>

            <Text style={styles.greeting}>Hi {recipientName},</Text>

            <Text style={styles.paragraph}>
                We are writing to let you know that the <strong>{planName}</strong> plan is being
                retired. We appreciate your loyalty and want to make this transition as smooth as
                possible.
            </Text>

            <Text style={styles.accessBanner}>
                You keep full access until <strong>{formattedAccessUntil}</strong>. No action is
                needed before that date — your current features and limits remain intact.
            </Text>

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Plan being retired"
                    value={planName}
                />
                <InfoRow
                    label="Access until"
                    value={formattedAccessUntil}
                />
                <InfoRow
                    label="Status"
                    value="Retiring — access preserved until period end"
                />
            </Section>

            <Text style={styles.paragraph}>{migrationHint}</Text>

            <Text style={styles.paragraph}>
                Browse our current plans and choose the one that best fits your needs before{' '}
                {formattedAccessUntil}.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={`${baseUrl}/es/precios/propietarios`}>Choose a new plan</Button>
            </Section>

            <Text style={styles.footer}>
                If you have any questions or need help choosing a plan, please contact our support
                team — we are happy to assist.
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
    },
    footer: {
        color: '#94a3b8',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 16px'
    }
};
