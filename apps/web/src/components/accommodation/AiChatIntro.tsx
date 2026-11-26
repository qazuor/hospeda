import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AiChatSuggestions } from './AiChatSuggestions';
import styles from './AiChatWidget.module.css';

/** Legal disclosure, catalog allowance and optional conversation starters. */
export function AiChatIntro({
    copy,
    locale,
    allowance,
    onSuggestion
}: {
    readonly copy: (suffix: string) => string;
    readonly locale: SupportedLocale;
    readonly allowance?: number;
    readonly onSuggestion?: (question: string) => void;
}) {
    const { t, tPlural } = createTranslations(locale);
    return (
        <>
            <details className={styles.disclaimer}>
                <summary>{t('accommodations.aiChat.noticeLabel')}</summary>
                <p>
                    {copy('headerDisclaimer')} {copy('readNotice')}
                </p>
            </details>
            {allowance !== undefined && (
                <p>{tPlural('accommodations.aiChat.monthlyAllowance', allowance)}</p>
            )}
            {onSuggestion && (
                <>
                    <p>{t('accommodations.aiChat.greeting')}</p>
                    <AiChatSuggestions
                        copy={copy}
                        action={{ select: onSuggestion }}
                    />
                </>
            )}
        </>
    );
}
