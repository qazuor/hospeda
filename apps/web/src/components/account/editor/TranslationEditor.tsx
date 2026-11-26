/** Shared translation surface and row presentation for read-only and editable consumers. */
import type { ReactNode } from 'react';
import { Alert, Section, Tabs } from '@/components/account/ui';
import { sectionHelpId } from '@/lib/help/section-help-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './TranslationEditor.module.css';

/** One locale's count and consumer-owned field content. */
export interface TranslationEditorTab {
    readonly locale: SupportedLocale;
    readonly count: number;
    readonly countLabel: string;
    readonly content: ReactNode;
}

/** Consumer-supplied translation state; no persistence lives here. */
export interface TranslationEditorProps {
    readonly locale: SupportedLocale;
    readonly vertical: 'accommodation' | 'venue' | 'experience';
    readonly description: string;
    readonly tabs: readonly TranslationEditorTab[];
    readonly defaultLocale: SupportedLocale;
    readonly ariaLabel: string;
    readonly missingNotice?: string;
    readonly isBusy?: boolean;
    readonly children?: ReactNode;
}

/** One kit section, language tabs, explicit missing-field counts and source-tab hint. */
export function TranslationEditor({
    locale,
    vertical,
    description,
    tabs,
    defaultLocale,
    ariaLabel,
    missingNotice,
    isBusy = false,
    children
}: TranslationEditorProps) {
    const t = createT(locale);
    const missing = tabs
        .filter((tab) => tab.locale !== 'es' && tab.count > 0)
        .map((tab) => `${tab.locale.toUpperCase()}: ${tab.count}`)
        .join(', ');
    return (
        <Section
            title={t('account.editorPresentation.translationTitle')}
            description={description}
            helpId={sectionHelpId({ vertical, slug: 'traducciones' })}
        >
            <div className={styles.stack}>
                {missingNotice && (
                    <Alert
                        tone="info"
                        locale={locale}
                    >
                        {missingNotice}
                    </Alert>
                )}
                <div
                    aria-live="polite"
                    aria-busy={isBusy}
                >
                    <Tabs
                        ariaLabel={ariaLabel}
                        defaultValue={defaultLocale}
                        items={tabs.map((tab) => ({
                            id: tab.locale,
                            label: tab.locale.toUpperCase(),
                            ...(tab.count > 0
                                ? { count: tab.count, countLabel: tab.countLabel }
                                : {}),
                            panel: (
                                <>
                                    {tab.locale === 'es' && missing && !missingNotice && (
                                        <p>
                                            {t(
                                                'account.editorPresentation.missingHint',
                                                undefined,
                                                { locales: missing }
                                            )}
                                        </p>
                                    )}
                                    <ul className={styles.fields}>{tab.content}</ul>
                                </>
                            )
                        }))}
                    />
                </div>
                {children}
            </div>
        </Section>
    );
}

/** Uniform row chrome; content and badges retain consumer-specific meaning. */
export function TranslationEditorRow({
    locale,
    role,
    heading,
    children
}: {
    readonly locale: SupportedLocale;
    readonly role?: string;
    readonly heading: ReactNode;
    readonly children: ReactNode;
}) {
    return (
        <li
            className={styles.row}
            data-translation-row=""
            data-locale={locale}
            data-role={role}
        >
            <div
                className={styles.heading}
                data-translation-heading=""
            >
                {heading}
            </div>
            {children}
        </li>
    );
}
