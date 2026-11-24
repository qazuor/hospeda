import { Link, Text } from '@react-email/components';
import { Button, Callout, EmailLayout } from '@repo/email';
import { Heading } from '../components/heading.js';
import { InfoRow } from '../components/info-row.js';
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
    /** True when a live promo keeps applying on the new price (price increase only). Absent means false. */
    readonly keepsPromo?: boolean;
    readonly reason?: PlanMigrationAnnouncedReason;
    /** Absolute URL of Mi Suscripción, built by the renderer from the site URL. */
    readonly actionUrl: string;
    /** Absolute URL of the public contact page, built by the renderer from the site URL. */
    readonly contactUrl: string;
}

/** Subject of the plan retirement announcement. */
export const PLAN_MIGRATION_ANNOUNCED_SUBJECT = 'Tu plan deja de venderse';

/** Subject of the anchored price increase announcement. */
export const PLAN_MIGRATION_INCREASE_ANNOUNCED_SUBJECT = 'Cambia el precio de tu plan';

/** The facts of the change, each row only when the value exists (HOS-2580 §D). */
function ChangeDetails({
    planName,
    targetPlanName,
    currentAmount,
    newAmount,
    applicationDate
}: {
    readonly planName: string;
    readonly targetPlanName: string | null;
    readonly currentAmount: string | null;
    readonly newAmount: string | null;
    readonly applicationDate: string | null;
}) {
    return (
        <Callout tone="info">
            <InfoRow
                label="Plan actual"
                value={planName}
            />
            {targetPlanName ? (
                <InfoRow
                    label="Plan nuevo"
                    value={targetPlanName}
                />
            ) : null}
            {currentAmount ? (
                <InfoRow
                    label="Precio actual"
                    value={currentAmount}
                />
            ) : null}
            {newAmount ? (
                <InfoRow
                    label="Precio nuevo"
                    value={newAmount}
                />
            ) : null}
            {applicationDate ? (
                <InfoRow
                    label="Fecha del cambio"
                    value={formatDate({ dateString: applicationDate })}
                />
            ) : null}
        </Callout>
    );
}

/** The closing every variant shares: the action and the way to ask. */
function Closing({
    actionUrl,
    contactUrl
}: {
    readonly actionUrl: string;
    readonly contactUrl: string;
}) {
    return (
        <>
            <Button href={actionUrl}>Ver mi suscripción</Button>
            <Text>
                Si tenés dudas, <Link href={contactUrl}>escribinos</Link>.
            </Text>
        </>
    );
}

/**
 * Explains the customer's plan migration or the need for personal resolution.
 *
 * The facts are the ones the notice always carried (current and new plan, amounts, the
 * application date, the lost promotion); HOS-2580 only changes the presentation: a warmer
 * intro, the facts in an info callout and a contact link at the end.
 *
 * @param props - See {@link PlanMigrationAnnouncedProps}
 */
export function PlanMigrationAnnounced({
    variant,
    planName,
    targetPlanName,
    direction,
    currentAmount,
    newAmount,
    applicationDate,
    losesPromo,
    keepsPromo = false,
    reason = 'RETIREMENT',
    actionUrl,
    contactUrl
}: PlanMigrationAnnouncedProps) {
    const scheduledDate = variant === 'SCHEDULED' ? applicationDate : null;
    if (reason === 'PRICE_INCREASE') {
        const subject = PLAN_MIGRATION_INCREASE_ANNOUNCED_SUBJECT;
        return (
            <EmailLayout previewText={subject}>
                <Heading>{subject}</Heading>
                <Text>
                    Te escribimos para contarte un cambio en tu suscripción. El precio de tu plan{' '}
                    {planName} va a aumentar.
                </Text>
                <ChangeDetails
                    planName={planName}
                    targetPlanName={null}
                    currentAmount={currentAmount}
                    newAmount={newAmount}
                    applicationDate={scheduledDate}
                />
                {scheduledDate ? (
                    <Text>
                        El nuevo precio se aplica desde tu cobro del{' '}
                        {formatDate({ dateString: scheduledDate })}.
                    </Text>
                ) : (
                    <Text>Te avisamos la fecha cuando tu suscripción vuelva a estar activa.</Text>
                )}
                {keepsPromo ? (
                    <Text>Tu promoción se sigue aplicando sobre el precio nuevo.</Text>
                ) : null}
                <Text>Hasta esa fecha seguís pagando tu precio actual.</Text>
                <Text>
                    Si no estás de acuerdo, podés cancelar tu suscripción antes de esa fecha.
                </Text>
                <Text>Mercado Pago también te va a avisar del cambio de monto.</Text>
                <Closing
                    actionUrl={actionUrl}
                    contactUrl={contactUrl}
                />
            </EmailLayout>
        );
    }
    return (
        <EmailLayout previewText={PLAN_MIGRATION_ANNOUNCED_SUBJECT}>
            <Heading>{PLAN_MIGRATION_ANNOUNCED_SUBJECT}</Heading>
            <Text>
                Te escribimos para contarte un cambio en tu suscripción. Tu plan {planName} deja de
                venderse.
            </Text>
            {variant === 'TO_RESOLVE' ? (
                <>
                    <ChangeDetails
                        planName={planName}
                        targetPlanName={null}
                        currentAmount={null}
                        newAmount={null}
                        applicationDate={null}
                    />
                    <Text>Te vamos a contactar para elegir con vos cómo seguir con tu plan.</Text>
                </>
            ) : (
                <>
                    <Text>
                        Tu suscripción pasará al plan {targetPlanName}. Para vos, este cambio es una{' '}
                        {direction === 'UP' ? 'subida' : 'bajada'} de precio.
                    </Text>
                    <ChangeDetails
                        planName={planName}
                        targetPlanName={targetPlanName}
                        currentAmount={currentAmount}
                        newAmount={newAmount}
                        applicationDate={scheduledDate}
                    />
                    {scheduledDate ? (
                        <Text>
                            El cambio se aplicará el {formatDate({ dateString: scheduledDate })}.
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
            <Closing
                actionUrl={actionUrl}
                contactUrl={contactUrl}
            />
        </EmailLayout>
    );
}
