/**
 * AutoSaveChip — presentational save status for direct and explicit saves.
 *
 * For a control that saves on its own (a switch, a reorder). `saving` says
 * «Guardando…», `saved` says «Guardado 14:32» (es-AR 24h time from `savedAt`)
 * and `error` says «No se guardó · Reintentar». It is `role="status"`, or
 * `alert` on error. Clean/dirty are informational: they never initiate a save.
 *
 * @module components/account/ui/AutoSaveChip
 */

import { CheckIcon } from '@repo/icons';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './StickySaveBar.module.css';

/** Time zone used to format `savedAt` (the product's market). */
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Status of the chip. */
export type AutoSaveStatus = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

/** Props of {@link AutoSaveChip}. */
export interface AutoSaveChipProps {
    /** Current status. */
    readonly status: AutoSaveStatus;
    /** When the last save finished (shown for `saved`). */
    readonly savedAt?: Date;
    /** Runs the retry (shown for `error`). */
    readonly onRetry?: () => void;
    /** Locale for the copy. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * Formats a time as es-AR 24h («14:32»).
 *
 * @param input - Options object.
 * @param input.date - The instant to format.
 * @returns `HH:mm` in the product's time zone.
 */
export function formatSavedTime({ date }: { readonly date: Date }): string {
    return new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: TIME_ZONE
    }).format(date);
}

/**
 * The kit autosave chip.
 *
 * @param props - See {@link AutoSaveChipProps}.
 * @returns A `<span role="status|alert">`.
 */
export function AutoSaveChip({
    status,
    savedAt,
    onRetry,
    locale,
    className,
    helpId
}: AutoSaveChipProps) {
    const t = createT(locale);
    const text =
        status === 'saved'
            ? t('account.ui.autoSave.saved', undefined, {
                  time: savedAt ? formatSavedTime({ date: savedAt }) : ''
              })
            : status === 'saving'
              ? t('account.ui.autoSave.saving')
              : t(`account.ui.autoSave.${status}`);

    return (
        <span
            {...helpAttr({ helpId })}
            role={status === 'error' ? 'alert' : 'status'}
            data-status={status}
            className={cx(
                styles.chip,
                status === 'clean' && styles.chipClean,
                status === 'dirty' && styles.chipDirty,
                status === 'error' && styles.chipError,
                className
            )}
        >
            {status === 'clean' ? (
                <CheckIcon
                    size="xs"
                    weight="bold"
                    aria-hidden="true"
                />
            ) : null}
            {status === 'dirty' ? (
                <span
                    className={styles.chipDot}
                    aria-hidden="true"
                />
            ) : null}
            {text}
            {status === 'error' && onRetry ? (
                <>
                    <span aria-hidden="true">·</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRetry}
                    >
                        {t('account.ui.autoSave.retry')}
                    </Button>
                </>
            ) : null}
        </span>
    );
}
