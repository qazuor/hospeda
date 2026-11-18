/**
 * @file HostTradeCategoryDialog.tsx
 * @description Create / edit dialog for a provider trade category (HOS-919
 * T-044): shared fields, group select and the per-locale keywords editor.
 *
 * The group select offers ACTIVE groups only, plus the category's current group
 * when editing: a category whose group was deactivated must still show where it
 * lives, or saving would silently move it.
 */

import {
    type HostTradeCategoryAdmin,
    HostTradeCategoryCreateInputSchema,
    type HostTradeCategoryGroupAdmin,
    HostTradeCategoryUpdateInputSchema,
    LifecycleStatusEnum
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { validateFormWithZod } from '@/lib/validation/validate-form';
import { resolveI18nText } from '@/utils/i18n-text';
import {
    buildCategoryPayload,
    type CategoryExtraValues,
    toBasicValues,
    toCategoryExtraValues
} from '../lib/catalog-form';
import { catalogKey } from '../lib/i18n-keys';
import { CatalogBasicFields, type CatalogBasicValues } from './CatalogBasicFields';
import { KeywordsEditor } from './KeywordsEditor';

/** Props for {@link HostTradeCategoryDialog}. */
export interface HostTradeCategoryDialogProps {
    readonly mode: 'create' | 'edit';
    /** The category being edited. Required in `edit` mode. */
    readonly row?: HostTradeCategoryAdmin;
    /** Every group, active or not; the dialog decides which to offer. */
    readonly groups: readonly HostTradeCategoryGroupAdmin[];
    readonly isPending: boolean;
    /** Receives the validated request body. */
    readonly onSubmit: (payload: Record<string, unknown>) => void;
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * The category form dialog. Mount it only while it should be open: a fresh
 * mount is what resets the form.
 *
 * @param props - {@link HostTradeCategoryDialogProps}
 */
export function HostTradeCategoryDialog({
    mode,
    row,
    groups,
    isPending,
    onSubmit,
    onOpenChange
}: HostTradeCategoryDialogProps) {
    const { t } = useTranslations();
    const tAny = t as (key: string, params?: Record<string, unknown>) => string;
    const [errors, setErrors] = useState<Record<string, string>>({});

    const groupOptions = useMemo(
        () =>
            groups.filter(
                (group) =>
                    group.lifecycleState === LifecycleStatusEnum.ACTIVE || group.id === row?.groupId
            ),
        [groups, row?.groupId]
    );

    const form = useForm({
        defaultValues: {
            basics: toBasicValues({ row }) as CatalogBasicValues,
            extra: toCategoryExtraValues({ row }) as CategoryExtraValues
        },
        onSubmit: ({ value }) => {
            const payload = buildCategoryPayload({
                mode,
                values: value.basics,
                extra: value.extra
            });
            const found = validateFormWithZod({
                schema:
                    mode === 'create'
                        ? HostTradeCategoryCreateInputSchema
                        : HostTradeCategoryUpdateInputSchema,
                data: payload,
                t: tAny
            });
            setErrors(found);
            if (Object.keys(found).length === 0) onSubmit(payload);
        }
    });

    return (
        <Dialog
            open
            onOpenChange={onOpenChange}
        >
            <DialogContent
                className="max-h-[90vh] overflow-y-auto"
                data-testid="category-dialog"
            >
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            catalogKey({
                                path:
                                    mode === 'create'
                                        ? 'categories.dialog.createTitle'
                                        : 'categories.dialog.editTitle'
                            })
                        )}
                    </DialogTitle>
                </DialogHeader>

                <form
                    noValidate
                    data-testid="category-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    <form.Field name="basics">
                        {(field) => (
                            <CatalogBasicFields
                                scope="categories"
                                mode={mode}
                                value={field.state.value}
                                onChange={field.handleChange}
                                errors={errors}
                                disabled={isPending}
                            />
                        )}
                    </form.Field>

                    <form.Field name="extra">
                        {(field) => (
                            <>
                                <div className="space-y-1.5">
                                    <Label htmlFor="category-group">
                                        {t(catalogKey({ path: 'categories.dialog.groupLabel' }))}{' '}
                                        <span className="text-destructive">*</span>
                                    </Label>
                                    <select
                                        id="category-group"
                                        data-testid="category-group"
                                        value={field.state.value.groupId}
                                        disabled={isPending}
                                        aria-invalid={Boolean(errors.groupId)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        onChange={(event) =>
                                            field.handleChange({
                                                ...field.state.value,
                                                groupId: event.target.value
                                            })
                                        }
                                    >
                                        <option value="">
                                            {t(
                                                catalogKey({
                                                    path: 'categories.dialog.groupPlaceholder'
                                                })
                                            )}
                                        </option>
                                        {groupOptions.map((group) => (
                                            <option
                                                key={group.id}
                                                value={group.id}
                                            >
                                                {resolveI18nText(group.nameI18n) || group.slug}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.groupId ? (
                                        <p
                                            className="text-destructive text-xs"
                                            role="alert"
                                        >
                                            {errors.groupId}
                                        </p>
                                    ) : null}
                                </div>

                                <KeywordsEditor
                                    value={field.state.value.keywords}
                                    disabled={isPending}
                                    onChange={(keywords) =>
                                        field.handleChange({ ...field.state.value, keywords })
                                    }
                                />
                            </>
                        )}
                    </form.Field>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => onOpenChange(false)}
                        >
                            {t(catalogKey({ path: 'actions.cancel' }))}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            data-testid="category-save"
                        >
                            {t(catalogKey({ path: 'actions.save' }))}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
