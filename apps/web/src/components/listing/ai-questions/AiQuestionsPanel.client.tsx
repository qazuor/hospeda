/**
 * «Preguntas a la IA» tab of the listing editors (HOS-2101).
 *
 * Lists, anonymously, what visitors asked the listing's AI chat: question, the
 * bot's answer and the date. Questions the bot could not answer come first,
 * with a counter and a button that opens the FAQ editor with the question
 * already filled in. Shared by the accommodation editor and the venue /
 * experience editor.
 *
 * A client island on purpose: the data is per owner, and every page under
 * `src/pages` must stay session-blind (cacheable), so the page renders only
 * the shell and this component fetches with the visitor's own cookie.
 *
 * HOS-2503 moved it onto the kit: flat `Section`s (overview, unanswered,
 * others, dismissed), `DataList` rows, `CountPill`, `Field` + `TextInput`
 * date filters, `Button`/`LinkButton`, `Skeleton`, `ErrorState`,
 * `EmptyState` and `Alert`. The data lives in `use-ai-questions.ts` and the
 * rows in `AiQuestionRow.client.tsx`. Paging stays the API's «Ver más»
 * cursor: the kit `Pagination` is page-numbered and the endpoint has no page
 * numbers.
 *
 * @module components/listing/ai-questions/AiQuestionsPanel
 */

import type { AiChatEntityType } from '@repo/schemas';
import type { JSX, ReactNode } from 'react';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { DataList } from '@/components/account/ui/DataList';
import { EmptyState } from '@/components/account/ui/EmptyState';
import { ErrorState } from '@/components/account/ui/ErrorState';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Skeleton } from '@/components/account/ui/Skeleton';
import { CountPill } from '@/components/account/ui/StatusPill';
import { TextInput } from '@/components/account/ui/TextInput';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AiDismissedQuestionRow, AiQuestionRow } from './AiQuestionRow.client';
import styles from './AiQuestionsPanel.module.css';
import { splitAiQuestions } from './ai-questions-params';
import { useAiQuestions } from './use-ai-questions';

export {
    AI_LISTING_QUESTIONS_PATH,
    buildAiQuestionsParams,
    splitAiQuestions
} from './ai-questions-params';

/** Props of {@link AiQuestionsPanel}. */
export interface AiQuestionsPanelProps {
    /** UI locale. */
    readonly locale: SupportedLocale;
    /** Vertical of the listing; also picks the sections' help anchor. */
    readonly entityType: AiChatEntityType;
    /** Listing id. */
    readonly entityId: string;
    /**
     * URL of the listing's FAQ section, the target of «Agregar como pregunta
     * frecuente». Empty when the vertical has no FAQ section: the shortcut is
     * then hidden instead of linking back to this page.
     */
    readonly faqUrl: string;
}

/**
 * The AI questions panel.
 *
 * @param props - {@link AiQuestionsPanelProps}
 * @returns The panel's sections.
 */
