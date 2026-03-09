/**
 * Password strength indicator UI components
 *
 * Sub-components for the change-password page that display
 * password strength and requirements checklist.
 */
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { CheckCircleIcon, XCircleIcon } from '@repo/icons';

import type { PasswordRule } from './password-validation';
import { STRENGTH_LEVELS } from './password-validation';

/**
 * Password strength indicator bar
 */
export function PasswordStrengthIndicator({
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
export function PasswordRequirements({
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
