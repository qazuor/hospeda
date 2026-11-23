/**
 * @file AiActivityItem.tsx
 * @description One row of the assistant history (HOS-2348, spec HOS-2335 §6.9):
 * when, which assistant, what it did, on what, and how it ended.
 *
 * Shows only what the API projection returns. The assistant name is declared
 * by the client itself (untrusted) and renders as plain React text; a tool
 * name or error code is never shown raw, only through its i18n label.
 *
 * Every conversation link reads "Consulta de huésped", so its accessible name
 * adds the action and the date: a screen-reader links list can tell them apart.
 */

import { ListRow, StatusPill, type StatusTone } from '@/components/account/ui';
import {
    type AiActivityItem as AiActivityItemData,
    normalizeAiActivityStep,
    resolveAiActivityResult,
    resolveAiActivityTarget
} from '@/lib/ai-activity';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';

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

/** Tone of each result pill. */
const RESULT_TONE: Readonly<Record<keyof typeof RESULT_FALLBACK, StatusTone>> = {
    done: 'success',
    deniedByHospeda: 'warning',
    declinedByYou: 'neutral',
    error: 'danger',
    unknown: 'neutral'
};

/** Spanish fallbacks of the result labels (the locale files are the source). */
const RESULT_FALLBACK = {
    done: 'Hecho',
    deniedByHospeda: 'Rechazado por Hospeda',
    declinedByYou: 'Rechazado por vos',
    error: 'Error',
    unknown: 'Resultado desconocido'
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
    const action = t(
        `${KEY}.tools.${item.tool}`,
        t(`${KEY}.unknownTool`, 'Otra acción del asistente')
    );
    const when = formatDate({
        date: item.loggedAt,
        locale,
        options: { dateStyle: 'medium', timeStyle: 'short' }
    });

    const targetNode =
        target?.kind === 'listing' ? (
            target.url ? (
                <a href={target.url}>{target.label}</a>
            ) : (
                <span>{target.label}</span>
            )
        ) : target?.kind === 'listingUnavailable' ? (
            <span>{t(`${KEY}.target.unavailable`, 'Publicación que ya no está disponible')}</span>
        ) : target?.kind === 'conversation' ? (
            target.url ? (
                <a
                    href={target.url}
                    aria-label={t(
                        `${KEY}.target.conversationAria`,
                        'Abrir la consulta de huésped de «{{action}}», del {{date}}',
                        { action, date: when }
                    )}
                >
                    {t(`${KEY}.target.conversation`, 'Consulta de huésped')}
                </a>
            ) : (
                <span>{t(`${KEY}.target.conversation`, 'Consulta de huésped')}</span>
            )
        ) : null;

    const reason =
        showReason && item.errorCode !== undefined
            ? t(
                  `${KEY}.errorCodes.${item.errorCode}`,
                  t(`${KEY}.errorCodes.UNEXPECTED`, 'Ocurrió un error inesperado.')
              )
            : null;

    return (
        <ListRow
            rowId={String(item.id)}
            title={action}
            meta={
                <>
                    <time dateTime={item.loggedAt.toISOString()}>{when}</time>
                    <span aria-hidden="true"> · </span>
                    <span>{assistant}</span>
                    {step && (
                        <>
                            <span aria-hidden="true"> · </span>
                            <span>
                                {step === 'preview'
                                    ? t(`${KEY}.steps.preview`, 'Vista previa')
                                    : t(`${KEY}.steps.commit`, 'Confirmado')}
                            </span>
                        </>
                    )}
                </>
            }
            description={
                targetNode || reason ? (
                    <>
                        {targetNode}
                        {targetNode && reason ? ' ' : null}
                        {reason ? <span>{reason}</span> : null}
                    </>
                ) : undefined
            }
            wrapDescription
            trailing={
                <StatusPill tone={RESULT_TONE[result]}>
                    {t(`${KEY}.result.${result}`, RESULT_FALLBACK[result])}
                </StatusPill>
            }
        />
    );
}
