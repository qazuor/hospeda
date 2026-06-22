/**
 * @file LoadingButton.tsx
 * @description Canonical async `<button>` for web React islands. Wraps a native
 * button and enforces the shared loading contract: while `loading` is true it is
 * `disabled` (preventing double-submit), carries `aria-busy`, swaps its visible
 * label to `loadingLabel`, and shows an inline {@link Spinner}.
 *
 * Use this for plain `<button>` async actions. CTAs already built on
 * `GradientButtonReact` use that component's own `loading` prop instead — both
 * honor the same a11y contract and share the Spinner primitive (see
 * `apps/web/docs/loading-states.md`).
 *
 * @example
 * ```tsx
 * <LoadingButton
 *   loading={sending}
 *   loadingLabel={t('conversations.thread.sending', 'Enviando…')}
 *   onClick={handleSend}
 * >
 *   {t('conversations.thread.send', 'Enviar')}
 * </LoadingButton>
 * ```
 */

import { cn } from '@/lib/cn';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import styles from './LoadingButton.module.css';
import { Spinner } from './Spinner';

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-busy'>;

export interface LoadingButtonProps extends NativeButtonProps {
    /** When true the button is disabled, busy, and shows the spinner + label. */
    readonly loading: boolean;
    /**
     * Visible label shown while `loading` (already i18n-resolved). When omitted
     * the idle children stay visible alongside the spinner.
     */
    readonly loadingLabel?: string;
    /** Idle button content. */
    readonly children: ReactNode;
}

/**
 * Accessible async button with a built-in loading state.
 *
 * @param props - {@link LoadingButtonProps}; all native button props are
 * forwarded except `aria-busy`, which the component controls.
 * @returns The button element.
 */
export function LoadingButton({
    loading,
    loadingLabel,
    children,
    disabled,
    className,
    type = 'button',
    ...rest
}: LoadingButtonProps): ReactElement {
    const rootClass = cn(styles.button, className);

    return (
        // `...rest` is spread first so the component's controlled props
        // (disabled, aria-busy) always win over any caller override.
        <button
            {...rest}
            type={type}
            className={rootClass}
            disabled={disabled || loading}
            aria-busy={loading}
        >
            {loading ? (
                <span className={styles.content}>
                    <Spinner size="sm" />
                    <span>{loadingLabel ?? children}</span>
                </span>
            ) : (
                children
            )}
        </button>
    );
}
