import { Section, Text } from '@react-email/components';
import type { AddonLinkLocale } from '../../types/notification.types.js';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';
import { buildAddonManagementUrl, formatDate } from '../utils/index.js';

/**
 * Props for AddonExpired email template
 */
export interface AddonExpiredProps {
    recipientName: string;
    addonName: string;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    baseUrl: string;
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
 * Addon expired email template
 * Sent when an addon has expired
 *
 * @param props - Addon expiration data
 */
export function AddonExpired({
    recipientName,
    addonName,
    baseUrl,
    expirationDate,
    addonSlug,
    locale
}: AddonExpiredProps) {
    const formattedExpirationDate = expirationDate
        ? formatDate({ dateString: expirationDate })
        : undefined;
    const repurchaseUrl = buildAddonManagementUrl({ baseUrl, locale, addonSlug });

    return (
        <EmailLayout previewText={`Tu complemento ${addonName} ha vencido`}>
            <Heading>Tu complemento ha vencido</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Tu complemento <strong>{addonName}</strong> ha vencido y ya no tienes acceso a sus
                funcionalidades.
            </Text>

            <Section style={styles.alertBox}>
                <InfoRow
                    label="Complemento"
                    value={addonName}
                />
                {formattedExpirationDate && (
                    <InfoRow
                        label="Fecha de vencimiento"
                        value={formattedExpirationDate}
                    />
                )}
            </Section>

            <Text style={styles.paragraph}>
                Si deseas recuperar el acceso a las funcionalidades de este complemento, puedes
                adquirirlo nuevamente en cualquier momento.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={repurchaseUrl}>Comprar de nuevo</Button>
            </Section>

            <Text style={styles.footerNote}>
                Tus datos y configuraciones se mantendrán guardados por si decides volver a activar
                este complemento.
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
    alertBox: {
        backgroundColor: '#fef2f2',
        borderRadius: '8px',
        borderLeft: '4px solid #ef4444',
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
