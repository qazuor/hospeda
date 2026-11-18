/**
 * @file AiActivityItem.tsx
 * @description One row of the assistant history (HOS-2348, spec HOS-2335 §6.9):
 * when, which assistant, what it did, on what, and how it ended.
 *
 * Shows only what the API projection returns. The assistant name is declared
 * by the client itself (untrusted) and renders as plain React text; a tool
 * name or error code is never shown raw, only through its i18n label.
 */

import {
    type AiActivityItem as AiActivityItemData,
    normalizeAiActivityStep,
    resolveAiActivityResult,
    resolveAiActivityTarget
} from '@/lib/ai-activity';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './AiActivityHistory.module.css';

/** Props of {@link AiActivityItem}. */
export interface AiActivityItemProps {
    /** The item, as validated from the API. */
    readonly item: AiActivityItemData;
    /** Active locale, for the date and time. */
    readonly locale: SupportedLocale;
    /** Translator of the active locale. */
    readonly t: TranslationFn;
}

const KEY = 'account.aiAssistants.activity';

/** CSS class of each result badge. */
const RESULT_CLASS = {
    done: styles.resultDone,
    deniedByHospeda: styles.resultDenied,
    declinedByYou: styles.resultDeclined,
    error: styles.resultError
} as const;

/** Spanish fallbacks of the result labels (the locale files are the source). */
const RESULT_FALLBACK = {
    done: 'Hecho',
    deniedByHospeda: 'Rechazado por Hospeda',
    declinedByYou: 'Rechazado por vos',
    error: 'Error'
} as const;

/**
 * One assistant action.
 *
 * @example
 * ```tsx
 * <AiActivityItem item={item} locale="es" t={t} />
 * ```
 */
export function AiActivityItem({ item, locale, t }: AiActivityItemProps) {
    const result = resolveAiActivityResult({ outcome: item.outcome, errorCode: item.errorCode });
    const step = normalizeAiActivityStep({ step: item.step });
    const target = resolveAiActivityTarget({ target: item.target });
    const assistant =
        item.client.name?.trim() || t(`${KEY}.unnamedAssistant`, 'Asistente sin nombre');
    const showReason = result === 'deniedByHospeda' || result === 'error';

    return (
        <li className={styles.item}>
            <div className={styles.itemHead}>
                <p className={styles.action}>
                    {t(
                        `${KEY}.tools.${item.tool}`,
                        t(`${KEY}.unknownTool`, 'Otra acción del asistente')
                    )}
                </p>
                <span className={cn(styles.result, RESULT_CLASS[result])}>
                    {t(`${KEY}.result.${result}`, RESULT_FALLBACK[result])}
                </span>
            </div>

            {target?.kind === 'listing' &&
                (target.url ? (
                    <a
                        className={styles.targetLink}
                        href={target.url}
                    >
                        {target.label}
                    </a>
                ) : (
                    <p className={styles.target}>{target.label}</p>
                ))}
            {target?.kind === 'listingUnavailable' && (
                <p className={styles.targetMuted}>
                    {t(`${KEY}.target.unavailable`, 'Publicación que ya no está disponible')}
                </p>
            )}
            {target?.kind === 'conversation' &&
                (target.url ? (
                    <a
                        className={styles.targetLink}
                        href={target.url}
                    >
                        {t(`${KEY}.target.conversation`, 'Consulta')}
                    </a>
                ) : (
                    <p className={styles.target}>{t(`${KEY}.target.conversation`, 'Consulta')}</p>
                ))}

            <p className={styles.meta}>
                <time dateTime={item.loggedAt.toISOString()}>
                    {formatDate({
                        date: item.loggedAt,
                        locale,
                        options: { dateStyle: 'medium', timeStyle: 'short' }
                    })}
                </time>
                <span aria-hidden="true">·</span>
                <span>{assistant}</span>
                {step && (
                    <>
                        <span aria-hidden="true">·</span>
                        <span className={styles.step}>
                            {step === 'preview'
                                ? t(`${KEY}.steps.preview`, 'Vista previa')
                                : t(`${KEY}.steps.commit`, 'Confirmado')}
                        </span>
                    </>
                )}
            </p>

            {showReason && item.errorCode !== undefined && (
                <p className={styles.reason}>
                    {t(
                        `${KEY}.errorCodes.${item.errorCode}`,
                        t(`${KEY}.errorCodes.UNEXPECTED`, 'Ocurrió un error inesperado.')
                    )}
                </p>
            )}
        </li>
    );
}
