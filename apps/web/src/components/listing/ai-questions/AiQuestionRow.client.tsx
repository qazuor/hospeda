/**
 * One question of the «Preguntas a la IA» tab (HOS-2101, split out of
 * `AiQuestionsPanel` by HOS-2503): the question, the assistant's answer, the
 * date and at most two actions.
 *
 * A row of a kit `DataList`, but not a kit `ListRow`: `ListRow` clamps its
 * title and description to one line inside `<p>`s, and this row must show the
 * whole question and the sanitized markdown answer (block HTML). It keeps the
 * kit row recipe (separator, padding, two actions) on tokens.
 *
 * @module components/listing/ai-questions/AiQuestionRow
 */

import { localizeRedactionTokens } from '@repo/i18n/web';
import type { AiListingQuestion } from '@repo/schemas';
import type { JSX } from 'react';
import { Button } from '@/components/account/ui/Button';
import { LinkButton } from '@/components/account/ui/LinkButton';
import { buildFaqPrefillHref } from '@/hooks/use-faq-prefill';
import { renderChatMarkdown } from '@/lib/ai-search/render-chat-markdown';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { stripMarkdownPlain } from '@/lib/render-plain';
import styles from './AiQuestionsPanel.module.css';

/** Stored `[REDACTED_*]` markers are technical: show a label in the page language (HOS-2320). */
function visibleText({
    text,
    locale
}: {
    readonly text: string;
    readonly locale: SupportedLocale;
}): string {
    return localizeRedactionTokens({ text, locale }).text;
}

/** The asked-at date of a question. */
function AskedAt({
    askedAt,
    locale
}: {
    readonly askedAt: string;
    readonly locale: SupportedLocale;
}): JSX.Element {
    return (
        <time
            className={styles.date}
            dateTime={askedAt}
        >
            {formatDate({
                date: new Date(askedAt),
                locale,
                options: { day: 'numeric', month: 'short', year: 'numeric' }
            })}
        </time>
    );
}

/** Props of {@link AiQuestionRow}. */
export interface AiQuestionRowProps {
    readonly item: AiListingQuestion;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    /** FAQ section URL; empty hides «Agregar como pregunta frecuente». */
    readonly faqUrl: string;
    /** When given, shows «Ya lo vi» (unanswered rows). */
    readonly onDismiss?: () => void;
}

/**
 * An answered or unanswered question.
 *
 * @param props - See {@link AiQuestionRowProps}.
 * @returns A `<li>`.
 */
export function AiQuestionRow({
    item,
    locale,
    t,
    faqUrl,
    onDismiss
}: AiQuestionRowProps): JSX.Element {
    const question = visibleText({ text: item.question, locale });
    const answer = visibleText({ text: item.answer, locale });
    return (
        <li className={onDismiss ? `${styles.row} ${styles.rowUnanswered}` : styles.row}>
            <p className={styles.question}>{question}</p>
            <div className={styles.answer}>
                <span className={styles.answerLabel}>
                    {t(
                        'host.properties.editor.aiQuestions.answerLabel',
                        'Respuesta del asistente:'
                    )}
                </span>
                <div
                    className={styles.answerBody}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via renderChatMarkdown (DOMPurify) before rendering
                    dangerouslySetInnerHTML={{
                        // nosemgrep:typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                        __html: renderChatMarkdown({ raw: answer })
                    }}
                />
            </div>
            <div className={styles.meta}>
                <AskedAt
                    askedAt={item.askedAt}
                    locale={locale}
                />
                <div className={styles.actions}>
                    {faqUrl !== '' && (
                        <LinkButton
                            variant="secondary"
                            size="sm"
                            href={
                                buildFaqPrefillHref({
                                    faqUrl,
                                    question,
                                    answer: stripMarkdownPlain(answer),
                                    messageId: item.id,
                                    includeAnswer: item.answerStatus === 'answered'
                                }).href
                            }
                        >
                            {t(
                                'host.properties.editor.aiQuestions.addAsFaq',
                                'Agregar como pregunta frecuente'
                            )}
                        </LinkButton>
                    )}
                    {onDismiss && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onDismiss}
                        >
                            {t('host.properties.editor.aiQuestions.markSeen', 'Ya lo vi')}
                        </Button>
                    )}
                </div>
            </div>
        </li>
    );
}

/** Props of {@link AiDismissedQuestionRow}. */
export interface AiDismissedQuestionRowProps {
    readonly item: AiListingQuestion;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    readonly onUndo: () => void;
}

/**
 * A dismissed question, with «Deshacer».
 *
 * @param props - See {@link AiDismissedQuestionRowProps}.
 * @returns A `<li>`.
 */
export function AiDismissedQuestionRow({
    item,
    locale,
    t,
    onUndo
}: AiDismissedQuestionRowProps): JSX.Element {
    return (
        <li className={styles.row}>
            <p className={styles.question}>{visibleText({ text: item.question, locale })}</p>
            <p className={styles.answer}>{visibleText({ text: item.answer, locale })}</p>
            <div className={styles.meta}>
                <AskedAt
                    askedAt={item.askedAt}
                    locale={locale}
                />
                <div className={styles.actions}>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onUndo}
                    >
                        {t('host.properties.editor.aiQuestions.undo', 'Deshacer')}
                    </Button>
                </div>
            </div>
        </li>
    );
}
