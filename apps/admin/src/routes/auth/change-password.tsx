/**
 * Forced Change Password Page Route (standalone, outside admin layout)
 *
 * This route is used when a user has passwordChangeRequired=true.
 * It renders outside the _authed layout (no sidebar, no header) to prevent
 * access to the admin panel until the password is changed.
 *
 * Features:
 * - Password strength validation (8+ chars, upper, lower, number, special)
 * - Real-time strength indicator
 * - Specific API error messages (wrong current password, etc.)
 *
 * After successful password change, redirects to dashboard.
 */

import { useTranslations } from '@/hooks/use-translations';
import { fetchAuthSession } from '@/lib/auth-session';
import type { TranslationKey } from '@repo/i18n';
import { AlertTriangleIcon, CheckCircleIcon, ShieldIcon, XCircleIcon } from '@repo/icons';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type AuthBackgroundImage, getRandomAuthImage } from '../../utils/auth-images';

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

/** Strength levels mapped to translation keys and colors */
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

export const Route = createFileRoute('/auth/change-password')({
    beforeLoad: async () => {
        const authState = await fetchAuthSession();

        // Must be authenticated to access this page
        if (!authState.isAuthenticated) {
            throw redirect({ to: '/auth/signin' });
        }

        // If password change is not required, go to dashboard
        if (!authState.passwordChangeRequired) {
            throw redirect({ to: '/' });
        }

        return authState;
    },
    component: ForcedChangePasswordPage
});

/**
 * Password strength indicator bar and label
 */
