import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Data for a cancelled migration notice. */
export interface PlanMigrationCancelledProps {
    readonly variant: 'NOTHING_CHANGES' | 'ALREADY_STARTED';
    readonly planName: string;
    readonly newAmount: string | null;
    readonly applicationDate: string | null;
}

/** Subject of the cancelled migration notice. */
export const PLAN_MIGRATION_CANCELLED_SUBJECT = 'Cancelamos el cambio de tu plan';

/** Explains whether cancellation still affects this customer's migration. */
export function PlanMigrationCancelled({
    variant,
    planName,
    newAmount,
    applicationDate
}: PlanMigrationCancelledProps) {
    return (
        <EmailLayout previewText={PLAN_MIGRATION_CANCELLED_SUBJECT}>
            <Heading>{PLAN_MIGRATION_CANCELLED_SUBJECT}</Heading>
            {variant === 'NOTHING_CHANGES' ? (
                <Text>Cancelamos la migración de tu plan {planName}: ya no cambia nada.</Text>
            ) : (
                <>
                    <Text>
                        La cancelación no alcanza a tu plan {planName} porque tu cambio ya empezó.
                    </Text>
                    <Text>Tu precio nuevo es {newAmount}.</Text>
                    <Text>
                        La fecha de tu cambio es el{' '}
                        {formatDate({ dateString: applicationDate ?? '' })}.
                    </Text>
                </>
            )}
        </EmailLayout>
    );
}
