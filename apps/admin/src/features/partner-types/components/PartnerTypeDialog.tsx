/**
 * @file PartnerTypeDialog.tsx
 * @description Create / edit dialog for a partner type (HOS-2336).
 *
 * TanStack Form holds the values; validation runs `schema.safeParse` through
 * the shared form validator on submit (no resolver library). Create validates
 * against the create schema, edit against the strict update schema, so an
 * edit cannot smuggle a slug into the PATCH (AC-3.3).
 */

import {
    type PartnerTypeAdminListItem,
    PartnerTypeCreateInputSchema,
    PartnerTypeUpdateInputSchema
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { I18nTextField } from '@/components/entity-form/fields/I18nTextField';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from '@/hooks/use-translations';
import { validateFormWithZod } from '@/lib/validation/validate-form';
import {
    buildPartnerTypePayload,
    type PartnerTypeFormValues,
    partnerTypesKey,
    toPartnerTypeFormValues
} from '../lib/partner-type-form';

/** Props for {@link PartnerTypeDialog}. */
export interface PartnerTypeDialogProps {
    readonly mode: 'create' | 'edit';
    /** The type being edited. Required in `edit` mode. */
    readonly row?: PartnerTypeAdminListItem;
    readonly isPending: boolean;
    /** Receives the validated request body. */
    readonly onSubmit: (payload: Record<string, unknown>) => void;
    readonly onOpenChange: (open: boolean) => void;
}

/** Renders a field's validation message, if any. */
function FieldError({ message }: { readonly message?: string }) {
    if (!message) return null;
    return (
        <p
            className="text-destructive text-xs"
            role="alert"
        >
            {message}
        </p>
    );
}

/**
 * The partner type form dialog. Mount it only while it should be open: a fresh
 * mount is what resets the form.
 *
 * @param props - {@link PartnerTypeDialogProps}
 */
export function PartnerTypeDialog({
    mode,
    row,
    isPending,
    onSubmit,
    onOpenChange
}: PartnerTypeDialogProps) {
    const { t } = useTranslations();
    const tAny = t as (key: string, params?: Record<string, unknown>) => string;
    const [errors, setErrors] = useState<Record<string, string>>({});

    const form = useForm({
        defaultValues: { values: toPartnerTypeFormValues({ row }) as PartnerTypeFormValues },
        onSubmit: ({ value }) => {
            const payload = buildPartnerTypePayload({ mode, values: value.values });
            const found = validateFormWithZod({
                schema:
                    mode === 'create' ? PartnerTypeCreateInputSchema : PartnerTypeUpdateInputSchema,
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
                data-testid="partner-type-dialog"
            >
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            partnerTypesKey({
                                path: mode === 'create' ? 'dialog.createTitle' : 'dialog.editTitle'
                            })
                        )}
                    </DialogTitle>
                </DialogHeader>

                <form
                    noValidate
                    data-testid="partner-type-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    <form.Field name="values">
                        {(field) => {
                            const value = field.state.value;
                            const change = (next: Partial<PartnerTypeFormValues>) =>
                                field.handleChange({ ...value, ...next });
                            return (
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="partner-type-slug">
                                            {t(partnerTypesKey({ path: 'dialog.slugLabel' }))}{' '}
                                            <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="partner-type-slug"
                                            data-testid="partner-type-slug"
                                            value={value.slug}
                                            disabled={isPending || mode === 'edit'}
                                            onChange={(e) => change({ slug: e.target.value })}
                                            aria-invalid={Boolean(errors.slug)}
                                            placeholder="media"
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            {t(partnerTypesKey({ path: 'dialog.slugHint' }))}
                                        </p>
                                        <FieldError message={errors.slug} />
                                    </div>

                                    <I18nTextField
                                        config={{
                                            id: 'nameI18n',
                                            type: FieldTypeEnum.I18N_TEXT,
                                            label: t(partnerTypesKey({ path: 'dialog.nameLabel' }))
                                        }}
                                        value={value.nameI18n}
                                        onChange={(nameI18n) => change({ nameI18n })}
                                        required
                                        disabled={isPending}
                                        hasError={Boolean(errors['nameI18n.es'] || errors.nameI18n)}
                                        localeErrors={{
                                            es: errors['nameI18n.es'] ?? errors.nameI18n,
                                            en: errors['nameI18n.en'],
                                            pt: errors['nameI18n.pt']
                                        }}
                                    />

                                    <div className="space-y-1.5">
                                        <Label htmlFor="partner-type-weight">
                                            {t(partnerTypesKey({ path: 'dialog.weightLabel' }))}
                                        </Label>
                                        <Input
                                            id="partner-type-weight"
                                            data-testid="partner-type-weight"
                                            type="number"
                                            min={1}
                                            max={1000}
                                            value={value.displayWeight}
                                            disabled={isPending}
                                            onChange={(e) =>
                                                change({ displayWeight: e.target.value })
                                            }
                                            aria-invalid={Boolean(errors.displayWeight)}
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            {t(partnerTypesKey({ path: 'dialog.weightHint' }))}
                                        </p>
                                        <FieldError message={errors.displayWeight} />
                                    </div>

                                    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="partner-type-active">
                                                {t(partnerTypesKey({ path: 'dialog.activeLabel' }))}
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                {t(partnerTypesKey({ path: 'dialog.activeHint' }))}
                                            </p>
                                        </div>
                                        <Switch
                                            id="partner-type-active"
                                            data-testid="partner-type-active"
                                            checked={value.active}
                                            disabled={isPending}
                                            onCheckedChange={(active) => change({ active })}
                                        />
                                    </div>
                                </div>
                            );
                        }}
                    </form.Field>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => onOpenChange(false)}
                        >
                            {t(partnerTypesKey({ path: 'actions.cancel' }))}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending}
                            data-testid="partner-type-save"
                        >
                            {t(partnerTypesKey({ path: 'actions.save' }))}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
