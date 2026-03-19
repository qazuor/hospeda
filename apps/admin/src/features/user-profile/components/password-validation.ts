/**
 * Password validation utilities
 *
 * Shared constants, types, and helpers for password strength validation
 * used by the change-password page.
 */
import type { TranslationKey } from '@repo/i18n';

/** Password validation rules */
export const PASSWORD_RULES = {
    minLength: 8,
    hasUppercase: /[A-Z]/,
    hasLowercase: /[a-z]/,
    hasNumber: /[0-9]/,
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/
} as const;

/** Individual rule check result */
export interface PasswordRule {
    readonly key: string;
    readonly labelKey: TranslationKey;
    readonly passed: boolean;
}

/** Strength levels */
export const STRENGTH_LEVELS = [
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
 * Checks all password rules against a given password
 */
export function checkPasswordRules({
    password
}: {
    readonly password: string;
}): readonly PasswordRule[] {
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

/**
 * Maps known API error messages to translation keys.
 * Uses substring matching to handle variations in API error messages.
 */
export function mapApiErrorToTranslationKey({
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
