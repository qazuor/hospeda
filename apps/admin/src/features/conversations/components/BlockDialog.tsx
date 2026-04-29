/**
 * BlockDialog component.
 *
 * Shadcn AlertDialog that confirms blocking a conversation.
 * Provides an optional block reason textarea (max 1000 chars).
 * Submits via useUpdateStatusMutation.
 *
 * Uses TanStack Form (project standard for admin forms).
 */

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import { useUpdateStatusMutation } from '../hooks/useUpdateStatusMutation';

/** Props for BlockDialog */
export interface BlockDialogProps {
    /** Conversation ID to block */
    conversationId: string;
    /** Optional callback after block succeeds */
    onSuccess?: () => void;
}

const blockReasonValidator = z.string().max(1000, 'conversations.errors.blockReasonTooLong');

/**
 * Confirmation dialog for blocking a conversation with an optional reason.
 *
 * @param props - BlockDialogProps
 */
export function BlockDialog({ conversationId, onSuccess }: BlockDialogProps) {
    const { t } = useTranslations();
    const [open, setOpen] = useState(false);
    const mutation = useUpdateStatusMutation();

    const form = useForm({
        defaultValues: { blockReason: '' },
        onSubmit: async ({ value }) => {
            await mutation.mutateAsync({
                conversationId,
                status: 'BLOCKED',
                blockReason: value.blockReason.trim() || undefined
            });
            form.reset();
            setOpen(false);
            onSuccess?.();
        }
    });

    return (
        <AlertDialog
            open={open}
            onOpenChange={setOpen}
        >
            <AlertDialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="sm"
                >
                    {t('conversations.actions.block')}
                </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('conversations.actions.block')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t('conversations.dialogs.blockDescription')}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <form
                    id="block-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                    }}
                    className="flex flex-col gap-2"
                >
                    <form.Field
                        name="blockReason"
                        validators={{
                            onChange: ({ value }) => {
                                const result = blockReasonValidator.safeParse(value);
                                return result.success ? undefined : result.error.issues[0]?.message;
                            }
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1">
                                <Textarea
                                    id={field.name}
                                    name={field.name}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    placeholder={t('conversations.dialogs.blockReasonPlaceholder')}
                                    rows={3}
                                    maxLength={1000}
                                    aria-label={t('conversations.dialogs.blockReasonPlaceholder')}
                                />
                                <span className="text-muted-foreground text-xs">
                                    {field.state.value.length}/1000
                                </span>
                                {field.state.meta.isTouched &&
                                    field.state.meta.errors.length > 0 && (
                                        <p className="text-destructive text-xs">
                                            {/* TYPE-WORKAROUND: TanStack Form types errors[0] as unknown; cast narrows to TranslationKey for the i18n t() call. */}
                                            {t(
                                                field.state.meta
                                                    .errors[0] as unknown as TranslationKey
                                            )}
                                        </p>
                                    )}
                            </div>
                        )}
                    </form.Field>

                    {mutation.isError && (
                        <p className="text-destructive text-xs">
                            {(mutation.error as Error)?.message ??
                                t('conversations.errors.blockFailed')}
                        </p>
                    )}
                </form>

                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => form.reset()}>
                        {t('admin-entities.actions.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        type="submit"
                        form="block-form"
                        disabled={mutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {t('conversations.actions.block')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
