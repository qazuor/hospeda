import { Section, Text } from '@react-email/components';
import type { AddonLinkLocale } from '../../types/notification.types.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { buildAddonManagementUrl, formatDate } from '../utils/index.js';

/**
 * Props for AddonExpirationWarning email template
 */
export interface AddonExpirationWarningProps {
    recipientName: string;
    addonName: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
    daysRemaining?: number;
    expirationDate?: string;
    /**
     * Add-on catalog slug. When present, the CTA button deep-links to the
     * add-ons management page focused on this add-on (HOS-722).
     */
    addonSlug?: string;
    /** Recipient's preferred locale for the CTA link. Falls back to `'es'` (HOS-722). */
    locale?: AddonLinkLocale;
}

/**
 * Addon expiration warning email template
 * Sent to warn users when an addon is about to expire
 *
 * @param props - Addon expiration warning data
 */
export function AddonExpirationWarning({
    recipientName,
    addonName,
    baseUrl,
    daysRemaining,
    expirationDate,
    addonSlug,
    locale
}: AddonExpirationWarningProps) {
    const formattedExpirationDate = expirationDate
        ? formatDate({ dateString: expirationDate })
        : undefined;
    const daysText = daysRemaining === 1 ? '1 día' : `${daysRemaining} días`;
    const renewUrl = buildAddonManagementUrl({ baseUrl, locale, addonSlug });

    return (
        <EmailLayout
            previewText={`Tu complemento ${addonName} está por vencer`}
            showUnsubscribe={true}
        >
            <Heading>Tu complemento está por vencer</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Queremos recordarte que tu complemento <strong>{addonName}</strong> está próximo a
                vencer.
            </Text>

            <Section style={styles.warningBox}>
                <InfoRow
                    label="Complemento"
                    value={addonName}
                />
                {daysRemaining !== undefined && (
                    <InfoRow
                        label="Tiempo restante"
                        value={daysText}
                    />
                )}
                {formattedExpirationDate && (
                    <InfoRow
                        label="Fecha de vencimiento"
                        value={formattedExpirationDate}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Si deseas continuar disfrutando de los beneficios de este complemento, puedes
                renovarlo antes de que expire.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={renewUrl}>Renovar ahora</Button>
            </Section>

            <Text style={styles.footerNote}>
                Una vez que el complemento expire, perderás acceso a sus funcionalidades hasta que
                lo renueves.
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
    warningBox: {
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
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