export function AiQuestionsPanel({
    locale,
    entityType,
    entityId,
    faqUrl
}: AiQuestionsPanelProps): JSX.Element {
    const { t } = createTranslations(locale);
    const questions = useAiQuestions({ entityType, entityId, t });
    const { state, from, to } = questions;
    const helpId = sectionHelpId({ vertical: entityType, slug: 'preguntas-ia' });
    const hasFilter = from !== '' || to !== '';

    const filters = (
        <div className={styles.filters}>
            <Field
                locale={locale}
                label={t('host.properties.editor.aiQuestions.filter.from', 'Desde')}
                className={styles.filterField}
            >
                <TextInput
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(event) => questions.setFrom(event.target.value)}
                />
            </Field>
            <Field
                locale={locale}
                label={t('host.properties.editor.aiQuestions.filter.to', 'Hasta')}
                className={styles.filterField}
            >
                <TextInput
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(event) => questions.setTo(event.target.value)}
                />
            </Field>
            {hasFilter && (
                <Button
                    variant="ghost"
                    onClick={questions.clearRange}
                >
                    {t('host.properties.editor.aiQuestions.filter.clear', 'Limpiar fechas')}
                </Button>
            )}
        </div>
    );

    /**
     * The overview section: intro, filters and whatever the request answered.
     * Every branch renders it as the FIRST child of a fragment, so React keeps
     * the same date inputs mounted (and focused) while the range refetches.
     */
    const overview = (body: ReactNode, withFilters: boolean): JSX.Element => (
        <Section
            title={t('host.properties.editor.section.aiQuestions', 'Preguntas a la IA')}
            description={t(
                'host.properties.editor.aiQuestions.intro',
                'Lo que los visitantes le preguntaron al asistente de tu ficha. Las preguntas son anónimas y se guardan 12 meses.'
            )}
            helpId={helpId}
        >
            <div className={styles.stack}>
                <p className={styles.note}>
                    {t(
                        'host.properties.editor.aiQuestions.redactionNote',
                        'Los datos de contacto (emails y teléfonos) se ocultan en las preguntas que ves acá.'
                    )}
                </p>
                {withFilters && filters}
                {withFilters && questions.filterError && (
                    <Alert
                        tone="danger"
                        locale={locale}
                    >
                        {questions.filterError}
                    </Alert>
                )}
                {body}
            </div>
        </Section>
    );

    if (state.kind === 'loading') {
        return (
            <>
                {overview(
                    <Skeleton
                        locale={locale}
                        lines={3}
                    />,
                    false
                )}
            </>
        );
    }

    if (state.kind === 'notOwner') {
        return (
            <>
                {overview(
                    <EmptyState
                        variant="compact"
                        title={t(
                            'host.properties.editor.aiQuestions.notOwner',
                            'Solo el dueño de la ficha puede ver las preguntas que le hicieron al asistente.'
                        )}
                    />,
                    false
                )}
            </>
        );
    }

    if (state.kind === 'error') {
        return (
            <>
                {overview(
                    <ErrorState
                        locale={locale}
                        description={t(
                            'host.properties.editor.aiQuestions.error',
                            'No pudimos cargar las preguntas. Probá de nuevo en un rato.'
                        )}
                        onRetry={questions.reload}
                    />,
                    true
                )}
            </>
        );
    }

    const data = state.data;
    if (data.items.length === 0 && (data.dismissed?.length ?? 0) === 0) {
        return (
            <>
                {overview(
                    <EmptyState
                        variant="compact"
                        title={t(
                            hasFilter
                                ? 'host.properties.editor.aiQuestions.emptyFiltered'
                                : 'host.properties.editor.aiQuestions.empty',
                            hasFilter
                                ? 'No hay preguntas en ese rango de fechas.'
                                : 'Todavía nadie le hizo preguntas al asistente de esta ficha.'
                        )}
                    />,
                    true
                )}
            </>
        );
    }

    const { unanswered, others } = splitAiQuestions({ items: data.items });
    const dismissed = data.dismissed ?? [];
    const unansweredTitle = t(
        'host.properties.editor.aiQuestions.unansweredTitle',
        'Sin responder'
    );
    const othersTitle = t('host.properties.editor.aiQuestions.othersTitle', 'Otras preguntas');
    const dismissedTitle = t('host.properties.editor.aiQuestions.dismissedTitle', 'Descartadas');

    return (
        <>
            {overview(
                <>
                    {questions.mutationError && (
                        <Alert
                            tone="danger"
                            locale={locale}
                        >
                            {questions.mutationError}
                        </Alert>
                    )}
                    {data.truncated && !questions.hasLoadedMore && (
                        <p className={styles.note}>
                            {t(
                                'host.properties.editor.aiQuestions.truncated',
                                'Preguntas mostradas: {{shown}} de {{total}}. Las sin responder van primero.',
                                { shown: data.items.length, total: data.total }
                            )}
                        </p>
                    )}
                </>,
                true
            )}

            {unanswered.length > 0 && (
                <Section
                    title={unansweredTitle}
                    description={t(
                        'host.properties.editor.aiQuestions.unansweredHint',
                        'El asistente no encontró la respuesta en tu ficha. Sumarlas como preguntas frecuentes lo ayuda a responder la próxima vez.'
                    )}
                    actions={
                        <CountPill
                            count={data.unansweredCount}
                            variant="solid"
                            label={t(
                                'host.properties.editor.aiQuestions.unansweredCountLabel',
                                '{{count}} sin responder',
                                { count: data.unansweredCount }
                            )}
                        />
                    }
                    flush
                    helpId={helpId}
                >
                    <DataList label={unansweredTitle}>
                        {unanswered.map((item) => (
                            <AiQuestionRow
                                key={item.id}
                                item={item}
                                locale={locale}
                                t={t}
                                faqUrl={faqUrl}
                                onDismiss={() => void questions.mutateQuestion(item, 'dismiss')}
                            />
                        ))}
                    </DataList>
                </Section>
            )}

            {others.length > 0 && (
                <Section
                    title={othersTitle}
                    flush
                    helpId={helpId}
                    footer={
                        data.othersNextCursor ? (
                            <Button
                                variant="secondary"
                                onClick={() => void questions.loadMore()}
                            >
                                {t('host.properties.editor.aiQuestions.viewMore', 'Ver más')}
                            </Button>
                        ) : undefined
                    }
                >
                    <DataList label={othersTitle}>
                        {others.map((item) => (
                            <AiQuestionRow
                                key={item.id}
                                item={item}
                                locale={locale}
                                t={t}
                                faqUrl={faqUrl}
                            />
                        ))}
                    </DataList>
                </Section>
            )}

            {data.dismissedCount > 0 && (
                <Section
                    title={dismissedTitle}
                    actions={
                        <CountPill
                            count={data.dismissedCount}
                            label={t(
                                'host.properties.editor.aiQuestions.dismissedCountLabel',
                                '{{count}} descartadas',
                                { count: data.dismissedCount }
                            )}
                        />
                    }
                    helpId={helpId}
                >
                    {/* Collapsed while there is anything else to look at. */}
                    <details
                        className={styles.disclosure}
                        open={data.items.length === 0}
                    >
                        <summary className={styles.summary}>
                            {t(
                                'host.properties.editor.aiQuestions.dismissedToggle',
                                'Ver las descartadas'
                            )}
                        </summary>
                        {data.dismissedCount > dismissed.length && (
                            <p className={styles.note}>
                                {t(
                                    'host.properties.editor.aiQuestions.dismissedTruncated',
                                    'Descartadas mostradas: {{shown}} de {{total}}. Ves las más recientes.',
                                    { shown: dismissed.length, total: data.dismissedCount }
                                )}
                            </p>
                        )}
                        <DataList label={dismissedTitle}>
                            {dismissed.map((item) => (
                                <AiDismissedQuestionRow
                                    key={item.id}
                                    item={item}
                                    locale={locale}
                                    t={t}
                                    onUndo={() => void questions.mutateQuestion(item, 'undismiss')}
                                />
                            ))}
                        </DataList>
                    </details>
                </Section>
            )}
        </>
    );
}