function PasswordStrengthIndicator({
    rules
}: {
    readonly rules: readonly PasswordRule[];
}) {
    const { t } = useTranslations();
    const passedCount = rules.filter((r) => r.passed).length;

    // Map 0-5 passed rules to strength index 0-4
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

function ForcedChangePasswordPage() {
    const { t } = useTranslations();
    const [isClient, setIsClient] = useState(false);
    const [backgroundImage, setBackgroundImage] = useState<AuthBackgroundImage | null>(null);

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setIsClient(true);
        setBackgroundImage(getRandomAuthImage());
    }, []);

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
            // Find the first failing rule for the error message
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
                const apiUrl = import.meta.env.VITE_API_URL;

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

                // Hard redirect to dashboard to force full session re-evaluation
                if (typeof window !== 'undefined') {
                    window.location.href = '/dashboard';
                }
            } catch {
                setFormError(t('admin-pages.me.changePassword.error.generic' as TranslationKey));
            } finally {
                setIsSubmitting(false);
            }
        },
        [currentPassword, newPassword, validate, t]
    );

    if (!isClient) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100 dark:from-cyan-950 dark:via-emerald-950 dark:to-blue-950">
                <div className="flex min-h-screen">
                    <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                        <div className="h-full w-full animate-pulse bg-gradient-to-br from-cyan-200 to-emerald-200" />
                    </div>
                    <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
                        <div className="w-full max-w-md">
                            <div className="rounded-xl border bg-card p-8 shadow-lg">
                                <div className="animate-pulse space-y-4">
                                    <div className="h-10 rounded-md bg-muted" />
                                    <div className="h-10 rounded-md bg-muted" />
                                    <div className="h-10 rounded-md bg-muted" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-emerald-50 to-blue-100 dark:from-cyan-950 dark:via-emerald-950 dark:to-blue-950">
            <div className="flex min-h-screen">
                {/* Left side - Image */}
                <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
                    <div className="absolute inset-0 bg-gradient-to-t from-cyan-900/50 to-emerald-600/30" />
                    {backgroundImage && (
                        <img
                            src={backgroundImage.src}
                            alt={backgroundImage.alt}
                            className="h-full w-full object-cover"
                        />
                    )}
                    <div className="absolute bottom-8 left-8 text-white">
                        <h2 className="mb-2 font-bold text-3xl">
                            {t('admin-pages.me.changePassword.forced.title' as TranslationKey)}
                        </h2>
                        <p className="text-cyan-100 dark:text-cyan-300">
                            {t(
                                'admin-pages.me.changePassword.forced.description' as TranslationKey
                            )}
                        </p>
                        {backgroundImage && (
                            <p className="mt-1 text-cyan-200 text-sm opacity-80 dark:text-cyan-400">
                                {backgroundImage.location}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right side - Form */}
                <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
                    <div className="w-full max-w-md space-y-6">
                        <div className="text-center">
                            <div className="mb-6 flex justify-center">
                                <img
                                    src="/logo.webp"
                                    alt="Logo"
                                    className="h-16 w-auto"
                                />
                            </div>
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
                                <ShieldIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                            </div>
                            <h1 className="font-bold text-2xl text-foreground">
                                {t('admin-pages.me.changePassword.title' as TranslationKey)}
                            </h1>
                            <p className="mt-2 text-muted-foreground">
                                {t(
                                    'admin-pages.me.changePassword.forced.description' as TranslationKey
                                )}
                            </p>
                        </div>

                        {/* Warning banner */}
                        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                            <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                            <div>
                                <p className="font-semibold text-amber-900 text-sm dark:text-amber-100">
                                    {t(
                                        'admin-pages.me.changePassword.forced.title' as TranslationKey
                                    )}
                                </p>
                                <p className="mt-1 text-amber-800 text-xs dark:text-amber-200">
                                    {t(
                                        'admin-pages.me.changePassword.forced.description' as TranslationKey
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-xl border bg-card p-8 shadow-lg">
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
                                <div>
                                    <label
                                        htmlFor="currentPassword"
                                        className="block font-medium text-foreground text-sm"
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
                                        className={`mt-1 block w-full rounded-md border bg-background px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                                            fieldErrors.currentPassword
                                                ? 'border-destructive focus:border-destructive focus:ring-destructive'
                                                : 'border-border focus:border-primary focus:ring-primary'
                                        }`}
                                    />
                                    {fieldErrors.currentPassword && (
                                        <p className="mt-1 text-destructive text-xs">
                                            {fieldErrors.currentPassword}
                                        </p>
                                    )}
                                </div>

                                {/* New Password */}
                                <div>
                                    <label
                                        htmlFor="newPassword"
                                        className="block font-medium text-foreground text-sm"
                                    >
                                        {t(
                                            'admin-pages.me.changePassword.newPassword' as TranslationKey
                                        )}
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
                                        className={`mt-1 block w-full rounded-md border bg-background px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                                            fieldErrors.newPassword
                                                ? 'border-destructive focus:border-destructive focus:ring-destructive'
                                                : 'border-border focus:border-primary focus:ring-primary'
                                        }`}
                                    />
                                    {fieldErrors.newPassword && (
                                        <p className="mt-1 text-destructive text-xs">
                                            {fieldErrors.newPassword}
                                        </p>
                                    )}

                                    {/* Strength indicator (visible when typing) + requirements (always visible) */}
                                    <div className="mt-3 space-y-3">
                                        {newPassword.length > 0 && (
                                            <PasswordStrengthIndicator rules={passwordRules} />
                                        )}
                                        <PasswordRequirements rules={passwordRules} />
                                    </div>
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label
                                        htmlFor="confirmPassword"
                                        className="block font-medium text-foreground text-sm"
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
                                        className={`mt-1 block w-full rounded-md border bg-background px-3 py-2 shadow-sm focus:outline-none focus:ring-1 ${
                                            fieldErrors.confirmPassword
                                                ? 'border-destructive focus:border-destructive focus:ring-destructive'
                                                : 'border-border focus:border-primary focus:ring-primary'
                                        }`}
                                    />
                                    {fieldErrors.confirmPassword && (
                                        <p className="mt-1 text-destructive text-xs">
                                            {fieldErrors.confirmPassword}
                                        </p>
                                    )}
                                    {/* Real-time match indicator */}
                                    {confirmPassword.length > 0 &&
                                        newPassword.length > 0 &&
                                        !fieldErrors.confirmPassword && (
                                            <p
                                                className={`mt-1 flex items-center gap-1 text-xs ${
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
                                        : t(
                                              'admin-pages.me.changePassword.submit' as TranslationKey
                                          )}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
