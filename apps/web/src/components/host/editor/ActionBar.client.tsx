/**
 * @file ActionBar.client.tsx
 * @description Fixed bottom action bar for the accommodation editor form.
 *
 * Renders Back (secondary) and Save (primary) buttons. Both are disabled
 * during the save operation to prevent double-submits.
 *
 * Shared by all four host editors (accommodation, commerce, event, post —
 * HOS-1014). The secondary button always navigates to a fixed hub, never
 * `history.back()`, so it reads "Back"/"Volver"/"Voltar"
 * (`host.properties.editor.action.back`), not "Cancel" — it doesn't discard
 * anything, it's just navigation. That key is intentionally distinct from
 * `host.properties.editor.action.cancel`, which `PhotoMetadataEditor` still
 * uses for its own Cancel button that genuinely discards an in-progress
 * inline edit and stays on the page: the two buttons don't mean the same
 * thing, so they don't share a key.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ActionBar.module.css';

/** Props for ActionBar. */
export interface ActionBarProps {
    readonly locale: SupportedLocale;
    readonly isSaving: boolean;
    readonly onCancel: () => void;
}

/**
 * Fixed bottom action bar with Back and Save buttons.
 * Save is a submit button (type="submit"), Back is type="button".
 * Both are disabled during save to prevent double-submits.
 */
export function ActionBar({ locale, isSaving, onCancel }: ActionBarProps) {
    const { t } = createTranslations(locale);

    return (
        <div className={styles.actions}>
            <button
                type="button"
                className={styles.actionsSecondary}
                onClick={onCancel}
                disabled={isSaving}
            >
                {t('host.properties.editor.action.back', 'Volver')}
            </button>
            <button
                type="submit"
                className={styles.actionsPrimary}
                disabled={isSaving}
            >
                {isSaving
                    ? t('host.properties.editor.action.saving', 'Guardando...')
                    : t('host.properties.editor.action.save', 'Guardar')}
            </button>
        </div>
    );
}
