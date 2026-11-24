import { Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
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
            previewText={`El plan ${planName} deja de ofrecerse: tu acceso sigue hasta el ${formattedAccessUntil}`}
        >
            <Heading>Novedades importantes sobre tu plan</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te escribimos para avisarte que el plan <strong>{planName}</strong> deja de
                ofrecerse. Valoramos que estés con nosotros y queremos que el cambio sea lo más
                simple posible.
            </Text>

            <Text style={styles.accessBanner}>
                Seguís con acceso completo hasta el <strong>{formattedAccessUntil}</strong>. No
                tenés que hacer nada antes de esa fecha: tus funciones y límites actuales se
                mantienen.
            </Text>

            <Callout tone="info">
                <InfoRow
                    label="Plan que deja de ofrecerse"
                    value={planName}
                />
                <InfoRow
                    label="Acceso hasta"
                    value={formattedAccessUntil}
                />
                <InfoRow
                    label="Estado"
                    value="Deja de ofrecerse: tu acceso se mantiene hasta el fin del período"
                />
            </Callout>

            <Text style={styles.paragraph}>{migrationHint}</Text>

            <Text style={styles.paragraph}>
                Mirá nuestros planes actuales y elegí el que mejor se ajuste a lo que necesitás
                antes del {formattedAccessUntil}.
            </Text>

            <Button href={`${baseUrl}/es/mi-cuenta/suscripcion/`}>Elegir un plan nuevo</Button>

            <Text style={styles.footer}>
                Si tenés dudas o necesitás ayuda para elegir un plan, escribinos: con gusto te damos
                una mano.
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
    footer: {
        color: '#94a3b8',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0 0 16px'
    }
};
