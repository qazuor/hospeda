/**
 * @file ActionBar.client.tsx
 * @description Fixed bottom action bar for the accommodation editor form.
 *
 * Renders Save (primary) and Cancel (secondary) buttons. Both are disabled
 * during the save operation to prevent double-submits.
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
 * Fixed bottom action bar with Save and Cancel buttons.
 * Save is a submit button (type="submit"), Cancel is type="button".
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
                {t('host.properties.editor.action.cancel', 'Cancelar')}
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
