/**
 * @file HostTradeCategoryGroupDialog.tsx
 * @description Create / edit dialog for a provider trade category group
 * (HOS-919 T-043).
 *
 * TanStack Form holds the values; validation runs `schema.safeParse` through
 * the shared form validator on submit (no resolver library). Create validates
 * against the create schema, edit against the strict update schema, so an edit
 * cannot smuggle a slug into the PATCH.
 */

import {
    type HostTradeCategoryGroupAdmin,
    HostTradeCategoryGroupCreateInputSchema,
    HostTradeCategoryGroupUpdateInputSchema
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import { validateFormWithZod } from '@/lib/validation/validate-form';
import { buildGroupPayload, toBasicValues } from '../lib/catalog-form';
import { catalogKey } from '../lib/i18n-keys';
import { CatalogBasicFields, type CatalogBasicValues } from './CatalogBasicFields';

/** Props for {@link HostTradeCategoryGroupDialog}. */
export interface HostTradeCategoryGroupDialogProps {
    readonly mode: 'create' | 'edit';
    /** The group being edited. Required in `edit` mode. */
    readonly row?: HostTradeCategoryGroupAdmin;
    readonly isPending: boolean;
    /** Receives the validated request body. */
    readonly onSubmit: (payload: Record<string, unknown>) => void;
    readonly onOpenChange: (open: boolean) => void;
}

/**
 * The group form dialog. Mount it only while it should be open: a fresh mount
 * is what resets the form, so no effect has to chase the target row.
 *
 * @param props - {@link HostTradeCategoryGroupDialogProps}
 */
export function HostTradeCategoryGroupDialog({
    mode,
    row,
    isPending,
    onSubmit,
    onOpenChange
}: HostTradeCategoryGroupDialogProps) {
    const { t } = useTranslations();
    const tAny = t as (key: string, params?: Record<string, unknown>) => string;
    const [errors, setErrors] = useState<Record<string, string>>({});

    const form = useForm({
        defaultValues: { basics: toBasicValues({ row }) as CatalogBasicValues },
        onSubmit: ({ value }) => {
            const payload = buildGroupPayload({ mode, values: value.basics });
            const found = validateFormWithZod({
                schema:
                    mode === 'create'
                        ? HostTradeCategoryGroupCreateInputSchema
                        : HostTradeCategoryGroupUpdateInputSchema,
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
                data-testid="group-dialog"
            >
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            catalogKey({
                                path:
                                    mode === 'create'
                                        ? 'groups.dialog.createTitle'
                                        : 'groups.dialog.editTitle'
                            })
                        )}
                    </DialogTitle>
                </DialogHeader>

                <form
                    noValidate
                    data-testid="group-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    <form.Field name="basics">
                        {(field) => (
                            <CatalogBasicFields
                                scope="groups"
                                mode={mode}
                                value={field.state.value}
                                onChange={field.handleChange}
                                errors={errors}
                                disabled={isPending}
                            />
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
                            data-testid="group-save"
                        >
                            {t(catalogKey({ path: 'actions.save' }))}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
