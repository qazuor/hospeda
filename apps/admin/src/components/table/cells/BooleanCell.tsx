import { useTranslations } from '@repo/i18n';
import { CheckIcon, CloseIcon } from '@repo/icons';
import type { ReactNode } from 'react';

type BooleanCellProps = {
    readonly value: unknown;
};

/**
 * BooleanCell component for rendering boolean values in table cells.
 * Displays checkmarks for true values and X marks for false values.
 * aria-label is localized (SPEC-117 D-POSTS.2 — was hardcoded 'True'/'False').
 */
export const BooleanCell = ({ value }: BooleanCellProps): ReactNode => {
    const { t } = useTranslations();

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">—</span>;
    }

    const boolValue = Boolean(value);

    return (
        <div className="flex items-center justify-center">
            {boolValue ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/15">
                    <CheckIcon
                        size={12}
                        weight="bold"
                        className="text-success"
                        aria-label={t('admin-entities.viewFields.boolean.yes')}
                    />
                </div>
            ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/15">
                    <CloseIcon
                        size={12}
                        weight="bold"
                        className="text-destructive"
                        aria-label={t('admin-entities.viewFields.boolean.no')}
                    />
                </div>
            )}
        </div>
    );
};
