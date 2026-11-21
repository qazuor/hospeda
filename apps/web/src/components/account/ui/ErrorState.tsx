/**
 * ErrorState — a failed load, said as a failure (HOS-2413 T-024).
 *
 * Makes it impossible to show a failure as «empty» or «0». Two shapes:
 * `block` (a centered panel for a whole region) and `inline` (an
 * `Alert tone="danger"` for a strip). Both are `role="alert"`, show a
 * translated title and a «Reintentar» button with a retrying state, and put
 * focus back on that button once a retry finishes (a retry that fails again
 * leaves the user on the control they pressed). They NEVER render the API's
 * own `error.message`: there is no prop to pass it through.
 *
 * @module components/account/ui/ErrorState
 */

import { type ReactNode, useRef, useState } from 'react';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { Alert } from './Alert';
import styles from './Alert.module.css';
import { Button } from './Button';
import { cx } from './cx';
import { type HelpAnchor, helpAttr } from './help-anchor';

/** Props of {@link ErrorState}. */
export interface ErrorStateProps {
    /** Locale for the copy. */
    readonly locale: SupportedLocale;
    /** Runs the retry. May be async: the button shows its busy state meanwhile. */
    readonly onRetry: () => void | Promise<void>;
    /** `block` for a region, `inline` for a strip. @default 'block' */
    readonly variant?: 'block' | 'inline';
    /** Override the translated title (rarely needed). */
    readonly title?: ReactNode;
    /** Override the translated description (rarely needed). */
    readonly description?: ReactNode;
    /** Extra class from the caller (layout only). */
    readonly className?: string;
    /** Optional help anchor rendered as `data-help`. */
    readonly helpId?: HelpAnchor;
}

/**
 * The kit error state.
 *
 * @param props - See {@link ErrorStateProps}.
 * @returns An alert with a retry button.
 */
export function ErrorState({
    locale,
    onRetry,
    variant = 'block',
    title,
    description,
    className,
    helpId
}: ErrorStateProps) {
    const t = createT(locale);
    const retryRef = useRef<HTMLButtonElement>(null);
    const [retrying, setRetrying] = useState(false);

    const handleRetry = async () => {
        setRetrying(true);
        try {
            await onRetry();
        } finally {
            setRetrying(false);
            retryRef.current?.focus();
        }
    };

    const retry = (
        <Button
            ref={retryRef}
            variant={variant === 'inline' ? 'secondary' : 'primary'}
            size={variant === 'inline' ? 'sm' : 'md'}
            loading={retrying}
            onClick={handleRetry}
        >
            {t('account.ui.error.retry')}
        </Button>
    );

    if (variant === 'inline') {
        return (
            <Alert
                tone="danger"
                locale={locale}
                title={title ?? t('account.ui.error.title')}
                action={retry}
                className={className}
                helpId={helpId}
            >
                {description ?? t('account.ui.error.description')}
            </Alert>
        );
    }

    return (
        <div
            {...helpAttr({ helpId })}
            role="alert"
            className={cx(styles.errorBlock, className)}
        >
            <h3 className={styles.errorTitle}>{title ?? t('account.ui.error.title')}</h3>
            <p className={styles.errorDescription}>
                {description ?? t('account.ui.error.description')}
            </p>
            {retry}
        </div>
    );
}
