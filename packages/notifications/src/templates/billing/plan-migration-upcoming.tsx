import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Data for a reminder before the customer's plan migration. */
export interface PlanMigrationUpcomingProps {
    readonly daysBefore: number;
    readonly planName: string;
    readonly targetPlanName: string;
    readonly direction: 'UP' | 'DOWN';
    readonly currentAmount: string;
    readonly newAmount: string;
    readonly applicationDate: string;
    readonly losesPromo: boolean;
    /** When true, the card payer is told the provider also announces the amount change. */
    readonly providerNotifies?: boolean;
    /** Why the migration was announced; absent means a plan retirement. */
    readonly reason?: 'RETIREMENT' | 'PRICE_INCREASE';
}

/** Subject of the plan migration reminder. */
export const PLAN_MIGRATION_UPCOMING_SUBJECT = 'Se acerca el cambio de tu plan';
/** Subject of the price-increase reminder. */
export const PLAN_MIGRATION_INCREASE_UPCOMING_SUBJECT = 'Se acerca el cambio de precio de tu plan';

/** Reminds the customer of the date and prices of the plan migration. */
export function PlanMigrationUpcoming({
    daysBefore,
    planName,
    targetPlanName,
    direction,
    currentAmount,
    newAmount,
    applicationDate,
    losesPromo,
    providerNotifies = false,
    reason = 'RETIREMENT'
}: PlanMigrationUpcomingProps) {
    const subject =
        reason === 'PRICE_INCREASE'
            ? PLAN_MIGRATION_INCREASE_UPCOMING_SUBJECT
            : PLAN_MIGRATION_UPCOMING_SUBJECT;
    return (
        <EmailLayout previewText={subject}>
            <Heading>{subject}</Heading>
            {reason === 'PRICE_INCREASE' ? (
                <>
                    <Text>
                        {daysBefore === 1 ? 'Falta 1 día' : `Faltan ${daysBefore} días`} para el
                        cambio de precio de tu plan {planName}: se aplica desde tu cobro del{' '}
                        {formatDate({ dateString: applicationDate })}.
                    </Text>
                    <Text>Tu precio actual es {currentAmount}.</Text>
                    <Text>El precio nuevo será {newAmount}.</Text>
                    {providerNotifies ? (
                        <Text>
                            Mercado Pago también te va a mandar un aviso del cambio de monto.
                        </Text>
                    ) : null}
                    <Text>
                        Si no estás de acuerdo, podés cancelar tu suscripción antes de esa fecha.
                    </Text>
                </>
            ) : (
                <>
                    <Text>
                        {daysBefore === 1 ? 'Falta 1 día' : `Faltan ${daysBefore} días`} para el
                        cambio de tu plan {planName} al plan {targetPlanName}: será el{' '}
                        {formatDate({ dateString: applicationDate })}.
                    </Text>
                    <Text>
                        Para vos, es una {direction === 'UP' ? 'subida' : 'bajada'} de precio.
                    </Text>
                    <Text>Tu precio actual es {currentAmount}.</Text>
                    <Text>El precio nuevo será {newAmount}.</Text>
                    {losesPromo ? <Text>Con el cambio perdés tu promoción actual.</Text> : null}
                    {providerNotifies ? (
                        <Text>
                            Mercado Pago también te va a mandar un aviso del cambio de monto.
                        </Text>
                    ) : null}
                    <Text>Podés darte de baja o elegir otro plan antes del cambio.</Text>
                </>
            )}
        </EmailLayout>
    );
}
