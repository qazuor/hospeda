import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

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

/**
 * Tells the administrator what the provider watch battery found different: which
 * measurement, what it expected and what it obtained. The battery adjusts nothing; reading
 * this mail and deciding is the whole follow-up.
 */
export function ProviderWatchAlert(props: ProviderWatchAlertProps) {
    const subject = providerWatchAlertSubject({
        account: props.account,
        count: props.alerts.length,
        ...(props.run === undefined ? {} : { outcome: props.run.outcome })
    });
    return (
        <EmailLayout previewText={subject}>
            <Heading>{subject}</Heading>
            <Text>
                La batería de vigilancia midió al proveedor ({ACCOUNT_LABEL[props.account]}) el{' '}
                {props.finishedAt} y encontró lo siguiente. No ajustó nada: decidí vos si el falso,
                la lista o el código tienen que cambiar.
            </Text>
            {props.run !== undefined && (
                <Text>
                    <strong>
                        La corrida {props.run.outcome === 'aborted' ? 'se abortó' : 'falló'}
                    </strong>
                    : {props.run.reason ?? 'no registró un motivo'}.
                </Text>
            )}
            {props.alerts.map((alert) => (
                <div key={`${alert.measurementId}:${alert.kind}:${alert.label ?? ''}`}>
                    <Text>
                        <strong>{alert.measurementId}</strong>{' '}
                        {alert.kind === 'value_changed'
                            ? 'devolvió otro valor'
                            : alert.kind === 'measurement_errored'
                              ? 'no se pudo medir: la medición falló y no hay respuesta que comparar'
                              : alert.kind === 'shape_baseline_missing'
                                ? 'no tiene una forma de respuesta aceptada: revisala y aceptala en el panel'
                                : `cambió la forma de la respuesta${alert.label ? ` (${alert.label})` : ''}`}
                    </Text>
                    <Text>Esperaba: {alert.expected}</Text>
                    <Text>Obtuvo: {alert.obtained}</Text>
                    {alert.details.map((detail) => (
                        <Text key={detail}>{detail}</Text>
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
        </EmailLayout>
    );
}
