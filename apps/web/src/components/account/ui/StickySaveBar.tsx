/**
 * StickySaveBar — the explicit-save bar (HOS-2413 T-026, D8).
 *
 * For a form with several fields saved as a whole. Drive it with
 * `useSaveBar`. It is hidden while `clean`; otherwise it is a named `region`
 * that says the state (a polite `status`, or an assertive `alert` on error),
 * offers «Guardar cambios» and «Descartar», and on error «Ir al primer error».
 * While visible it renders a spacer that reserves its height, so the last
 * field stays reachable. Desktop: sticky in the content column. Mobile: fixed
 * to the bottom, safe-area aware, with 44px buttons.
 *
 * `contained` renders the bar in flow instead (no fixed/sticky positioning,
 * no spacer). It exists for previews such as the kit gallery, where a fixed
 * bar would cover the neighbouring demos; product forms never set it.
 *
 * It registers NO leave warning itself: `useSaveBar` goes through
 * `useUnsavedChangesGuard`.
 *
 * @module components/account/ui/StickySaveBar
 */

import { createT, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';
import styles from './StickySaveBar.module.css';
import type { SaveBarStatus } from './use-save-bar';

/** Props of {@link StickySaveBar}. */
export interface StickySaveBarProps {
    /** From `useSaveBar`. */
    readonly status: SaveBarStatus;
    /** Runs the save. */
    readonly onSave: () => void;
    /** Discards the edits. */
    readonly onDiscard: () => void;
    /** Focuses the first invalid field (shown on error). */
    readonly onGoToFirstError?: () => void;
    /**
     * The failed save's own reason (an API refusal, a network failure), shown
     * on error IN PLACE of the generic «No se pudieron guardar los cambios».
     * The bar is the only place a save failure is told (owner decision 7, Mi
     * cuenta UI epic): a section never repeats it in a form-level notice.
     */
    readonly errorMessage?: string | null;
    /** Locale for the copy. */
    readonly locale: SupportedLocale;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
    /**
     * Render in flow (no fixed/sticky positioning, no spacer). Preview-only
     * (kit gallery); product forms leave it unset.
     */
    readonly contained?: boolean;
}

/**
 * The kit save bar.
 *
 * @param props - See {@link StickySaveBarProps}.
 * @returns The bar and its spacer, or `null` while `clean`.
 */
export function StickySaveBar({
    status,
    onSave,
    onDiscard,
    onGoToFirstError,
    errorMessage,
    locale,
    className,
    helpId,
    contained = false
}: StickySaveBarProps) {
    if (status === 'clean') return null;
    const t = createT(locale);
    const busy = status === 'saving';
    const message =
        status === 'error' && errorMessage ? errorMessage : t(`account.ui.saveBar.${status}`);

    return (
        <>
            {contained ? null : (
                <div
                    className={styles.spacer}
                    aria-hidden="true"
                    data-testid="save-bar-spacer"
                />
            )}
            <section
                {...helpAttr({ helpId })}
                aria-label={t('account.ui.saveBar.region')}
                data-status={status}
                data-contained={contained ? '' : undefined}
                className={cx(styles.bar, styles[status], contained && styles.contained, className)}
            >
                <p
                    role={status === 'error' ? 'alert' : 'status'}
                    className={styles.message}
                >
                    <span
                        className={styles.dot}
                        aria-hidden="true"
                    />
                    {message}
                </p>
                <div className={styles.actions}>
                    {status === 'error' && onGoToFirstError ? (
                        <Button
                            variant="ghost"
                            size="lg"
                            onClick={onGoToFirstError}
                        >
                            {t('account.ui.saveBar.goToError')}
                        </Button>
                    ) : null}
                    <Button
                        variant="secondary"
                        size="lg"
                        disabled={busy}
                        onClick={onDiscard}
                    >
                        {t('account.ui.saveBar.discard')}
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        loading={busy}
                        onClick={onSave}
                    >
                        {t('account.ui.saveBar.save')}
                    </Button>
                </div>
            </section>
        </>
    );
}
