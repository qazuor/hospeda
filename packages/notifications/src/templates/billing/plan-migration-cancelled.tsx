import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Why the cancelled migration was announced. */
export type PlanMigrationCancelledReason = 'RETIREMENT' | 'PRICE_INCREASE';

/** Data for a cancelled migration notice. */
export interface PlanMigrationCancelledProps {
    readonly variant: 'NOTHING_CHANGES' | 'ALREADY_STARTED';
    readonly planName: string;
    readonly newAmount: string | null;
    readonly applicationDate: string | null;
    /** Why the cancelled migration was announced; absent means a plan retirement. */
    readonly reason?: PlanMigrationCancelledReason;
}

/** Subject of the cancelled migration notice. */
export const PLAN_MIGRATION_CANCELLED_SUBJECT = 'Cancelamos el cambio de tu plan';
/** Subject of the cancelled price increase notice. */
export const PLAN_MIGRATION_INCREASE_CANCELLED_SUBJECT =
    'Cancelamos el cambio de precio de tu plan';

/** Explains whether cancellation still affects this customer's migration. */
export function PlanMigrationCancelled({
    variant,
    planName,
    newAmount,
    applicationDate,
    reason = 'RETIREMENT'
}: PlanMigrationCancelledProps) {
    const subject =
        reason === 'PRICE_INCREASE'
            ? PLAN_MIGRATION_INCREASE_CANCELLED_SUBJECT
            : PLAN_MIGRATION_CANCELLED_SUBJECT;
    return (
        <EmailLayout previewText={subject}>
            <Heading>{subject}</Heading>
            {reason === 'PRICE_INCREASE' ? (
                variant === 'NOTHING_CHANGES' ? (
                    <Text>
                        Cancelamos el aumento de precio de tu plan {planName}: ya no cambia nada.
                    </Text>
                ) : (
                    <Text>
                        El aumento de tu plan {planName} ya empezó a aplicarse y la cancelación no
                        lo alcanza: desde el {formatDate({ dateString: applicationDate ?? '' })}{' '}
                        pagás {newAmount}.
                    </Text>
                )
            ) : variant === 'NOTHING_CHANGES' ? (
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
