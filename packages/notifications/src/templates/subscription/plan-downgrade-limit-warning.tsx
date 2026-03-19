import { Section, Text } from '@react-email/components';
import { Button } from '../components/button.js';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { EmailLayout } from '../components/layout.js';

/**
 * Human-readable label for a resource limit key.
 * Falls back to the raw key if no mapping is found.
 */
function getLimitLabel(limitKey: string): string {
    const labels: Record<string, string> = {
        accommodations: 'Alojamientos',
        photos: 'Fotos por alojamiento',
        events: 'Eventos',
        publications: 'Publicaciones',
        destinations: 'Destinos'
    };
    return labels[limitKey] ?? limitKey;
}

/**
 * Props for PlanDowngradeLimitWarning email template
 */
export interface PlanDowngradeLimitWarningProps {
    readonly customerName: string;
    /** Name of the plan the user is downgrading to */
    readonly planName: string;
    /** Identifier for the resource limit (e.g. 'accommodations', 'photos') */
    readonly limitKey: string;
    /** The limit value before the downgrade */
    readonly oldLimit: number;
    /** The limit value after the downgrade */
    readonly newLimit: number;
    /** The user's current usage count for this resource */
    readonly currentUsage: number;
    /** Base URL for CTA links (e.g. 'https://hospeda.com.ar') */
    readonly baseUrl: string;
}

/**
 * Plan downgrade limit warning email template.
 *
 * Sent when a plan downgrade reduces a resource limit below the user's
 * current usage. The email is informational: it explains what changed
 * and presents the available options without being alarmist.
 *
 * @param props - Plan downgrade limit warning data
 */
export function PlanDowngradeLimitWarning({
    customerName,
    planName,
    limitKey,
    oldLimit,
    newLimit,
    currentUsage,
    baseUrl
}: PlanDowngradeLimitWarningProps) {
    const limitLabel = getLimitLabel(limitKey);
    const overLimit = currentUsage - newLimit;

    return (
        <EmailLayout
            previewText={`Cambio de límite en tu plan ${planName} - ${limitLabel}`}
            showUnsubscribe={false}
        >
            <Heading>Cambio de límite en tu plan</Heading>

            <Text style={styles.greeting}>Hola {customerName},</Text>

            <Text style={styles.paragraph}>
                Tu plan fue cambiado a <strong>{planName}</strong>. Como parte de este cambio, el
                límite de <strong>{limitLabel}</strong> se redujo de <strong>{oldLimit}</strong> a{' '}
                <strong>{newLimit}</strong>.
            </Text>

            <Text style={styles.paragraph}>
                Actualmente tenés <strong>{currentUsage}</strong> {limitLabel.toLowerCase()}{' '}
                activos, lo que supera el nuevo límite en <strong>{overLimit}</strong>.
            </Text>

            <Section style={styles.infoBox}>
                <InfoRow
                    label="Plan actual"
                    value={planName}
                />
                <InfoRow
                    label="Recurso"
                    value={limitLabel}
                />
                <InfoRow
                    label="Límite anterior"
                    value={String(oldLimit)}
                />
                <InfoRow
                    label="Nuevo límite"
                    value={String(newLimit)}
                />
                <InfoRow
                    label="Uso actual"
                    value={String(currentUsage)}
                />
            </Section>

            <Section style={styles.gracePeriodBox}>
                <Text style={styles.gracePeriodText}>
                    <strong>Período de gracia:</strong> Tenés 7 días para ajustar tu uso. Después de
                    ese período, el contenido que exceda tu nuevo límite será desactivado
                    automáticamente.
                </Text>
            </Section>

            <Heading>¿Qué podés hacer?</Heading>

            <Text style={styles.ctaIntro}>Elegí la opción que mejor se adapte a tu situación:</Text>

            <Section style={styles.ctaOption}>
                <Text style={styles.ctaOptionTitle}>Opción 1: Actualizá tu plan</Text>
                <Text style={styles.ctaOptionBody}>
                    Volvé a un plan que incluya el límite que necesitás y todo seguirá funcionando
                    sin cambios. Es la opción más rápida si tu contenido es importante.
                </Text>
                <Section style={styles.buttonContainer}>
                    <Button href={`${baseUrl}/es/precios/propietarios`}>
                        Ver planes disponibles
                    </Button>
                </Section>
            </Section>

            <Section style={styles.ctaOption}>
                <Text style={styles.ctaOptionTitle}>Opción 2: Reducí tu uso</Text>
                <Text style={styles.ctaOptionBody}>
                    Eliminá o archivá {limitLabel.toLowerCase()} hasta estar dentro del nuevo
                    límite. Tenés 7 días para hacerlo antes de que el contenido en exceso sea
                    desactivado automáticamente.
                </Text>
                <Section style={styles.buttonContainer}>
                    <Button href={`${baseUrl}/es/cuenta/alojamientos`}>
                        Administrar contenido
                    </Button>
                </Section>
            </Section>

            <Text style={styles.footerNote}>
                Si necesitás ayuda para decidir qué hacer, nuestro equipo de soporte está disponible
                para asistirte.
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
    infoBox: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #0f766e',
        padding: '24px',
        margin: '24px 0'
    },
    buttonContainer: {
        margin: '24px 0',
        textAlign: 'center' as const
    },
    gracePeriodBox: {
        backgroundColor: '#fefce8',
        borderRadius: '8px',
        borderLeft: '4px solid #ca8a04',
        padding: '16px 24px',
        margin: '24px 0'
    },
    gracePeriodText: {
        color: '#713f12',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0'
    },
    ctaIntro: {
        color: '#475569',
        fontSize: '15px',
        lineHeight: '22px',
        margin: '0 0 16px'
    },
    ctaOption: {
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        borderLeft: '4px solid #0f766e',
        padding: '20px 24px',
        margin: '0 0 16px'
    },
    ctaOptionTitle: {
        color: '#1e293b',
        fontSize: '15px',
        fontWeight: 'bold',
        lineHeight: '22px',
        margin: '0 0 8px'
    },
    ctaOptionBody: {
        color: '#475569',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
    },
    footerNote: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '24px 0 0',
        textAlign: 'center' as const
    }
};
