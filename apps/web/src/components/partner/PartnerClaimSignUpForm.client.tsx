import { StrongPasswordSchema } from '@repo/schemas';
import { useState } from 'react';
import { PasswordField, type PasswordFieldI18n } from '@/components/ui/PasswordField.client';
import { partnerClaimsPublicApi } from '@/lib/api/endpoints';
import { refreshBetterAuthSession, signIn } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './PartnerClaim.module.css';

/** Props for token-bound Partner account creation. */
export interface PartnerClaimSignUpFormProps {
    readonly partnerId: string;
    readonly secret: string;
    readonly email: string;
    readonly locale: SupportedLocale;
    readonly onSuccess: (signedIn: boolean) => void;
    readonly onAccountExists: () => void;
}

/** Creates the token mailbox account and signs into it in the current tab. */
export function PartnerClaimSignUpForm({
    partnerId,
    secret,
    email,
    locale,
    onSuccess,
    onAccountExists
}: PartnerClaimSignUpFormProps) {
    const { t } = createTranslations(locale);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const passwordI18n: PasswordFieldI18n = {
        showPassword: t('auth.signUp.showPassword', 'Mostrar contraseña'),
        hidePassword: t('auth.signUp.hidePassword', 'Ocultar contraseña'),
        strength: {
            weak: t('auth.signUp.strength.weak', 'Débil'),
            medium: t('auth.signUp.strength.medium', 'Media'),
            strong: t('auth.signUp.strength.strong', 'Fuerte')
        },
        rules: {
            length: t('auth.signUp.rules.length', 'Al menos 8 caracteres'),
            upper: t('auth.signUp.rules.upper', 'Una letra mayúscula (A-Z)'),
            lower: t('auth.signUp.rules.lower', 'Una letra minúscula (a-z)'),
            digit: t('auth.signUp.rules.digit', 'Un número (0-9)'),
            special: t('auth.signUp.rules.special', 'Un carácter especial')
        }
    };

    async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setError(null);
        if (!StrongPasswordSchema.safeParse(password).success) {
            setError(
                t('auth.signUp.errors.passwordWeak', 'La contraseña no cumple los requisitos.')
            );
            return;
        }
        if (password !== confirmation) {
            setError(t('auth.signUp.errors.passwordsDoNotMatch', 'Las contraseñas no coinciden.'));
            return;
        }
        setBusy(true);
        try {
            const result = await partnerClaimsPublicApi.signUp({ partnerId, secret, password });
            if (!result.ok) {
                if (
                    result.error.status === 409 &&
                    result.error.reason === 'PARTNER_CLAIM_ACCOUNT_EXISTS'
                ) {
                    onAccountExists();
                    return;
                }
                setError(result.error.message ?? t('partners.claim.genericError'));
                return;
            }
            try {
                const signedIn = await signIn.email({ email, password });
                if (signedIn.error) {
                    onSuccess(false);
                    return;
                }
                await refreshBetterAuthSession();
                onSuccess(true);
            } catch {
                onSuccess(false);
            }
        } catch {
            setError(t('partners.claim.genericError'));
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
                id="partner-claim-password"
                name="password"
                label={t('partners.claim.passwordLabel')}
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                showStrength
                showRuleChecklist
                i18n={passwordI18n}
            />
            <PasswordField
                id="partner-claim-confirm-password"
                name="confirmPassword"
                label={t('partners.claim.confirmPasswordLabel')}
                value={confirmation}
                onChange={setConfirmation}
                autoComplete="new-password"
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
                {t('partners.claim.signUpCta')}
            </button>
        </form>
    );
}
