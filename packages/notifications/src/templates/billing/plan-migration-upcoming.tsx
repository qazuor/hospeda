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
}

/** Subject of the plan migration reminder. */
export const PLAN_MIGRATION_UPCOMING_SUBJECT = 'Se acerca el cambio de tu plan';

/** Reminds the customer of the date and prices of the plan migration. */
export function PlanMigrationUpcoming({
    daysBefore,
    planName,
    targetPlanName,
    direction,
    currentAmount,
    newAmount,
    applicationDate,
    losesPromo
}: PlanMigrationUpcomingProps) {
    return (
        <EmailLayout previewText={PLAN_MIGRATION_UPCOMING_SUBJECT}>
            <Heading>{PLAN_MIGRATION_UPCOMING_SUBJECT}</Heading>
            <Text>
                {daysBefore === 1 ? 'Falta 1 día' : `Faltan ${daysBefore} días`} para el cambio de
                tu plan {planName} al plan {targetPlanName}: será el{' '}
                {formatDate({ dateString: applicationDate })}.
            </Text>
            <Text>Para vos, es una {direction === 'UP' ? 'subida' : 'bajada'} de precio.</Text>
            <Text>Tu precio actual es {currentAmount}.</Text>
            <Text>El precio nuevo será {newAmount}.</Text>
            {losesPromo ? <Text>Con el cambio perdés tu promoción actual.</Text> : null}
            <Text>Podés darte de baja o elegir otro plan antes del cambio.</Text>
        </EmailLayout>
    );
}
