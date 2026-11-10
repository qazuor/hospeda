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
 * @module components/listing/ai-questions/AiQuestionsPanel
 */

import type {
    AiChatEntityType,
    AiListingQuestion,
    AiListingQuestionsResponse
} from '@repo/schemas';
import { type JSX, useEffect, useState } from 'react';
import { buildFaqPrefillHref } from '@/hooks/use-faq-prefill';
import { apiClient } from '@/lib/api/client';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AiQuestionsPanel.module.css';

/** Endpoint behind the panel. */
export const AI_LISTING_QUESTIONS_PATH = '/api/v1/protected/ai/listing-questions';

/** Props of {@link AiQuestionsPanel}. */
export interface AiQuestionsPanelProps {
    /** UI locale. */
    readonly locale: SupportedLocale;
    /** Vertical of the listing. */
    readonly entityType: AiChatEntityType;
    /** Listing id. */
    readonly entityId: string;
    /** URL of the listing's FAQ section, the target of «Agregar como pregunta frecuente». */
    readonly faqUrl: string;
}

type LoadState =
    | { readonly kind: 'loading' }
    | { readonly kind: 'error' }
    | { readonly kind: 'ready'; readonly data: AiListingQuestionsResponse };

/**
 * Splits the list into the unanswered block and the rest, keeping the
 * server's newest-first order inside each.
 *
 * @param input - The items as returned by the API.
 * @returns `{ unanswered, others }`.
 */
export function splitAiQuestions(input: { readonly items: readonly AiListingQuestion[] }): {
    readonly unanswered: readonly AiListingQuestion[];
    readonly others: readonly AiListingQuestion[];
} {
    return {
        unanswered: input.items.filter((item) => item.answerStatus === 'unanswered'),
        others: input.items.filter((item) => item.answerStatus !== 'unanswered')
    };
}

/**
 * The AI questions panel.
 *
 * @param props - {@link AiQuestionsPanelProps}
 * @returns The panel.
 */
export function AiQuestionsPanel({
    locale,
    entityType,
    entityId,
    faqUrl
}: AiQuestionsPanelProps): JSX.Element {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<LoadState>({ kind: 'loading' });

    useEffect(() => {
        let cancelled = false;
        const load = async (): Promise<void> => {
            const result = await apiClient.getProtected<AiListingQuestionsResponse>({
                path: AI_LISTING_QUESTIONS_PATH,
                params: { entityType, entityId }
            });
            if (cancelled) return;
            setState(result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' });
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [entityType, entityId]);

    const intro = (
        <p className={styles.intro}>
            {t(
                'host.properties.editor.aiQuestions.intro',
                'Lo que los visitantes le preguntaron al asistente de tu ficha. Las preguntas son anónimas y se guardan 12 meses.'
            )}
        </p>
    );

    if (state.kind === 'loading') {
        return (
            <div className={styles.panel}>
                {intro}
                <p
                    className={styles.status}
                    aria-live="polite"
                >
                    {t('host.properties.editor.aiQuestions.loading', 'Cargando preguntas…')}
                </p>
            </div>
        );
    }

    if (state.kind === 'error') {
        return (
            <div className={styles.panel}>
                {intro}
                <p
                    className={styles.error}
                    role="alert"
                >
                    {t(
                        'host.properties.editor.aiQuestions.error',
                        'No pudimos cargar las preguntas. Probá de nuevo en un rato.'
                    )}
                </p>
            </div>
        );
    }

    const { data } = state;
    if (data.items.length === 0) {
        return (
            <div className={styles.panel}>
                {intro}
                <p className={styles.status}>
                    {t(
                        'host.properties.editor.aiQuestions.empty',
                        'Todavía nadie le hizo preguntas al asistente de esta ficha.'
                    )}
                </p>
            </div>
        );
    }

    const { unanswered, others } = splitAiQuestions({ items: data.items });
    const renderItem = (item: AiListingQuestion, withAction: boolean): JSX.Element => (
        <li
            key={item.id}
            className={withAction ? `${styles.item} ${styles.itemUnanswered}` : styles.item}
        >
            <p className={styles.question}>{item.question}</p>
            <p className={styles.answer}>
                <span className={styles.answerLabel}>
                    {t(
                        'host.properties.editor.aiQuestions.answerLabel',
                        'Respuesta del asistente:'
                    )}
                </span>{' '}
                {item.answer}
            </p>
            <div className={styles.meta}>
                <time dateTime={item.askedAt}>
                    {formatDate({
                        date: new Date(item.askedAt),
                        locale,
                        options: { day: 'numeric', month: 'short', year: 'numeric' }
                    })}
                </time>
                {withAction && (
                    <a
                        className={styles.addFaq}
                        href={buildFaqPrefillHref({ faqUrl, question: item.question }).href}
                    >
                        {t(
                            'host.properties.editor.aiQuestions.addAsFaq',
                            'Agregar como pregunta frecuente'
                        )}
                    </a>
                )}
            </div>
        </li>
    );

    return (
        <div className={styles.panel}>
            {intro}
            {unanswered.length > 0 && (
                <section
                    className={styles.block}
                    aria-labelledby="ai-questions-unanswered"
                >
                    <h2
                        id="ai-questions-unanswered"
                        className={styles.blockTitle}
                    >
                        {t('host.properties.editor.aiQuestions.unansweredTitle', 'Sin responder')}{' '}
                        <span className={styles.counter}>{data.unansweredCount}</span>
                    </h2>
                    <p className={styles.blockHint}>
                        {t(
                            'host.properties.editor.aiQuestions.unansweredHint',
                            'El asistente no encontró la respuesta en tu ficha. Sumarlas como preguntas frecuentes lo ayuda a responder la próxima vez.'
                        )}
                    </p>
                    <ul className={styles.list}>
                        {unanswered.map((item) => renderItem(item, true))}
                    </ul>
                </section>
            )}
            {others.length > 0 && (
                <section
                    className={styles.block}
                    aria-labelledby="ai-questions-others"
                >
                    <h2
                        id="ai-questions-others"
                        className={styles.blockTitle}
                    >
                        {t('host.properties.editor.aiQuestions.othersTitle', 'Otras preguntas')}
                    </h2>
                    <ul className={styles.list}>{others.map((item) => renderItem(item, false))}</ul>
                </section>
            )}
            {data.truncated && (
                <p className={styles.status}>
                    {t(
                        'host.properties.editor.aiQuestions.truncated',
                        'Preguntas mostradas: {{shown}} de {{total}} (las más recientes).',
                        { shown: data.items.length, total: data.total }
                    )}
                </p>
            )}
        </div>
    );
}
