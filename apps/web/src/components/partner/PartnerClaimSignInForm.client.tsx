import { useState } from 'react';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { signIn } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PartnerClaim.module.css';

/** Props for the fixed-email Partner claim sign-in form. */
export interface PartnerClaimSignInFormProps {
    readonly email: string;
    readonly locale: SupportedLocale;
    readonly onSuccess: () => void;
    readonly onOtherMethods: () => void;
}

/** Signs in the existing mailbox account without leaving the claim island. */
export function PartnerClaimSignInForm({
    email,
    locale,
    onSuccess,
    onOtherMethods
}: PartnerClaimSignInFormProps) {
    const { t } = createTranslations(locale);
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const passwordI18n: PasswordFieldI18n = {
        showPassword: t('auth.signUp.showPassword', 'Mostrar contraseña'),
        hidePassword: t('auth.signUp.hidePassword', 'Ocultar contraseña'),
        strength: { weak: '', medium: '', strong: '' }
    };

    async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const result = await signIn.email({ email, password });
            if (result.error) setError(t('partners.claim.signInError'));
            else onSuccess();
        } catch {
            setError(t('partners.claim.signInError'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form
            className={styles.form}
            onSubmit={submit}
            noValidate
        >
            <label className={styles.field}>
                <span>{t('partners.claim.emailLabel')}</span>
                <input
                    className={styles.input}
                    type="email"
                    value={email}
                    readOnly
                />
            </label>
            <PasswordField
                id="partner-claim-signin-password"
                name="password"
                label={t('partners.claim.passwordLabel')}
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                required
                i18n={passwordI18n}
            />
            {error && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {error}
                </p>
            )}
            <button
                className={styles.button}
                type="submit"
                disabled={busy}
            >
                {t('partners.claim.signInWithPasswordCta')}
            </button>
            <button
                className={styles.textButton}
                type="button"
                onClick={onOtherMethods}
            >
                {t('partners.claim.otherSignInMethods')}
            </button>
        </form>
    );
}
