/**
 * Toast — one notification of the Mi Cuenta kit (HOS-2413 T-025, OD-11).
 *
 * It renders a toast that already lives in `store/toast-store`: there is no
 * new store and no new API. Tones are `success`, `danger` and `info`; the
 * store's `warning` maps to `info` and `loading` shows a spinner on a neutral
 * tone. It honours the store's pause/resume on hover, focus and window blur,
 * and a toast WITH an action never auto-dismisses (its timer is frozen while
 * it is on screen). It never steals focus; the action is reachable with Tab.
 *
 * @module components/account/ui/Toast
 */

import { AlertCircleIcon, CheckCircleIcon, CloseIcon, InfoIcon, LoaderIcon } from '@repo/icons';
import { useEffect } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import {
    pauseToast,
    removeToast,
    resumeToast,
    type Toast as ToastModel
} from '@/store/toast-store';
import { Button } from './Button';
import { cx } from './cx';
import { LinkButton } from './LinkButton';
import styles from './Toast.module.css';

/** Tone of the kit toast. */
export type ToastTone = 'success' | 'danger' | 'info' | 'neutral';

/**
 * Maps a store toast type to a kit tone.
 *
 * @param input - Options object.
 * @param input.type - The store's toast type.
 * @returns `warning` becomes `info`, `error` becomes `danger`, `loading` is `neutral`.
 */
export function toneForToast({ type }: { readonly type: ModelType }): ToastTone {
    if (type === 'success') return 'success';
    if (type === 'error') return 'danger';
    if (type === 'loading') return 'neutral';
    return 'info';
}

type ModelType = ToastModel['type'];

const ICONS = {
    success: CheckCircleIcon,
    danger: AlertCircleIcon,
    info: InfoIcon,
    neutral: LoaderIcon
} as const;

/** Props of {@link Toast}. */
export interface ToastProps {
    /** The toast, as the store holds it. */
    readonly toast: ToastModel;
    /** Locale for the close label. */
    readonly locale: SupportedLocale;
}

/**
 * The kit toast.
 *
 * @param props - See {@link ToastProps}.
 * @returns The toast card.
 */
export function Toast({ toast, locale }: ToastProps) {
    const t = createT(locale);
    const tone = toneForToast({ type: toast.type });
    const Icon = ICONS[tone];
    const hasAction = Boolean(toast.action || toast.secondaryAction);

    // A toast with an action stays until the user answers it: freeze its timer.
    useEffect(() => {
        if (hasAction) pauseToast(toast.id);
    }, [hasAction, toast.id]);

    // The store's timers pause while the window is not focused.
    useEffect(() => {
        const onBlur = () => pauseToast(toast.id);
        const onFocus = () => {
            if (!hasAction) resumeToast(toast.id);
        };
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        return () => {
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
        };
    }, [toast.id, hasAction]);

    const pause = () => pauseToast(toast.id);
    const resume = () => {
        if (!hasAction) resumeToast(toast.id);
    };

    const renderAction = (action: NonNullable<ToastModel['action']>, primary: boolean) =>
        action.href ? (
            <LinkButton
                href={action.href}
                variant={primary ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => removeToast(toast.id)}
            >
                {action.label}
            </LinkButton>
        ) : (
            <Button
                variant={primary ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {
                    action.onClick?.();
                    removeToast(toast.id);
                }}
            >
                {action.label}
            </Button>
        );

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover/focus handlers only pause the auto-dismiss timer; the toast content is not itself interactive
        <div
            data-toast-tone={tone}
            className={cx(styles.toast, styles[tone])}
            onPointerEnter={pause}
            onPointerLeave={resume}
            onFocus={pause}
            onBlur={resume}
        >
            <span
                className={cx(styles.icon, toast.type === 'loading' && styles.spinning)}
                aria-hidden="true"
            >
                <Icon size="md" />
            </span>
            <div className={styles.body}>
                <p className={styles.message}>{toast.message}</p>
                {hasAction ? (
                    <div className={styles.actions}>
                        {toast.action ? renderAction(toast.action, true) : null}
                        {toast.secondaryAction ? renderAction(toast.secondaryAction, false) : null}
                    </div>
                ) : null}
            </div>
            <Button
                variant="quiet"
                size="sm"
                iconOnly
                aria-label={t('account.ui.close')}
                className={styles.close}
                onClick={() => removeToast(toast.id)}
            >
                <CloseIcon
                    size="sm"
                    aria-hidden="true"
                />
            </Button>
        </div>
    );
}
