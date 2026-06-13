/**
 * TranslationSection — connects TranslationStatus to real entity data (SPEC-212 T-016).
 *
 * Reads i18n field values and metadata from an entity object, then
 * renders TranslationStatus with the appropriate state per field+locale.
 * Calls the translate API and override API on user actions.
 *
 * @module features/content/components/TranslationSection
 */

import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { useCallback, useMemo } from 'react';
import { type TranslationFieldState, TranslationStatus } from './TranslationStatus';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TranslationSectionProps {
    entityType: 'accommodation' | 'destination' | 'event' | 'post';
    entityId: string;
    entity: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Field config per entity type
// ---------------------------------------------------------------------------

const TRANSLATABLE_FIELDS: Record<string, string[]> = {
    accommodation: ['name', 'summary', 'description', 'richDescription'],
    destination: ['name', 'summary', 'description'],
    event: ['name', 'summary', 'description'],
    post: ['title', 'summary', 'content']
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranslationSection({ entityType, entityId, entity }: TranslationSectionProps) {
    const { t } = useTranslations();
    const { addToast } = useToast();

    // Derive translation states from entity data
    const fieldStates = useMemo(() => {
        const fields = TRANSLATABLE_FIELDS[entityType] ?? [];
        const meta =
            (entity.translationMeta as Record<
                string,
                Record<string, { autoTranslated?: boolean; translatedAt?: string }>
            > | null) ?? {};

        return fields.map((fieldType): TranslationFieldState => {
            const i18nValue = entity[`${fieldType}I18n`] as Record<string, string> | null;
            const fieldMeta = meta[fieldType] ?? {};

            const locales: Record<
                string,
                { value: string; autoTranslated: boolean; translatedAt?: string }
            > = {};

            for (const locale of ['en', 'pt'] as const) {
                const localeMeta = fieldMeta[locale];
                const value = i18nValue?.[locale] ?? '';

                locales[locale] = {
                    value,
                    autoTranslated: localeMeta?.autoTranslated ?? value.length > 0,
                    translatedAt: localeMeta?.translatedAt
                };
            }

            return { fieldType, locales };
        });
    }, [entity, entityType]);

    const handleTranslateNow = useCallback(
        async (fieldType: string) => {
            try {
                const response = await fetch('/api/v1/admin/ai/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entityType,
                        entityId,
                        targetLocales: ['en', 'pt']
                    }),
                    credentials: 'include'
                });

                const result = await response.json();

                if (result.success) {
                    addToast({
                        title: t('admin-common.aiTranslate.batchComplete'),
                        message: `${fieldType} translated successfully`,
                        variant: 'success'
                    });
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    addToast({
                        title: t('admin-common.aiTranslate.batchError'),
                        message:
                            result.error?.message ?? t('admin-common.aiTranslate.error.default'),
                        variant: 'error'
                    });
                }
            } catch {
                addToast({
                    title: t('admin-common.aiTranslate.batchError'),
                    message: t('admin-common.aiTranslate.error.default'),
                    variant: 'error'
                });
            }
        },
        [entityType, entityId, addToast, t]
    );

    const handleOverrideSaved = useCallback(
        async (fieldType: string, locale: string, value: string) => {
            try {
                const response = await fetch('/api/v1/admin/ai/translate/override', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entityType,
                        entityId,
                        locale,
                        fieldType,
                        value
                    }),
                    credentials: 'include'
                });

                const result = await response.json();

                if (result.success) {
                    addToast({
                        title: t('admin-common.aiTranslate.overrideSaved'),
                        message: `${fieldType} (${locale.toUpperCase()}) updated`,
                        variant: 'success'
                    });
                    setTimeout(() => window.location.reload(), 1000);
                } else {
                    addToast({
                        title: t('admin-common.aiTranslate.error.default'),
                        message: result.error?.message ?? '',
                        variant: 'error'
                    });
                }
            } catch {
                addToast({
                    title: t('admin-common.aiTranslate.error.default'),
                    message: '',
                    variant: 'error'
                });
            }
        },
        [entityType, entityId, addToast, t]
    );

    return (
        <TranslationStatus
            fields={fieldStates}
            onTranslateNow={handleTranslateNow}
            onOverrideSaved={handleOverrideSaved}
        />
    );
}
