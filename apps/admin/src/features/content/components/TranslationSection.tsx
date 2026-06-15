/**
 * TranslationSection — connects TranslationStatus to real entity data (SPEC-212 T-016).
 *
 * Reads i18n field values and metadata from an entity object, then
 * renders TranslationStatus with the appropriate state per field+locale.
 * Calls the translate API and override API on user actions.
 *
 * @module features/content/components/TranslationSection
 */

import {
    SectionAccordion,
    SectionAccordionItem
} from '@/components/entity-form/accordion/SectionAccordion';
import { useToast } from '@/components/ui/ToastProvider';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
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
                // fetchApi targets the API server (admin and API are separate
                // origins) and throws on a non-2xx response.
                await fetchApi({
                    path: '/api/v1/admin/ai/translate',
                    method: 'POST',
                    // The admin edit form works in Spanish; the backend fills the
                    // missing en/pt locales from it.
                    body: { entityType, entityId, sourceLocale: 'es' }
                });

                addToast({
                    title: t('admin-common.aiTranslate.batchComplete'),
                    message: `${fieldType} translated successfully`,
                    variant: 'success'
                });
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                addToast({
                    title: t('admin-common.aiTranslate.batchError'),
                    message:
                        error instanceof Error
                            ? error.message
                            : t('admin-common.aiTranslate.error.default'),
                    variant: 'error'
                });
            }
        },
        [entityType, entityId, addToast, t]
    );

    const handleOverrideSaved = useCallback(
        async (fieldType: string, locale: string, value: string) => {
            try {
                await fetchApi({
                    path: '/api/v1/admin/ai/translate/override',
                    method: 'PUT',
                    body: { entityType, entityId, locale, fieldType, value }
                });

                addToast({
                    title: t('admin-common.aiTranslate.overrideSaved'),
                    message: `${fieldType} (${locale.toUpperCase()}) updated`,
                    variant: 'success'
                });
                setTimeout(() => window.location.reload(), 1000);
            } catch (error) {
                addToast({
                    title: t('admin-common.aiTranslate.error.default'),
                    message: error instanceof Error ? error.message : '',
                    variant: 'error'
                });
            }
        },
        [entityType, entityId, addToast, t]
    );

    // Compact one-line summary shown while the section is collapsed: number of
    // target-locale slots still missing a translation, or the locale codes when
    // everything is filled.
    const collapsedSummary = useMemo(() => {
        let pending = 0;
        for (const field of fieldStates) {
            for (const locale of Object.values(field.locales)) {
                if (!locale.value) pending += 1;
            }
        }
        return pending === 0 ? 'EN · PT' : `${pending} ${t('admin-common.aiTranslate.pending')}`;
    }, [fieldStates, t]);

    return (
        <SectionAccordion>
            <SectionAccordionItem
                id="translations"
                title={t('admin-common.aiTranslate.status')}
                collapsedSummary={collapsedSummary}
                defaultCollapsed={true}
            >
                <TranslationStatus
                    fields={fieldStates}
                    onTranslateNow={handleTranslateNow}
                    onOverrideSaved={handleOverrideSaved}
                    variant="section"
                />
            </SectionAccordionItem>
        </SectionAccordion>
    );
}
