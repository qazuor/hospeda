import { Hr, Text } from '@react-email/components';
import { Button, EmailLayout, emailPalette } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
import { formatDateTime } from '../utils/format-helpers.js';
import { translateProviderWatchDetail } from './provider-watch-details.js';
import { adminPanelHref } from './staff-notice.js';

/** One change the watch battery found, as the mail shows it. */
export interface ProviderWatchAlertLine {
    readonly measurementId: string;
    readonly kind:
        | 'value_changed'
        | 'shape_changed'
        | 'shape_baseline_missing'
        | 'measurement_errored';
    /** For a shape change: the request whose response changed. */
    readonly label?: string;
    /** What the battery expected, already rendered as text. */
    readonly expected: string;
    /** What the battery obtained, already rendered as text. */
    readonly obtained: string;
    /** Fields added, removed or retyped. */
    readonly details: readonly string[];
}

/** Payload of the provider watch alert mail. */
export interface ProviderWatchAlertProps {
    readonly account: 'sandbox' | 'production';
    /** ISO instant the run finished. */
    readonly finishedAt: string;
    readonly alerts: readonly ProviderWatchAlertLine[];
    /** Present when the run did not complete: how it ended and why. */
    readonly run?: {
        readonly outcome: 'failed' | 'aborted';
        readonly reason?: string;
    };
    /** How many further alerts the run found that this mail does not carry. */
    readonly omitted?: number;
    /** Admin base URL. Absent: no button to the provider watch page. */
    readonly adminUrl?: string;
}

/** Human name of the account a run targeted. */
const ACCOUNT_LABEL: Readonly<Record<ProviderWatchAlertProps['account'], string>> = {
    sandbox: 'cuenta de pruebas',
    production: 'producción'
};

/**
 * Builds the subject of the alert mail.
 *
 * @param props.account - The account the run targeted
 * @param props.count - How many changes the run found
 * @param props.outcome - `failed` or `aborted` when the run did not complete
 * @returns The subject line
 */
export function providerWatchAlertSubject(props: {
    readonly account: ProviderWatchAlertProps['account'];
    readonly count: number;
    readonly outcome?: 'failed' | 'aborted';
}): string {
    if (props.outcome !== undefined) {
        const state = props.outcome === 'aborted' ? 'se abortó' : 'falló';
        return `Vigilancia del proveedor (${ACCOUNT_LABEL[props.account]}): la corrida ${state}, ${props.count} ${props.count === 1 ? 'alerta' : 'alertas'}`;
    }
    return `Vigilancia del proveedor (${ACCOUNT_LABEL[props.account]}): ${props.count} ${props.count === 1 ? 'cambio' : 'cambios'}`;
}

/** What happened to one measurement, in a sentence. */
function kindText(alert: ProviderWatchAlertLine): string {
    switch (alert.kind) {
        case 'value_changed':
            return 'Devolvió otro valor';
        case 'measurement_errored':
            return 'No se pudo medir: la medición falló y no hay respuesta que comparar';
        case 'shape_baseline_missing':
            return 'No tiene una forma de respuesta aceptada: revisala y aceptala en el panel';
        case 'shape_changed':
            return `Cambió la forma de la respuesta${alert.label ? ` (${alert.label})` : ''}`;
        default: {
            const unreachable: never = alert.kind;
            return unreachable;
        }
    }
}

/**
 * Tells the administrator what the provider watch battery found different: which
 * measurement, what it expected and what it obtained. The battery adjusts nothing; reading
 * this mail and deciding is the whole follow-up.
 *
 * The expected and obtained values, and the detail lines, are provider values shown
 * verbatim (`raw`): translating a measured value would misreport what the provider
 * returned.
 */
export function ProviderWatchAlert(props: ProviderWatchAlertProps) {
    const subject = providerWatchAlertSubject({
        account: props.account,
        count: props.alerts.length,
        ...(props.run === undefined ? {} : { outcome: props.run.outcome })
    });
    const panelHref = adminPanelHref({ adminUrl: props.adminUrl, path: '/billing/settings' });
    return (
        <EmailLayout
            variant="staff"
            previewText={subject}
        >
            <Heading>{subject}</Heading>
            <Text>
                La batería de vigilancia midió al proveedor ({ACCOUNT_LABEL[props.account]}) el{' '}
                {formatDateTime({ dateString: props.finishedAt }) || props.finishedAt} y encontró lo
                siguiente. No ajustó nada: decidí vos si el falso, la lista o el código tienen que
                cambiar.
            </Text>
            {props.run !== undefined && (
                <Text>
                    <strong>
                        La corrida {props.run.outcome === 'aborted' ? 'se abortó' : 'falló'}
                    </strong>
                    : {props.run.reason ?? 'no registró un motivo'}.
                </Text>
            )}
            {props.alerts.map((alert, index) => (
                <div key={`${alert.measurementId}:${alert.kind}:${alert.label ?? ''}`}>
                    {index > 0 ? <Hr style={dividerStyle} /> : null}
                    <InfoRow
                        label="Medición"
                        value={alert.measurementId}
                    />
                    <InfoRow
                        label="Qué pasó"
                        value={kindText(alert)}
                    />
                    <InfoRow
                        label="Esperaba"
                        value={alert.expected}
                        raw
                    />
                    <InfoRow
                        label="Obtuvo"
                        value={alert.obtained}
                        raw
                    />
                    {alert.details.map((detail) => (
                        <InfoRow
                            key={detail}
                            label="Detalle"
                            // The prefix is ours and goes in Spanish; the path and types stay raw.
                            value={translateProviderWatchDetail({ line: detail })}
                            raw
                        />
                    ))}
                </div>
            ))}
            {props.omitted !== undefined && props.omitted > 0 && (
                <Text>
                    {props.omitted}{' '}
                    {props.omitted === 1
                        ? 'cambio más no se muestra'
                        : 'cambios más no se muestran'}
                    : están todos en el registro de la corrida.
                </Text>
            )}
            {panelHref ? (
                <Button href={panelHref}>Abrir la vigilancia del proveedor</Button>
            ) : (
                <Text>
                    Lo encontrás en el panel de administración: Facturación → Configuración.
                </Text>
            )}
        </EmailLayout>
    );
}

const dividerStyle = {
    borderColor: emailPalette.border,
    margin: '20px 0'
};
