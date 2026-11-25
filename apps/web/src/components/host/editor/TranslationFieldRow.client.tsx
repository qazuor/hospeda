/** Read-only accommodation translation adapter using the shared row presentation. */
import { TranslationEditorRow } from '@/components/account/editor/TranslationEditor';
import styles from '@/components/account/editor/TranslationEditor.module.css';
import { StatusPill, type StatusTone } from '@/components/account/ui';
import type { AccommodationTranslationData, TranslatableFieldStatus } from '@/lib/api/types';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import type { FieldOutcome, LocaleDisplay, TranslatableField } from './translation-status';
import { localeDisplaysFor } from './translation-status';

/** Short locale labels for tabs and generation failures. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = { es: 'ES', en: 'EN', pt: 'PT' };

const ROLE_TONE: Readonly<Record<LocaleDisplay['role'], StatusTone>> = {
    source: 'neutral',
    translated: 'success',
    missing: 'warning'
};

/** A host field remains read-only; generation outcomes never become editable state. */
export interface TranslationFieldRowProps {
    readonly status: TranslatableFieldStatus;
    readonly sourceLocale: SupportedLocale;
    readonly displayLocale: SupportedLocale;
    readonly fieldLabel: string;
    readonly outcome?: FieldOutcome;
    readonly t: TranslationFn;
}

/** Outcome pill shared across the locale views of a host field. */
function FieldNote({
    sourced,
    outcome,
    t
}: {
    readonly sourced: boolean;
    readonly outcome?: FieldOutcome;
    readonly t: TranslationFn;
}) {
    if (outcome?.status === 'pending')
        return (
            <StatusPill tone="info">
                {t('host.properties.editor.translation.fieldPending', 'Generando...')}
            </StatusPill>
        );
    if (outcome?.status === 'translated')
        return (
            <StatusPill tone="success">
                {t('host.properties.editor.translation.fieldTranslated', 'Traducido')}
            </StatusPill>
        );
    if (outcome?.status === 'failed') {
        const locales = outcome.failedLocales.map((locale) => LOCALE_LABELS[locale]).join(', ');
        return (
            <StatusPill tone="danger">
                {locales
                    ? t(
                          'host.properties.editor.translation.fieldFailed',
                          'No se pudo traducir a {{locales}}',
                          { locales }
                      )
                    : t(
                          'host.properties.editor.translation.fieldFailedUnknown',
                          'No se pudo traducir este campo'
                      )}
            </StatusPill>
        );
    }
    if (outcome)
        return (
            <StatusPill tone="neutral">
                {t('host.properties.editor.translation.fieldUntouched', 'Sin cambios')}
            </StatusPill>
        );
    return sourced ? null : (
        <StatusPill tone="neutral">
            {t('host.properties.editor.translation.fieldNoSource', 'Sin contenido para traducir')}
        </StatusPill>
    );
}

/** Plain text grows naturally, without clipping or nested scrolling. */
export function TranslationFieldRow({
    status,
    sourceLocale,
    displayLocale,
    fieldLabel,
    outcome,
    t
}: TranslationFieldRowProps) {
    const displays = localeDisplaysFor({ status, sourceLocale });
    const sourced = displays.some((display) => display.role === 'source' && display.text !== null);
    const display = displays.find((candidate) => candidate.locale === displayLocale);
    const roleLabel =
        display?.role === 'source'
            ? t('host.properties.editor.translation.roleSource', 'Original')
            : display?.role === 'translated'
              ? t('host.properties.editor.translation.roleTranslated', 'Generado con IA')
              : t('host.properties.editor.translation.roleMissing', 'Sin traducir');
    const text =
        display?.text ??
        (display?.presenceOnly
            ? t(
                  'host.properties.editor.translation.textUnavailable',
                  'Se generó recién. Actualizá la página para leerlo.'
              )
            : display?.role === 'source'
              ? t(
                    'host.properties.editor.translation.sourceEmpty',
                    'Todavía no escribiste este contenido.'
                )
              : t(
                    'host.properties.editor.translation.translationEmpty',
                    'Todavía no se generó esta traducción.'
                ));
    return (
        <TranslationEditorRow
            locale={displayLocale}
            role={display?.role}
            heading={
                <>
                    <p data-translation-label="">{fieldLabel}</p>
                    {display && <StatusPill tone={ROLE_TONE[display.role]}>{roleLabel}</StatusPill>}
                    <FieldNote
                        sourced={sourced}
                        outcome={outcome}
                        t={t}
                    />
                </>
            }
        >
            <p className={styles.text}>{text}</p>
        </TranslationEditorRow>
    );
}

/** Counts missing translations using the same role model as the row. */
export function countMissingInLocale({
    statuses,
    sourceLocale,
    locale
}: {
    readonly statuses: readonly TranslatableFieldStatus[];
    readonly sourceLocale: SupportedLocale;
    readonly locale: SupportedLocale;
}): number {
    return statuses.filter((status) =>
        localeDisplaysFor({ status, sourceLocale }).some(
            (display) => display.locale === locale && display.role === 'missing'
        )
    ).length;
}

/** A field before it is placed into locale tabs. */
export interface TranslationRowModel {
    readonly field: TranslatableField;
    readonly status: TranslatableFieldStatus;
    readonly label: string;
}

/** Rich description is absent when the accommodation plan excludes it. */
export function buildTranslationRows({
    translations,
    t
}: {
    readonly translations: AccommodationTranslationData;
    readonly t: TranslationFn;
}): readonly TranslationRowModel[] {
    const rows: TranslationRowModel[] = [
        {
            field: 'name',
            status: translations.name,
            label: t('host.properties.editor.field.name', 'Nombre')
        },
        {
            field: 'summary',
            status: translations.summary,
            label: t('host.properties.editor.field.summary', 'Resumen')
        },
        {
            field: 'description',
            status: translations.description,
            label: t('host.properties.editor.field.description', 'Descripción')
        }
    ];
    if (translations.richDescription !== null)
        rows.push({
            field: 'richDescription',
            status: translations.richDescription,
            label: t(
                'host.properties.editor.translation.fieldRichDescription',
                'Descripción enriquecida'
            )
        });
    return rows;
}
