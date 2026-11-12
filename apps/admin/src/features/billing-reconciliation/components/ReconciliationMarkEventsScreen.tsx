import type { TranslationKey } from '@repo/i18n';
import type { ReconciliationMarkEventsResponseSchema } from '@repo/schemas';
import { PermissionEnum } from '@repo/schemas';
import type { z } from 'zod';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import { useReconciliationMarkEvents } from '../hooks/useReconciliationMarkEvents';
import {
    RECONCILIATION_ACTOR_TYPE_KEYS,
    RECONCILIATION_OUTCOME_KEYS,
    RECONCILIATION_REASON_KEYS,
    RECONCILIATION_SUBJECT_KIND_KEYS,
    reconciliationLabel
} from '../reconciliation-labels';

type Response = z.infer<typeof ReconciliationMarkEventsResponseSchema>;
const CONDITIONS: Record<1 | 2 | 3 | 4, TranslationKey> = {
    1: 'admin-billing.reconciliationMarks.conditions.one',
    2: 'admin-billing.reconciliationMarks.conditions.two',
    3: 'admin-billing.reconciliationMarks.conditions.three',
    4: 'admin-billing.reconciliationMarks.conditions.four'
};

/** Shows the mark and the critical events returned by the API. */
export function ReconciliationMarkEventsScreen({ markId }: { markId: string }) {
    return (
        <PermissionGate permissions={[PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]}>
            <EventsBody markId={markId} />
        </PermissionGate>
    );
}

function EventsBody({ markId }: { markId: string }) {
    const { t, locale } = useTranslations();
    const query = useReconciliationMarkEvents({ markId, enabled: true });
    if (!query.data && query.isLoading)
        return <p>{t('admin-billing.reconciliationMarks.loading')}</p>;
    if (query.error) {
        const status = (query.error as { status?: number }).status;
        return (
            <p role="alert">
                {status === 404
                    ? t('admin-billing.reconciliationMarks.markNotFound')
                    : t('admin-billing.reconciliationMarks.error')}
            </p>
        );
    }
    if (!query.data) return null;
    const { mark, events } = query.data;
    return (
        <section className="space-y-4">
            <div className="rounded-md border p-4">
                <h2 data-testid="reconciliation-mark-reason">
                    {mark.reasonNumber} ·{' '}
                    {reconciliationLabel({
                        map: RECONCILIATION_REASON_KEYS,
                        value: mark.reason,
                        t
                    })}
                </h2>
                <p>
                    {t('admin-billing.reconciliationMarks.openedAt')}:{' '}
                    {formatDateWithTime({ date: mark.openedAt, locale })}
                </p>
                <p>
                    {mark.liftedAt
                        ? `${t('admin-billing.reconciliationMarks.liftedAt')}: ${formatDateWithTime({ date: mark.liftedAt, locale })}`
                        : t('admin-billing.reconciliationMarks.notLifted')}
                </p>
                <p data-testid="reconciliation-mark-subject">
                    {reconciliationLabel({
                        map: RECONCILIATION_SUBJECT_KIND_KEYS,
                        value: mark.subject.kind,
                        t
                    })}
                    : {mark.subject.id}
                </p>
            </div>
            {events.map((event) => (
                <article
                    data-testid="reconciliation-mark-event"
                    key={event.eventId}
                    className="space-y-2 rounded-md border p-4"
                >
                    <p>{formatDateWithTime({ date: event.occurredAt, locale })}</p>
                    <p data-testid="reconciliation-mark-event-actor">
                        {t('admin-billing.reconciliationMarks.actor')}:{' '}
                        {reconciliationLabel({
                            map: RECONCILIATION_ACTOR_TYPE_KEYS,
                            value: event.actorType,
                            t
                        })}
                        {event.actorId ? ` · ${event.actorId}` : ''}
                    </p>
                    <p>
                        {t('admin-billing.reconciliationMarks.correlation')}: {event.correlationId}
                    </p>
                    <p data-testid="reconciliation-mark-event-outcome">
                        {t('admin-billing.reconciliationMarks.outcome')}:{' '}
                        {event.outcome === null
                            ? '—'
                            : reconciliationLabel({
                                  map: RECONCILIATION_OUTCOME_KEYS,
                                  value: event.outcome,
                                  t
                              })}
                    </p>
                    <p data-testid="reconciliation-mark-event-condition">
                        {conditionText(event, t)}
                    </p>
                </article>
            ))}
        </section>
    );
}

function conditionText(
    event: Response['events'][number],
    t: (key: TranslationKey) => string
): string {
    if (!event.conditionRecorded)
        return t('admin-billing.reconciliationMarks.conditionNotRecorded');
    if (event.failedCondition !== null && event.failedCondition !== undefined)
        return `${t('admin-billing.reconciliationMarks.condition')} ${event.failedCondition}: ${t(CONDITIONS[event.failedCondition])}`;
    return t('admin-billing.reconciliationMarks.conditionNotEvaluated');
}
