/**
 * Change Password Page Route (within admin layout)
 *
 * Voluntary password change from user settings.
 * Uses the same validation rules as the forced change page.
 *
 * Features:
 * - Password strength validation (8+ chars, upper, lower, number, special)
 * - Real-time strength indicator
 * - Specific API error messages
 */

import { MainPageLayout } from '@/components/layout/MainPageLayout';
import { useFlashyToast } from '@/hooks/use-flashy-toast';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { AlertTriangleIcon, CheckCircleIcon, ShieldIcon, XCircleIcon } from '@repo/icons';
import { createFileRoute, useNavigate, useRouteContext } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';

/** Password validation rules */
const PASSWORD_RULES = {
    minLength: 8,
    hasUppercase: /[A-Z]/,
    hasLowercase: /[a-z]/,
    hasNumber: /[0-9]/,
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/
} as const;

/** Individual rule check result */
interface PasswordRule {
    readonly key: string;
    readonly labelKey: TranslationKey;
    readonly passed: boolean;
}

/**
 * Checks all password rules against a given password
 */
function checkPasswordRules({ password }: { readonly password: string }): readonly PasswordRule[] {
    return [
        {
            key: 'minLength',
            labelKey: 'admin-pages.me.changePassword.requirements.minLength' as TranslationKey,
            passed: password.length >= PASSWORD_RULES.minLength
        },
        {
            key: 'uppercase',
            labelKey: 'admin-pages.me.changePassword.requirements.uppercase' as TranslationKey,
            passed: PASSWORD_RULES.hasUppercase.test(password)
        },
        {
            key: 'lowercase',
            labelKey: 'admin-pages.me.changePassword.requirements.lowercase' as TranslationKey,
            passed: PASSWORD_RULES.hasLowercase.test(password)
        },
        {
            key: 'number',
            labelKey: 'admin-pages.me.changePassword.requirements.number' as TranslationKey,
            passed: PASSWORD_RULES.hasNumber.test(password)
        },
        {
            key: 'special',
            labelKey: 'admin-pages.me.changePassword.requirements.special' as TranslationKey,
            passed: PASSWORD_RULES.hasSpecial.test(password)
        }
    ];
}

/** Strength levels */
const STRENGTH_LEVELS = [
    {
        labelKey: 'admin-pages.me.changePassword.strength.veryWeak' as TranslationKey,
        color: 'bg-red-500',
        textColor: 'text-red-600 dark:text-red-400'
    },
    {
        labelKey: 'admin-pages.me.changePassword.strength.weak' as TranslationKey,
        color: 'bg-orange-500',
        textColor: 'text-orange-600 dark:text-orange-400'
    },
    {
        labelKey: 'admin-pages.me.changePassword.strength.fair' as TranslationKey,
        color: 'bg-yellow-500',
        textColor: 'text-yellow-600 dark:text-yellow-400'
    },
    {
        labelKey: 'admin-pages.me.changePassword.strength.strong' as TranslationKey,
        color: 'bg-emerald-500',
        textColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
        labelKey: 'admin-pages.me.changePassword.strength.veryStrong' as TranslationKey,
        color: 'bg-green-600',
        textColor: 'text-green-600 dark:text-green-400'
    }
] as const;

/**
 * Maps known API error messages to translation keys.
 * Uses substring matching to handle variations in API error messages.
 */
function mapApiErrorToTranslationKey({
    message
}: {
    readonly message: string;
}): { readonly key: TranslationKey; readonly field: string | null } | null {
    const normalized = message.toLowerCase();

    if (normalized.includes('current password') || normalized.includes('incorrect')) {
        return {
            key: 'admin-pages.me.changePassword.error.wrongCurrent' as TranslationKey,
            field: 'currentPassword'
        };
    }

    if (normalized.includes('no credential') || normalized.includes('account found')) {
        return {
            key: 'admin-pages.me.changePassword.error.generic' as TranslationKey,
            field: null
        };
    }

    if (normalized.includes('at least 8') || normalized.includes('too short')) {
        return {
            key: 'admin-pages.me.changePassword.error.tooShort' as TranslationKey,
            field: 'newPassword'
        };
    }

    return null;
}

export const Route = createFileRoute('/_authed/me/change-password')({
    component: ChangePasswordPage
});

/**
 * Password strength indicator bar
 */
