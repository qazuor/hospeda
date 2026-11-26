import { GradientButton } from '@/components/ui/GradientButtonReact';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './StatusActions.module.css';

/** Resolves the account-specific recovery action without personalizing the SSR page. */
export function AccessDeniedActions({ locale }: { readonly locale: SupportedLocale }) {
    const { user, isResolved } = useAccountPermissions();
    const { t } = createTranslations(locale);
    const showSessionAction = Boolean(user) || isResolved;
    return (
        <>
            <p className={styles.description}>
                {t(
                    user
                        ? 'error.forbidden.description'
                        : isResolved
                          ? 'error.forbidden.guestDescription'
                          : 'error.forbidden.defaultDescription'
                )}
            </p>
            <div className={styles.actions}>
                {showSessionAction && (
                    <GradientButton
                        as="a"
                        href={buildUrl({ locale, path: user ? 'mi-cuenta' : 'auth/signin' })}
                        label={t(user ? 'error.forbidden.goToAccount' : 'auth.signIn.submit')}
                        variant="primary"
                        shape="rounded"
                    />
                )}
                <GradientButton
                    as="a"
                    href={buildUrl({ locale, path: '/' })}
                    label={t('error.forbidden.goHome')}
                    variant={showSessionAction ? 'outline-primary' : 'primary'}
                    shape="rounded"
                />
            </div>
        </>
    );
}
