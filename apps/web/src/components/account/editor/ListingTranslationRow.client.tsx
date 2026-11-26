/**
 * @file ListingTranslationRow.client.tsx
 * @description One row of the listing translations section (HOS-2658 §6).
 *
 * `ListingTranslationSourceRow` shows the Spanish source read-only (ES tab).
 * `ListingTranslationPairRow` edits one `(field, en|pt)` pair: state pill, stale
 * alert linked to the control, "Guardar" and "Traducir con IA" with its visible
 * disabled reason. Persistence lives in the section; the row only reports intents.
 */
import type { ListingTranslationsResponse } from '@repo/schemas';
import { TranslationEditorRow } from '@/components/account/editor/TranslationEditor';
import editorStyles from '@/components/account/editor/TranslationEditor.module.css';
import { TranslationTextControl } from '@/components/account/editor/TranslationTextControl';
import { Alert, Button, Field, StatusPill } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import { createT } from '@/lib/i18n';
import styles from './ListingTranslationsSection.module.css';
import {
    aiButtonStateFor,
    isSaveEnabled,
    isSaveVisible,
    type ListingTranslationAiStatus,
    pillLabelKeyFor,
    pillToneFor
} from './listing-translations-section.helpers';

/** One field of the translations response. */
export type ListingTranslationFieldState = ListingTranslationsResponse['fields'][number];

/** Target locale of a pair row. */
export type ListingTranslationRowLocale = 'en' | 'pt';

/** What the row is doing right now, if anything. */
export type ListingTranslationRowBusy = 'save' | 'ai' | null;

const KEY = 'account.editorTranslations';

/** Field label without locale, e.g. `Descripción`. */
export function fieldLabelFor({
    locale,
    field
}: {
    readonly locale: SupportedLocale;
    readonly field: ListingTranslationFieldState['field'];
}): string {
    return createT(locale)(`${KEY}.field.${field}`);
}

/** Read-only Spanish source with a pointer to the section where it is edited. */
export function ListingTranslationSourceRow({
    locale,
    entry,
    sectionLabel
}: {
    readonly locale: SupportedLocale;
    readonly entry: ListingTranslationFieldState;
    readonly sectionLabel?: string;
}) {
    const t = createT(locale);
    const hasSource = entry.source.trim() !== '';
    return (
        <TranslationEditorRow
            locale="es"
            heading={<strong>{`${fieldLabelFor({ locale, field: entry.field })} (ES)`}</strong>}
        >
            {hasSource ? (
                <p
                    className={editorStyles.text}
                    data-source-field={entry.field}
                >
                    {entry.source}
                </p>
            ) : (
                <StatusPill tone="neutral">{t(`${KEY}.state.noSource`)}</StatusPill>
            )}
            {sectionLabel && (
                <p className={styles.hint}>
                    {t(`${KEY}.sourceHint`, undefined, { section: sectionLabel })}
                </p>
            )}
        </TranslationEditorRow>
    );
}

/** Props of {@link ListingTranslationPairRow}. */
export interface ListingTranslationPairRowProps {
    readonly locale: SupportedLocale;
    readonly entry: ListingTranslationFieldState;
    readonly targetLocale: ListingTranslationRowLocale;
    readonly aiStatus: ListingTranslationAiStatus;
    /** Unsaved text, or `undefined` when the control shows the stored value. */
    readonly draft: string | undefined;
    readonly busy: ListingTranslationRowBusy;
    /** Inline validation error from the last save. */
    readonly error?: string;
    readonly onDraftChange: (value: string) => void;
    readonly onSave: () => void;
    readonly onTranslate: () => void;
}

/** One editable `(field, locale)` pair. */
export function ListingTranslationPairRow({
    locale,
    entry,
    targetLocale,
    aiStatus,
    draft,
    busy,
    error,
    onDraftChange,
    onSave,
    onTranslate
}: ListingTranslationPairRowProps) {
    const t = createT(locale);
    const pair = entry.locales[targetLocale];
    const state = pair.state;
    const value = draft ?? pair.value;
    const dirty = draft !== undefined && draft !== pair.value;
    const baseId = `lts-${entry.field}-${targetLocale}`;
    const staleId = `${baseId}-stale`;
    const aiReasonId = `${baseId}-ai-reason`;
    const { tone } = pillToneFor({ state });
    const { key: pillKey } = pillLabelKeyFor({ state, value: pair.value });
    const ai = aiButtonStateFor({ state, aiStatus });
    const saveVisible = isSaveVisible({ state }).visible;
    const saveEnabled = isSaveEnabled({ state, dirty }).enabled && busy === null;
    const label = `${fieldLabelFor({ locale, field: entry.field })} (${targetLocale.toUpperCase()})`;

    const handleTranslate = () => {
        // `aria-disabled`, not `disabled`: the control stays focusable and the
        // reason stays reachable; the guard lives here.
        if (!ai.enabled || busy !== null) return;
        onTranslate();
    };

    return (
        <TranslationEditorRow
            locale={targetLocale}
            heading={
                <span data-pair-state={state}>
                    <StatusPill tone={tone}>{t(pillKey)}</StatusPill>
                </span>
            }
        >
            <div
                className={styles.pair}
                aria-busy={busy !== null}
                data-pair={`${entry.field}:${targetLocale}`}
            >
                {state === 'stale' && (
                    <div id={staleId}>
                        <Alert
                            tone="warning"
                            locale={locale}
                        >
                            {t(`${KEY}.state.stale`)}
                        </Alert>
                    </div>
                )}
                <Field
                    locale={locale}
                    label={label}
                    id={baseId}
                    hint={saveVisible ? t(`${KEY}.manualHint`) : undefined}
                    error={error}
                >
                    <TranslationTextControl
                        // AC-21: every field, the one-line name included, edits in a textarea.
                        singleLine={false}
                        value={value}
                        placeholder={label}
                        readOnly={!saveVisible}
                        describedBy={state === 'stale' ? staleId : undefined}
                        onChange={onDraftChange}
                    />
                </Field>
                <div className={editorStyles.actions}>
                    {saveVisible && (
                        <Button
                            variant="primary"
                            size="md"
                            disabled={!saveEnabled}
                            loading={busy === 'save'}
                            onClick={onSave}
                        >
                            {t(`${KEY}.action.save`)}
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        size="md"
                        aria-disabled={!ai.enabled || busy !== null}
                        aria-describedby={ai.reasonKey ? aiReasonId : undefined}
                        loading={busy === 'ai'}
                        onClick={handleTranslate}
                    >
                        {t(`${KEY}.action.translateAi`)}
                    </Button>
                </div>
                {ai.reasonKey && (
                    <p
                        id={aiReasonId}
                        className={styles.hint}
                    >
                        {t(ai.reasonKey)}
                    </p>
                )}
            </div>
        </TranslationEditorRow>
    );
}