function PasswordStrengthIndicator({
    rules
}: {
    readonly rules: readonly PasswordRule[];
}) {
    const { t } = useTranslations();
    const passedCount = rules.filter((r) => r.passed).length;
    const strengthIndex = passedCount === 0 ? 0 : Math.min(passedCount - 1, 4);
    const level = STRENGTH_LEVELS[strengthIndex];

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                    {t('admin-pages.me.changePassword.strength.label' as TranslationKey)}
                </span>
                <span className={`font-medium text-xs ${level.textColor}`}>
                    {t(level.labelKey)}
                </span>
            </div>
            <div className="flex gap-1">
                {STRENGTH_LEVELS.map((lvl, i) => (
                    <div
                        key={lvl.labelKey}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= strengthIndex ? level.color : 'bg-muted'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * Password requirements checklist
 */
function PasswordRequirements({
    rules
}: {
    readonly rules: readonly PasswordRule[];
}) {
    const { t } = useTranslations();

    return (
        <div className="space-y-1.5">
            <p className="font-medium text-muted-foreground text-xs">
                {t('admin-pages.me.changePassword.requirements.title' as TranslationKey)}
            </p>
            <ul className="space-y-1">
                {rules.map((rule) => (
                    <li
                        key={rule.key}
                        className={`flex items-center gap-1.5 text-xs transition-colors ${
                            rule.passed
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-muted-foreground'
                        }`}
                    >
                        {rule.passed ? (
                            <CheckCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        ) : (
                            <XCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                        )}
                        {t(rule.labelKey)}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function ChangePasswordPage() {
    const { t } = useTranslations();
    const navigate = useNavigate();
    const authState = useRouteContext({ from: '/_authed' });
    const isForced = authState?.passwordChangeRequired ?? false;

    const { success: toastSuccess } = useFlashyToast();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const passwordRules = useMemo(
        () => checkPasswordRules({ password: newPassword }),
        [newPassword]
    );

    const allRulesPassed = useMemo(() => passwordRules.every((r) => r.passed), [passwordRules]);

    const validate = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        if (!currentPassword) {
            newErrors.currentPassword = t(
                'admin-pages.me.changePassword.error.wrongCurrent' as TranslationKey
            );
        }

        if (!allRulesPassed) {
            const firstFailing = passwordRules.find((r) => !r.passed);
            if (firstFailing) {
                newErrors.newPassword = t(firstFailing.labelKey);
            }
        }

        if (newPassword !== confirmPassword) {
            newErrors.confirmPassword = t(
                'admin-pages.me.changePassword.error.mismatch' as TranslationKey
            );
        }

        setFieldErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [currentPassword, newPassword, confirmPassword, allRulesPassed, passwordRules, t]);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setFormError(null);

            if (!validate()) return;

            setIsSubmitting(true);
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

                const response = await fetch(`${apiUrl}/api/v1/protected/auth/change-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ currentPassword, newPassword })
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => null);
                    // Extract error message from various API response formats
                    const apiMessage = data?.error?.message || data?.message || data?.error || '';

                    // Try to map the API error to a specific translated message
                    const mapped = mapApiErrorToTranslationKey({
                        message: typeof apiMessage === 'string' ? apiMessage : ''
                    });

                    if (mapped) {
                        if (mapped.field) {
                            // Show error on the specific field
                            setFieldErrors((prev) => ({
                                ...prev,
                                [mapped.field as string]: t(mapped.key)
                            }));
                        } else {
                            setFormError(t(mapped.key));
                        }
                    } else {
                        // Show the raw API message if available, otherwise generic
                        const displayMessage =
                            typeof apiMessage === 'string' && apiMessage.length > 0
                                ? apiMessage
                                : t(
                                      'admin-pages.me.changePassword.error.generic' as TranslationKey
                                  );
                        setFormError(displayMessage);
                    }
                    return;
                }

                toastSuccess(t('admin-pages.me.changePassword.success' as TranslationKey));
                navigate({ to: '/' });
            } catch {
                setFormError(t('admin-pages.me.changePassword.error.generic' as TranslationKey));
            } finally {
                setIsSubmitting(false);
            }
        },
        [currentPassword, newPassword, validate, toastSuccess, navigate, t]
    );

    return (
        <MainPageLayout title={t('admin-pages.me.changePassword.title' as TranslationKey)}>
            <div className="mx-auto max-w-lg space-y-6">
                {isForced && (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                            <p className="font-semibold text-amber-900 text-sm dark:text-amber-100">
                                {t('admin-pages.me.changePassword.forced.title' as TranslationKey)}
                            </p>
                            <p className="mt-1 text-amber-800 text-xs dark:text-amber-200">
                                {t(
                                    'admin-pages.me.changePassword.forced.description' as TranslationKey
                                )}
                            </p>
                        </div>
                    </div>
                )}

                <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <ShieldIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">
                                {t('admin-pages.me.changePassword.title' as TranslationKey)}
                            </h2>
                            <p className="text-muted-foreground text-sm">
                                {isForced
                                    ? t(
                                          'admin-pages.me.changePassword.forced.description' as TranslationKey
                                      )
                                    : t('admin-pages.me.changePassword.title' as TranslationKey)}
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        {formError && (
                            <div className="rounded-md bg-destructive/5 p-3 text-destructive text-sm">
                                {formError}
                            </div>
                        )}

                        {/* Current Password */}
                        <div className="space-y-2">
                            <label
                                htmlFor="currentPassword"
                                className="block font-medium text-sm"
                            >
                                {t(
                                    'admin-pages.me.changePassword.currentPassword' as TranslationKey
                                )}
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => {
                                    setCurrentPassword(e.target.value);
                                    setFieldErrors((prev) => {
                                        const { currentPassword: _, ...next } = prev;
                                        return next;
                                    });
                                }}
                                disabled={isSubmitting}
                                autoComplete="current-password"
                                className={`block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                                    fieldErrors.currentPassword
                                        ? 'border-destructive focus:border-destructive focus:ring-destructive'
                                        : 'border-border focus:border-primary focus:ring-primary'
                                }`}
                            />
                            {fieldErrors.currentPassword && (
                                <p className="text-destructive text-xs">
                                    {fieldErrors.currentPassword}
                                </p>
                            )}
                        </div>

                        {/* New Password */}
                        <div className="space-y-2">
                            <label
                                htmlFor="newPassword"
                                className="block font-medium text-sm"
                            >
                                {t('admin-pages.me.changePassword.newPassword' as TranslationKey)}
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    setFieldErrors((prev) => {
                                        const { newPassword: _, ...next } = prev;
                                        return next;
                                    });
                                }}
                                disabled={isSubmitting}
                                autoComplete="new-password"
                                className={`block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                                    fieldErrors.newPassword
                                        ? 'border-destructive focus:border-destructive focus:ring-destructive'
                                        : 'border-border focus:border-primary focus:ring-primary'
                                }`}
                            />
                            {fieldErrors.newPassword && (
                                <p className="text-destructive text-xs">
                                    {fieldErrors.newPassword}
                                </p>
                            )}

                            <div className="space-y-3">
                                {newPassword.length > 0 && (
                                    <PasswordStrengthIndicator rules={passwordRules} />
                                )}
                                <PasswordRequirements rules={passwordRules} />
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div className="space-y-2">
                            <label
                                htmlFor="confirmPassword"
                                className="block font-medium text-sm"
                            >
                                {t(
                                    'admin-pages.me.changePassword.confirmPassword' as TranslationKey
                                )}
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setFieldErrors((prev) => {
                                        const { confirmPassword: _, ...next } = prev;
                                        return next;
                                    });
                                }}
                                disabled={isSubmitting}
                                autoComplete="new-password"
                                className={`block w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
                                    fieldErrors.confirmPassword
                                        ? 'border-destructive focus:border-destructive focus:ring-destructive'
                                        : 'border-border focus:border-primary focus:ring-primary'
                                }`}
                            />
                            {fieldErrors.confirmPassword && (
                                <p className="text-destructive text-xs">
                                    {fieldErrors.confirmPassword}
                                </p>
                            )}
                            {confirmPassword.length > 0 &&
                                newPassword.length > 0 &&
                                !fieldErrors.confirmPassword && (
                                    <p
                                        className={`flex items-center gap-1 text-xs ${
                                            newPassword === confirmPassword
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-destructive'
                                        }`}
                                    >
                                        {newPassword === confirmPassword ? (
                                            <>
                                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                                {t(
                                                    'admin-pages.me.changePassword.confirmPassword' as TranslationKey
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <XCircleIcon className="h-3.5 w-3.5" />
                                                {t(
                                                    'admin-pages.me.changePassword.error.mismatch' as TranslationKey
                                                )}
                                            </>
                                        )}
                                    </p>
                                )}
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !allRulesPassed}
                            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isSubmitting
                                ? '...'
                                : t('admin-pages.me.changePassword.submit' as TranslationKey)}
                        </button>
                    </form>
                </div>
            </div>
        </MainPageLayout>
    );
}
