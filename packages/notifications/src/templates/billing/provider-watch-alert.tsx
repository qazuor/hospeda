import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** One change the watch battery found, as the mail shows it. */
export interface ProviderWatchAlertLine {
    readonly measurementId: string;
    readonly kind: 'value_changed' | 'shape_changed';
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
 * @returns The subject line
 */
export function providerWatchAlertSubject(props: {
    readonly account: ProviderWatchAlertProps['account'];
    readonly count: number;
}): string {
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
        count: props.alerts.length
    });
    return (
        <EmailLayout previewText={subject}>
            <Heading>{subject}</Heading>
            <Text>
                La batería de vigilancia midió al proveedor ({ACCOUNT_LABEL[props.account]}) el{' '}
                {props.finishedAt} y encontró lo siguiente. No ajustó nada: decidí vos si el falso,
                la lista o el código tienen que cambiar.
            </Text>
            {props.alerts.map((alert) => (
                <div key={`${alert.measurementId}:${alert.kind}:${alert.label ?? ''}`}>
                    <Text>
                        <strong>{alert.measurementId}</strong>{' '}
                        {alert.kind === 'value_changed'
                            ? 'devolvió otro valor'
                            : `cambió la forma de la respuesta${alert.label ? ` (${alert.label})` : ''}`}
                    </Text>
                    <Text>Esperaba: {alert.expected}</Text>
                    <Text>Obtuvo: {alert.obtained}</Text>
                    {alert.details.map((detail) => (
                        <Text key={detail}>{detail}</Text>
                    ))}
                </div>
            ))}
        </EmailLayout>
    );
}
