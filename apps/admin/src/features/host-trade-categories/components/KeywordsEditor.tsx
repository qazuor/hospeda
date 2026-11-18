/**
 * @file KeywordsEditor.tsx
 * @description Per-locale tag input for a category's related words (HOS-919
 * T-044).
 *
 * One tag list per locale (es, en, pt). Words are normalised to lowercase on
 * add, and the limits (30 words per locale, 40 characters each) are enforced
 * by {@link addKeyword}, whose constants come from `@repo/schemas`. A rejected
 * word shows its reason next to the input and is not added.
 */

import {
    HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH,
    HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE
} from '@repo/schemas';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import type { CategoryKeywordsValue } from '../lib/catalog-form';
import { catalogKey } from '../lib/i18n-keys';
import { addKeyword, type KeywordRejection, removeKeyword } from '../lib/keywords';

const LOCALES = ['es', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];

/** Rejections worth telling the operator about (a blank word needs no message). */
const MESSAGE_PATH: Partial<Record<KeywordRejection, string>> = {
    tooLong: 'categories.keywords.tooLong',
    tooMany: 'categories.keywords.tooMany'
};

/** Props for {@link KeywordsEditor}. */
export interface KeywordsEditorProps {
    readonly value: CategoryKeywordsValue;
    readonly onChange: (next: CategoryKeywordsValue) => void;
    readonly disabled?: boolean;
}

/**
 * The related-words editor, one row per locale.
 *
 * @param props - {@link KeywordsEditorProps}
 */
export function KeywordsEditor({ value, onChange, disabled = false }: KeywordsEditorProps) {
    const { t } = useTranslations();
    const [drafts, setDrafts] = useState<Record<Locale, string>>({ es: '', en: '', pt: '' });
    const [rejections, setRejections] = useState<Partial<Record<Locale, KeywordRejection>>>({});

    const commit = (locale: Locale) => {
        const result = addKeyword({ keywords: value[locale], raw: drafts[locale] });
        setRejections((prev) => ({ ...prev, [locale]: result.rejection }));
        if (result.rejection) return;
        onChange({ ...value, [locale]: result.keywords });
        setDrafts((prev) => ({ ...prev, [locale]: '' }));
    };

    return (
        <fieldset className="space-y-3">
            <legend className="font-medium text-sm">
                {t(catalogKey({ path: 'categories.keywords.label' }))}
            </legend>
            <p className="text-muted-foreground text-xs">
                {t(catalogKey({ path: 'categories.keywords.hint' }), {
                    maxCount: HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE,
                    maxLength: HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH
                })}
            </p>

            {LOCALES.map((locale) => {
                const rejection = rejections[locale];
                const messagePath = rejection ? MESSAGE_PATH[rejection] : undefined;
                return (
                    <div
                        key={locale}
                        className="space-y-1.5"
                    >
                        <div className="flex items-center justify-between">
                            <span className="inline-flex h-4 w-7 items-center justify-center rounded-sm bg-muted px-1 font-mono text-[10px] uppercase tracking-wider">
                                {locale}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {t(catalogKey({ path: 'categories.keywords.count' }), {
                                    count: value[locale].length,
                                    max: HOST_TRADE_CATEGORY_MAX_KEYWORDS_PER_LOCALE
                                })}
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                            {value[locale].map((keyword) => (
                                <span
                                    key={keyword}
                                    data-testid={`keyword-${locale}-${keyword}`}
                                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                                >
                                    {keyword}
                                    <button
                                        type="button"
                                        data-testid={`keyword-remove-${locale}-${keyword}`}
                                        aria-label={t(
                                            catalogKey({ path: 'categories.keywords.remove' }),
                                            { keyword }
                                        )}
                                        disabled={disabled}
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                            onChange({
                                                ...value,
                                                [locale]: removeKeyword({
                                                    keywords: value[locale],
                                                    keyword
                                                })
                                            })
                                        }
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <Input
                                data-testid={`keywords-${locale}-input`}
                                value={drafts[locale]}
                                disabled={disabled}
                                placeholder={t(
                                    catalogKey({ path: 'categories.keywords.placeholder' })
                                )}
                                onChange={(event) =>
                                    setDrafts((prev) => ({ ...prev, [locale]: event.target.value }))
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        commit(locale);
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                disabled={disabled}
                                data-testid={`keywords-${locale}-add`}
                                onClick={() => commit(locale)}
                            >
                                {t(catalogKey({ path: 'categories.keywords.add' }))}
                            </Button>
                        </div>

                        {messagePath ? (
                            <p
                                className="text-destructive text-xs"
                                role="alert"
                                data-testid={`keywords-${locale}-error`}
                            >
                                {t(catalogKey({ path: messagePath }), {
                                    max: HOST_TRADE_CATEGORY_MAX_KEYWORD_LENGTH
                                })}
                            </p>
                        ) : null}
                    </div>
                );
            })}
        </fieldset>
    );
}
