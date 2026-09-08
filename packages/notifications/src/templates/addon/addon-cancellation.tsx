import { Section, Text } from '@react-email/components';
import type { AddonLinkLocale } from '../../types/notification.types.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { buildAddonManagementUrl, formatDate } from '../utils/index.js';

/**
 * Props for AddonCancellation email template
 */
export interface AddonCancellationProps {
    recipientName: string;
    addonName: string;
    /** ISO 8601 timestamp of when the add-on was cancelled */
    canceledAt: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
    /**
     * Add-on catalog slug. When present, the CTA button deep-links to the
     * add-ons management page focused on this add-on (HOS-722).
     */
    addonSlug?: string;
    /** Recipient's preferred locale for the CTA link. Falls back to `'es'` (HOS-722). */
    locale?: AddonLinkLocale;
    /**
     * ISO 8601 date-time until which the benefit survives the cancellation
     * (HOS-847 PR 7c). Optional, and its ABSENCE is meaningful: an add-on
     * cancelled for non-payment or by an admin ends immediately, so the email
     * must promise nothing. See {@link AddonCancellationPayload.accessUntil}.
     */
    accessUntil?: string;
}

/**
 * Addon cancellation confirmation email template.
 * Sent to the user after one of their active add-ons is successfully cancelled.
 * Includes a link to reactivate from the account panel in case of error.
 *
 * Branches on `accessUntil` (HOS-847 PR 7c): WITH it, the email promises the
 * benefit runs until that date — the recurring soft-cancel, where the customer
 * already paid for the rest of the period. WITHOUT it, the wording is exactly
 * what it always was, because an immediate cancellation (non-payment, admin)
 * has already taken the benefit away and any promise here would be a lie.
 *
 * @param props - Addon cancellation data
 */
export function AddonCancellation({
    recipientName,
    addonName,
    canceledAt,
    baseUrl,
    addonSlug,
    locale,
    accessUntil
}: AddonCancellationProps) {
    const formattedCanceledAt = formatDate({ dateString: canceledAt });
    const formattedAccessUntil = accessUntil ? formatDate({ dateString: accessUntil }) : undefined;
    const manageUrl = buildAddonManagementUrl({ baseUrl, locale, addonSlug });

    return (
        <EmailLayout
            previewText={
                formattedAccessUntil
                    ? `Tu complemento ${addonName} fue cancelado y sigue activo hasta el ${formattedAccessUntil}`
                    : `Tu complemento ${addonName} ha sido cancelado`
            }
            showUnsubscribe={false}
        >
            <Heading>Complemento cancelado</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Te confirmamos que tu complemento <strong>{addonName}</strong> ha sido cancelado
                exitosamente.
            </Text>

            {formattedAccessUntil ? (
                <Text style={styles.accessBanner}>
                    Seguís teniendo el beneficio hasta el <strong>{formattedAccessUntil}</strong>,
                    el final del período que ya pagaste. No se te va a cobrar de nuevo.
                </Text>
            ) : null}

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Complemento"
                    value={addonName}
                />
                <InfoRow
                    label="Cancelado el"
                    value={formattedCanceledAt}
                />
                {formattedAccessUntil ? (
                    <InfoRow
                        label="Activo hasta"
                        value={formattedAccessUntil}
                    />
                ) : null}
            </Section>

            <Text style={styles.paragraph}>
                Si esto fue un error, podés reactivarlo desde tu panel de cuenta en cualquier
                momento.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={manageUrl}>Ir a mi cuenta</Button>
            </Section>

            <Text style={styles.footerNote}>
                Si no solicitaste esta cancelación, por favor contactanos de inmediato.
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
    // Mirrors `SubscriptionCancelConfirmed`'s banner: the same promise, made
    // the same way, so the two cancellation emails do not disagree visually.
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
        borderLeft: '4px solid #94a3b8',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '32px 0',
        textAlign: 'center' as const
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
