/**
 * @file ShowDeletedToggle.tsx
 * @description «Mostrar borrados» checkbox shared by both catalog tabs (HOS-2340).
 */

import { useId } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { catalogKey } from '../lib/i18n-keys';

/** Props for {@link ShowDeletedToggle}. */
export interface ShowDeletedToggleProps {
    /** Test id of the checkbox. */
    readonly testId: string;
    readonly checked: boolean;
    readonly onChange: (checked: boolean) => void;
}

/**
 * A labelled, keyboard operable checkbox that turns the soft-deleted rows of a
 * catalog list on or off.
 *
 * @param props - {@link ShowDeletedToggleProps}
 */
export function ShowDeletedToggle({ testId, checked, onChange }: ShowDeletedToggleProps) {
    const { t } = useTranslations();
    const id = useId();

    return (
        <label
            htmlFor={id}
            className="flex cursor-pointer items-center gap-2 text-sm"
        >
            <input
                id={id}
                type="checkbox"
                data-testid={testId}
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
            {t(catalogKey({ path: 'showDeleted' }))}
        </label>
    );
}
