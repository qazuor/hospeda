import { Text } from '@react-email/components';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';
import { formatDate } from '../utils/index.js';

/** Why the plan migration was announced. */
export type PlanMigrationAnnouncedReason = 'RETIREMENT' | 'PRICE_INCREASE';

/** Data for the plan retirement announcement. */
export interface PlanMigrationAnnouncedProps {
    readonly variant: 'SCHEDULED' | 'WAITING' | 'TO_RESOLVE';
    readonly planName: string;
    readonly targetPlanName: string;
    readonly direction: 'UP' | 'DOWN';
    readonly currentAmount: string;
    readonly newAmount: string | null;
    readonly applicationDate: string | null;
    readonly losesPromo: boolean;
    readonly reason?: PlanMigrationAnnouncedReason;
}

/** Subject of the plan retirement announcement. */
export const PLAN_MIGRATION_ANNOUNCED_SUBJECT = 'Tu plan deja de venderse';

/** Subject of the anchored price increase announcement. */
export const PLAN_MIGRATION_INCREASE_ANNOUNCED_SUBJECT = 'Cambia el precio de tu plan';

/** Explains the customer's plan migration or the need for personal resolution. */
export function PlanMigrationAnnounced({
    variant,
    planName,
    targetPlanName,
    direction,
    currentAmount,
    newAmount,
    applicationDate,
    losesPromo,
    reason = 'RETIREMENT'
}: PlanMigrationAnnouncedProps) {
    if (reason === 'PRICE_INCREASE') {
        const subject = PLAN_MIGRATION_INCREASE_ANNOUNCED_SUBJECT;
        return (
            <EmailLayout previewText={subject}>
                <Heading>{subject}</Heading>
                <Text>El precio de tu plan {planName} va a aumentar.</Text>
                <Text>Tu precio actual es {currentAmount}.</Text>
                <Text>El precio nuevo será {newAmount}.</Text>
                {variant === 'SCHEDULED' && applicationDate ? (
                    <Text>
                        El nuevo precio se aplica desde tu cobro del{' '}
                        {formatDate({ dateString: applicationDate })}.
                    </Text>
                ) : (
                    <Text>Te avisamos la fecha cuando tu suscripción vuelva a estar activa.</Text>
                )}
                <Text>Hasta esa fecha seguís pagando tu precio actual.</Text>
                <Text>
                    Si no estás de acuerdo, podés cancelar tu suscripción antes de esa fecha.
                </Text>
                <Text>Mercado Pago también te va a avisar del cambio de monto.</Text>
            </EmailLayout>
        );
    }
    return (
        <EmailLayout previewText={PLAN_MIGRATION_ANNOUNCED_SUBJECT}>
            <Heading>{PLAN_MIGRATION_ANNOUNCED_SUBJECT}</Heading>
            <Text>Tu plan {planName} deja de venderse.</Text>
            {variant === 'TO_RESOLVE' ? (
                <Text>Te vamos a contactar para elegir con vos cómo seguir con tu plan.</Text>
            ) : (
                <>
                    <Text>
                        Tu suscripción pasará al plan {targetPlanName}. Para vos, este cambio es una{' '}
                        {direction === 'UP' ? 'subida' : 'bajada'} de precio.
                    </Text>
                    <Text>Tu precio actual es {currentAmount}.</Text>
                    <Text>El precio nuevo será {newAmount}.</Text>
                    {variant === 'SCHEDULED' && applicationDate ? (
                        <Text>
                            El cambio se aplicará el {formatDate({ dateString: applicationDate })}.
                        </Text>
                    ) : (
                        <Text>
                            Te avisamos la fecha cuando tu suscripción vuelva a estar activa.
                        </Text>
                    )}
                    {losesPromo ? <Text>Con el cambio perdés tu promoción actual.</Text> : null}
                    <Text>Podés darte de baja o elegir otro plan antes del cambio.</Text>
                    <Text>Mercado Pago también te va a avisar del cambio de monto.</Text>
                </>
            )}
        </EmailLayout>
    );
}
