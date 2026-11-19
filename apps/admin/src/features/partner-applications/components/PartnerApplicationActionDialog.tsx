import type { TranslationKey } from '@repo/i18n';
import type { AdminPartnerApplicationPanelItem } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePartnerTypeOptions } from '@/hooks/use-partner-types';
import { useTranslations } from '@/hooks/use-translations';
import type { usePartnerApplicationActions } from '../hooks/usePartnerApplicationActions';

type Action = 'approve' | 'reject' | 'cancelWait';
type Mutations = ReturnType<typeof usePartnerApplicationActions>;

/** Confirms a partner application action and reports API failures in the dialog. */
export function PartnerApplicationActionDialog({
    item,
    action,
    onClose,
    actions
}: {
    readonly item: AdminPartnerApplicationPanelItem;
    readonly action: Action;
    readonly onClose: () => void;
    readonly actions: Mutations;
}) {
    const { t } = useTranslations();
    const [apiError, setApiError] = useState(false);
    const pending = actions[action].isPending;
    // HOS-2336 AC-2.4: the approval picks an ACTIVE catalog type and sends its id.
    const typeOptions = usePartnerTypeOptions();
    const form = useForm({
        // `typeId` starts empty: the select shows the first catalog option (lowest
        // weight) until the operator picks one, and submit falls back to it.
        defaultValues: {
            reason: '',
            name: '',
            typeId: ''
        },
        onSubmit: async ({ value }) => {
            setApiError(false);
            try {
                if (action === 'approve')
                    await actions.approve.mutateAsync({
                        id: item.id,
                        reason: value.reason.trim(),
                        name: value.name.trim(),
                        typeId: value.typeId || (typeOptions.options[0]?.value ?? '')
                    });
                else if (action === 'reject')
                    await actions.reject.mutateAsync({
                        id: item.id,
                        reason: value.reason.trim()
                    });
                else
                    await actions.cancelWait.mutateAsync({
                        id: item.id,
                        reason: value.reason.trim()
                    });
                onClose();
            } catch {
                setApiError(true);
            }
        }
    });
    const key = `dialogs.${action}` as const;
    return (
        <AlertDialog
            open
            onOpenChange={(open) => {
                if (!open && !pending) onClose();
            }}
        >
            <AlertDialogContent data-testid="partner-application-action-dialog">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.handleSubmit();
                    }}
                    className="space-y-4"
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t(
                                `admin-entities.partnerApplicationPanel.${key}.title` as TranslationKey
                            )}
                        </AlertDialogTitle>
                        <AlertDialogDescription>{item.email}</AlertDialogDescription>
                    </AlertDialogHeader>
                    {action === 'approve' && (
                        <>
                            <Label htmlFor="partner-name">
                                {t('admin-entities.partnerApplicationPanel.dialogs.partnerName')}
                            </Label>
                            <form.Field name="name">
                                {(field) => (
                                    <Input
                                        id="partner-name"
                                        value={field.state.value}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    />
                                )}
                            </form.Field>
                            <Label htmlFor="partner-type">
                                {t('admin-entities.partnerApplicationPanel.dialogs.partnerType')}
                            </Label>
                            <form.Field name="typeId">
                                {(field) => (
                                    <select
                                        id="partner-type"
                                        className="w-full rounded-md border px-3 py-2"
                                        value={
                                            field.state.value ||
                                            (typeOptions.options[0]?.value ?? '')
                                        }
                                        disabled={typeOptions.isLoading}
                                        onChange={(event) => field.handleChange(event.target.value)}
                                    >
                                        {typeOptions.options.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </form.Field>
                        </>
                    )}
                    <Label htmlFor="application-reason">
                        {t('admin-entities.partnerApplicationPanel.dialogs.reason')}
                    </Label>
                    <form.Field name="reason">
                        {(field) => (
                            <Textarea
                                id="application-reason"
                                value={field.state.value}
                                onChange={(event) => field.handleChange(event.target.value)}
                            />
                        )}
                    </form.Field>
                    {apiError && (
                        <p role="alert">
                            {t('admin-entities.partnerApplicationPanel.errors.action')}
                        </p>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            type="button"
                            disabled={pending}
                        >
                            {t('admin-entities.partnerApplicationPanel.dialogs.cancel')}
                        </AlertDialogCancel>
                        <form.Subscribe selector={(state) => state.values}>
                            {(values) => (
                                <Button
                                    type="submit"
                                    disabled={
                                        pending ||
                                        (action === 'approve' &&
                                            (!values.name.trim() ||
                                                typeOptions.options.length === 0)) ||
                                        !values.reason.trim()
                                    }
                                >
                                    {t(
                                        `admin-entities.partnerApplicationPanel.${key}.confirm` as TranslationKey
                                    )}
                                </Button>
                            )}
                        </form.Subscribe>
                    </AlertDialogFooter>
                </form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
