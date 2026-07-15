import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Props for AccommodationCalendarFeedBroken email template (HOS-162 Phase 3,
 * spec §14.4).
 */
export interface AccommodationCalendarFeedBrokenProps {
    /** Display name of the host receiving the alert. */
    readonly recipientName: string;
    /** Human-readable name of the accommodation whose feed broke. */
    readonly accommodationName: string;
    /** Human-readable label of the external provider (e.g. "Airbnb", "Booking.com"). */
    readonly providerLabel: string;
    /**
     * Full URL to the accommodation's calendar-sync panel in the host
     * editor, where the host can paste a corrected feed URL to reconnect.
     */
    readonly reconnectUrl: string;
}

/**
 * Broken/expired iCal feed alert email template (HOS-162 Phase 3, spec §14.4).
 *
 * Sent to the host who connected an external calendar (Airbnb / Booking.com /
 * other) when a sync run detects the feed is unreadable. Explains, in plain
 * non-technical terms, that dates booked on the external platform may
 * currently show as available on Hospeda — an overbooking risk — and prompts
 * the host to reconnect the feed via a direct link to their calendar-sync
 * panel.
 *
 * Deliberately omits the raw fetch/parse error detail (timeouts, HTTP
 * status, ICS parse errors): that stays in the connection's
 * `lastErrorMessage` column and operational logs, not the host's inbox.
 *
 * @param props - Broken-feed notification data
 */
export function AccommodationCalendarFeedBroken({
    recipientName,
    accommodationName,
    providerLabel,
    reconnectUrl
}: AccommodationCalendarFeedBrokenProps) {
    return (
        <EmailLayout
            previewText={`Tu calendario de ${providerLabel} dejó de sincronizarse — revisá ${accommodationName}`}
            showUnsubscribe={false}
        >
            <Heading>Tu calendario de {providerLabel} dejó de sincronizarse</Heading>

            <Text style={styles.greeting}>Hola {recipientName},</Text>

            <Text style={styles.paragraph}>
                Detectamos un problema al sincronizar el calendario externo de{' '}
                <strong>{providerLabel}</strong> conectado a tu alojamiento{' '}
                <strong>{accommodationName}</strong>.
            </Text>

            <Text style={styles.warningBanner}>
                Mientras esto no se resuelva, es posible que en Hospeda se muestren como disponibles
                fechas que ya están reservadas en {providerLabel}, lo que puede generar una{' '}
                <strong>doble reserva</strong>.
            </Text>

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Alojamiento"
                    value={accommodationName}
                />
                <InfoRow
                    label="Origen"
                    value={providerLabel}
                />
                <InfoRow
                    label="Estado"
                    value="Sincronización interrumpida"
                />
            </Section>

            <Text style={styles.paragraph}>
                Para evitar el riesgo de doble reserva, te recomendamos reconectar el calendario
                cuanto antes.
            </Text>

            <Section style={styles.buttonContainer}>
                <Button href={reconnectUrl}>Reconectar calendario</Button>
            </Section>

            <Text style={styles.footer}>
                Si el problema continúa después de reconectar, escribinos a nuestro equipo de
                soporte y te ayudamos a resolverlo.
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
    warningBanner: {
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
