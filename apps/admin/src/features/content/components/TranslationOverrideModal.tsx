/**
 * TranslationOverrideModal — manual translation editor (SPEC-212 T-015).
 *
 * Dialog that lets an admin manually edit a specific locale translation
 * for a content field. Shows the original Spanish value as reference.
 *
 * @module features/content/components/TranslationOverrideModal
 */

import { useCallback, useState } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Button } from '@/components/ui-wrapped/Button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TranslationOverrideModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (value: string) => void;
    fieldType: string;
    locale: string;
    currentValue: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranslationOverrideModal({
    open,
    onClose,
    onSave,
    fieldType,
    locale,
    currentValue
}: TranslationOverrideModalProps) {
    const { t } = useTranslations();
    const [value, setValue] = useState(currentValue);

    const handleSave = useCallback(() => {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
            onSave(trimmed);
        }
    }, [value, onSave]);

    const handleClose = useCallback(() => {
        setValue(currentValue);
        onClose();
    }, [currentValue, onClose]);

    const localeLabel = locale === 'en' ? 'English' : 'Português';
    const fieldLabels: Record<string, string> = {
        name: t('admin-common.aiTranslate.field.name'),
        summary: t('admin-common.aiTranslate.field.summary'),
        description: t('admin-common.aiTranslate.field.description'),
        richDescription: t('admin-common.aiTranslate.field.richDescription'),
        title: t('admin-common.aiTranslate.field.title'),
        content: t('admin-common.aiTranslate.field.content')
    };
    const fieldLabel = fieldLabels[fieldType] || fieldType;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('admin-common.aiTranslate.overrideTitle')}</DialogTitle>
                    <DialogDescription>
                        {fieldLabel} — {localeLabel}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                        </svg>
                        <span>{locale === 'en' ? 'English translation' : 'Tradução em português'}</span>
                    </div>

                    <textarea
                        className="w-full min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={t('admin-common.aiTranslate.overrideTitle')}
                        rows={6}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>
                        {t('admin-common.aiTranslate.overrideCancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={value.trim().length === 0}>
                        {t('admin-common.aiTranslate.overrideSave')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
