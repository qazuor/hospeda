/**
 * TranslationStatus — inline translation status indicator (SPEC-212 T-014).
 *
 * Renders below translatable text fields in entity edit pages.
 * Shows per-locale status (auto/manual/pending/error) with Edit and
 * Translate Now actions.
 *
 * @module features/content/components/TranslationStatus
 */

import { Badge } from '@/components/ui-wrapped/Badge';
import { Button } from '@/components/ui-wrapped/Button';
import { useTranslations } from '@/hooks/use-translations';
import { useCallback, useState } from 'react';
import { TranslationOverrideModal } from './TranslationOverrideModal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranslationFieldState {
    fieldType: string;
    locales: Record<string, TranslationState>;
}

export interface TranslationState {
    value: string;
    autoTranslated: boolean;
    translatedAt?: string;
    error?: string;
}

export interface TranslationStatusProps {
    fields: TranslationFieldState[];
    onTranslateNow: (fieldType: string) => void;
    onOverrideSaved: (fieldType: string, locale: string, value: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranslationStatus({
    fields,
    onTranslateNow,
    onOverrideSaved
}: TranslationStatusProps) {
    const { t } = useTranslations();
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editingLocale, setEditingLocale] = useState<string | null>(null);

    const handleEdit = useCallback((fieldType: string, locale: string) => {
        setEditingField(fieldType);
        setEditingLocale(locale);
    }, []);

    const handleCloseModal = useCallback(() => {
        setEditingField(null);
        setEditingLocale(null);
    }, []);

    const handleSave = useCallback(
        (fieldType: string, locale: string, value: string) => {
            onOverrideSaved(fieldType, locale, value);
            handleCloseModal();
        },
        [onOverrideSaved, handleCloseModal]
    );

    if (fields.length === 0) return null;

    // Find the field being edited for the modal
    const fieldBeingEdited = editingField
        ? fields.find((f) => f.fieldType === editingField)
        : undefined;
    const localeBeingEdited = editingLocale;

    return (
        <div className="mt-4 space-y-3 border-border border-t pt-3">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    />
                </svg>
                <span>{t('admin-common.aiTranslate.status')}</span>
            </div>

            {fields.map((field) => (
                <div
                    key={field.fieldType}
                    className="space-y-1"
                >
                    <div className="font-medium text-muted-foreground text-xs">
                        {field.fieldType}
                    </div>
                    {Object.entries(field.locales).map(([locale, state]) => (
                        <div
                            key={locale}
                            className="flex items-center gap-2 text-sm"
                        >
                            <span className="w-6 font-mono text-muted-foreground text-xs">
                                {locale.toUpperCase()}
                            </span>
                            <span className="flex-1 truncate text-muted-foreground text-xs">
                                {state.value || '—'}
                            </span>
                            {state.error ? (
                                <>
                                    <Badge
                                        variant="destructive"
                                        size="sm"
                                    >
                                        {t('admin-common.aiTranslate.failed')}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onTranslateNow(field.fieldType)}
                                    >
                                        {t('admin-common.aiTranslate.retryButton')}
                                    </Button>
                                </>
                            ) : state.value ? (
                                <>
                                    <Badge
                                        variant={state.autoTranslated ? 'success' : 'outline'}
                                        size="sm"
                                    >
                                        {state.autoTranslated
                                            ? t('admin-common.aiTranslate.autoTranslated')
                                            : t('admin-common.aiTranslate.manualTranslated')}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEdit(field.fieldType, locale)}
                                    >
                                        {t('admin-common.aiTranslate.editButton')}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Badge
                                        variant="secondary"
                                        size="sm"
                                    >
                                        {t('admin-common.aiTranslate.pending')}
                                    </Badge>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onTranslateNow(field.fieldType)}
                                    >
                                        {t('admin-common.aiTranslate.translateNow')}
                                    </Button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            ))}

            {fieldBeingEdited && localeBeingEdited && (
                <TranslationOverrideModal
                    open={true}
                    onClose={handleCloseModal}
                    onSave={(value) =>
                        handleSave(fieldBeingEdited.fieldType, localeBeingEdited, value)
                    }
                    fieldType={fieldBeingEdited.fieldType}
                    locale={localeBeingEdited}
                    currentValue={fieldBeingEdited.locales[localeBeingEdited]?.value ?? ''}
                />
            )}
        </div>
    );
}
